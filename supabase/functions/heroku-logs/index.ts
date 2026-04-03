import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Detect real bot status from log content
function detectBotStatus(logLines: string[]): string | null {
  // Check most recent logs first (reverse order)
  const recentLogs = [...logLines].reverse();
  for (const line of recentLogs) {
    const lower = line.toLowerCase();
    // WhatsApp bot specific statuses
    if (lower.includes("session closed") || lower.includes("logged out") || lower.includes("logout") || lower.includes("disconnected from whatsapp")) {
      return "stopped";
    }
    if (lower.includes("qr code") || lower.includes("scan qr") || lower.includes("waiting for scan")) {
      return "pending";
    }
    if (lower.includes("connection open") || lower.includes("connected to whatsapp") || lower.includes("bot is ready") || lower.includes("ready to receive") || lower.includes("session restored") || lower.includes("linked") || lower.includes("pairing success")) {
      return "running";
    }
    if (lower.includes("error") && (lower.includes("fatal") || lower.includes("crash") || lower.includes("unhandled"))) {
      return "failed";
    }
    // Heroku dyno statuses
    if (lower.includes("state changed to up") || lower.includes("process exited with status 0")) {
      return "running";
    }
    if (lower.includes("state changed to crashed") || lower.includes("process exited with status")) {
      return "failed";
    }
    if (lower.includes("state changed to down") || lower.includes("idling")) {
      return "stopped";
    }
    if (lower.includes("state changed to starting") || lower.includes("starting process")) {
      return "deploying";
    }
  }
  return null;
}

