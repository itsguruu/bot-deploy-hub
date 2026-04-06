import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Find any valid API key from all sources
async function findApiKey(supabase: any, userId: string, envKey: string | undefined): Promise<string | null> {
  // User keys first
  const { data: userKeys } = await supabase
    .from("heroku_keys")
    .select("api_key")
    .eq("user_id", userId)
    .eq("valid", true);
  
  // Global keys
  const { data: globalKeys } = await supabase
    .from("heroku_keys")
    .select("api_key")
    .eq("is_global", true)
    .eq("valid", true);

  const allKeys = [
    ...(userKeys || []).map((k: any) => k.api_key),
    ...(globalKeys || []).map((k: any) => k.api_key),
  ];
  if (envKey) allKeys.push(envKey);

  // Try each key
  for (const key of allKeys) {
    try {
      const res = await fetch("https://api.heroku.com/account", {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/vnd.heroku+json; version=3",
        },
      });
      if (res.ok) {
        await res.json();
        return key;
      }
      await res.text();
    } catch {}
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { deployment_id, action } = await req.json();

    const { data: deployment } = await supabase
      .from("deployments")
      .select("*")
      .eq("id", deployment_id)
      .single();

    if (!deployment) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!deployment.heroku_app_name) {
      return new Response(JSON.stringify({ error: "No Heroku app name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Smart key detection - try all keys
    const envKey = Deno.env.get("HEROKU_API_KEY");
    const apiKey = await findApiKey(supabase, user.id, envKey);

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "No valid Heroku API key found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const addLog = async (msg: string) => {
      const { data: current } = await supabase
        .from("deployments")
        .select("logs")
        .eq("id", deployment_id)
        .single();
      const logs = [...(current?.logs || []), `[${new Date().toLocaleTimeString()}] ${msg}`];
      await supabase.from("deployments").update({ logs: logs.slice(-100) }).eq("id", deployment_id);
    };

    // Detect dyno type
    let dynoType = "worker";
    try {
      const formRes = await fetch(
        `https://api.heroku.com/apps/${deployment.heroku_app_name}/formation`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/vnd.heroku+json; version=3",
          },
        }
      );
      if (formRes.ok) {
        const formation = await formRes.json();
        if (formation.length > 0) dynoType = formation[0].type;
      } else {
        await formRes.text();
      }
    } catch {}

    if (action === "stop") {
      await addLog("⏹️ Stopping bot...");
      const res = await fetch(
        `https://api.heroku.com/apps/${deployment.heroku_app_name}/formation`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/vnd.heroku+json; version=3",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ updates: [{ type: dynoType, quantity: 0, size: "eco" }] }),
        }
      );
      await res.text();
      await supabase.from("deployments").update({ status: "stopped", uptime_start: null }).eq("id", deployment_id);
      await addLog("✅ Bot stopped");
    } else if (action === "start") {
      await addLog("▶️ Starting bot...");
      const res = await fetch(
        `https://api.heroku.com/apps/${deployment.heroku_app_name}/formation`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/vnd.heroku+json; version=3",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ updates: [{ type: dynoType, quantity: 1, size: "eco" }] }),
        }
      );
      await res.text();
      await supabase.from("deployments").update({ status: "running", uptime_start: new Date().toISOString() }).eq("id", deployment_id);
      await addLog("✅ Bot started");
    } else if (action === "restart") {
      await addLog("🔄 Restarting bot...");
      const res = await fetch(
        `https://api.heroku.com/apps/${deployment.heroku_app_name}/dynos`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/vnd.heroku+json; version=3",
          },
        }
      );
      await res.text();
      await supabase.from("deployments").update({ uptime_start: new Date().toISOString() }).eq("id", deployment_id);
      await addLog("✅ Bot restarted");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Action error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