// Parse Heroku log lines to add status indicators
function enrichLogLine(line: string): string {
  const lower = line.toLowerCase();
  // Don't re-enrich lines that already have emoji
  if (/^[\[⏹▶🔄✅❌⚠️🚀🔑📦⚙️🔧📤📋⚡🏢👤🟢🔴🟡⏳🔗📡]/.test(line.trim())) return line;

  if (lower.includes("connected to whatsapp") || lower.includes("bot is ready") || lower.includes("session restored") || lower.includes("linked") || lower.includes("pairing success")) {
    return `🟢 ${line}`;
  }
  if (lower.includes("logged out") || lower.includes("session closed") || lower.includes("disconnected")) {
    return `🔴 ${line}`;
  }
  if (lower.includes("qr code") || lower.includes("scan qr") || lower.includes("waiting for scan")) {
    return `⏳ ${line}`;
  }
  if (lower.includes("state changed to up")) {
    return `🟢 ${line}`;
  }
  if (lower.includes("state changed to crashed") || lower.includes("error") || lower.includes("fatal")) {
    return `🔴 ${line}`;
  }
  if (lower.includes("state changed to starting") || lower.includes("starting process") || lower.includes("build")) {
    return `🟡 ${line}`;
  }
  if (lower.includes("state changed to down") || lower.includes("idling")) {
    return `⏹️ ${line}`;
  }
  return line;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const herokuApiKey = Deno.env.get("HEROKU_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { deployment_id } = await req.json();

    const { data: deployment } = await supabase
      .from("deployments")
      .select("*")
      .eq("id", deployment_id)
      .single();

    if (!deployment || !deployment.heroku_app_name) {
      return new Response(
        JSON.stringify({ error: "No Heroku app for this deployment" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get API key
    let apiKey = herokuApiKey;
    const { data: userKey } = await supabase
      .from("heroku_keys")
      .select("*")
      .eq("user_id", user.id)
      .eq("valid", true)
      .limit(1)
      .maybeSingle();
    if (userKey) {
      apiKey = userKey.api_key;
    } else {
      const { data: globalKey } = await supabase
        .from("heroku_keys")
        .select("*")
        .eq("is_global", true)
        .eq("valid", true)
        .limit(1)
        .maybeSingle();
      if (globalKey) apiKey = globalKey.api_key;
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "No Heroku API key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check dyno status from Heroku for real state
    let herokuDynoStatus = "";
    try {
      const dynoRes = await fetch(
        `https://api.heroku.com/apps/${deployment.heroku_app_name}/dynos`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/vnd.heroku+json; version=3",
          },
        }
      );
      if (dynoRes.ok) {
        const dynos = await dynoRes.json();
        // Check all dyno types (web + worker)
        const activeDyno = dynos.find((d: any) => d.state === "up") || 
                           dynos.find((d: any) => d.state === "starting") ||
                           dynos.find((d: any) => d.state === "crashed") ||
                           dynos[0];
        if (activeDyno) {
          herokuDynoStatus = activeDyno.state;
        } else {
          herokuDynoStatus = "no_dynos";
        }
      } else {
        await dynoRes.text();
      }
    } catch {
      // Non-critical
    }

    // Fetch Heroku logs
    const logRes = await fetch(
      `https://api.heroku.com/apps/${deployment.heroku_app_name}/log-sessions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/vnd.heroku+json; version=3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lines: 100, tail: false }),
      }
    );

    if (!logRes.ok) {
      const errText = await logRes.text();
      return new Response(
        JSON.stringify({ error: `Failed to get logs: ${errText}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const logData = await logRes.json();
    const logContentRes = await fetch(logData.logplex_url);
    const logContent = await logContentRes.text();

    const rawLines = logContent
      .split("\n")
      .filter((l: string) => l.trim())
      .slice(-80);

    // Enrich log lines with status indicators
    const enrichedLines = rawLines.map(enrichLogLine);

    // Merge with existing internal logs (deploy logs etc), deduplicate
    const existingLogs = (deployment.logs || []).filter((l: string) =>
      /^[\[⏹▶🔄✅❌⚠️🚀🔑📦⚙️🔧📤📋⚡🏢👤]/.test(l.trim())
    );
    const allLogs = [...existingLogs, ...enrichedLines];
    const seen = new Set<string>();
    const newLogs = allLogs
      .filter((l) => {
        const trimmed = l.trim();
        if (!trimmed || seen.has(trimmed)) return false;
        seen.add(trimmed);
        return true;
      })
      .slice(-100);

    // Determine real status from logs + dyno state
    const detectedStatus = detectBotStatus(rawLines);
    let finalStatus = deployment.status;

    // Map Heroku dyno state to our status
    if (herokuDynoStatus === "up") {
      finalStatus = "running";
    } else if (herokuDynoStatus === "crashed") {
      finalStatus = "failed";
    } else if (herokuDynoStatus === "starting") {
      finalStatus = "deploying";
    } else if (herokuDynoStatus === "idle" || herokuDynoStatus === "no_dynos") {
      finalStatus = "stopped";
    }

    // Override with log-based detection if it provides more specific info
    if (detectedStatus && detectedStatus !== finalStatus) {
      // Log-based detection for WhatsApp-specific states is more accurate
      if (detectedStatus === "stopped" && finalStatus === "running") {
        // Bot logged out but dyno is still up
        finalStatus = "stopped";
      }
    }

    // Add a status summary line if status changed
    if (finalStatus !== deployment.status) {
      const statusMsg =
        finalStatus === "running"
          ? "🟢 Bot is active and connected"
          : finalStatus === "stopped"
          ? "🔴 Bot is stopped or disconnected"
          : finalStatus === "failed"
          ? "🔴 Bot has crashed"
          : finalStatus === "deploying"
          ? "🟡 Bot is starting up..."
          : "";
      if (statusMsg) {
        const ts = new Date().toLocaleTimeString();
        newLogs.push(`[${ts}] ${statusMsg}`);
      }
    }

    await supabase
      .from("deployments")
      .update({
        logs: newLogs.slice(-100),
        status: finalStatus as any,
        ...(finalStatus === "running" && !deployment.uptime_start
          ? { uptime_start: new Date().toISOString() }
          : {}),
        ...(finalStatus === "stopped" || finalStatus === "failed"
          ? { uptime_start: null }
          : {}),
      })
      .eq("id", deployment_id);

    return new Response(
      JSON.stringify({ logs: newLogs, status: finalStatus, dyno_state: herokuDynoStatus }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Logs error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
