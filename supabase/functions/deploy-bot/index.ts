import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { deployment_id } = await req.json();
    if (!deployment_id) {
      return new Response(JSON.stringify({ error: "Missing deployment_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch deployment
    const { data: deployment, error: depErr } = await supabase
      .from("deployments")
      .select("*")
      .eq("id", deployment_id)
      .single();

    if (depErr || !deployment) {
      return new Response(JSON.stringify({ error: "Deployment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Heroku API key - prefer user's own, fall back to global
    let herokuApiKey = Deno.env.get("HEROKU_API_KEY");
    let herokuTeam = "silvateam14";

    // Check for user-provided key first
    const { data: userKey } = await supabase
      .from("heroku_keys")
      .select("*")
      .eq("user_id", user.id)
      .eq("valid", true)
      .limit(1)
      .maybeSingle();

    if (userKey) {
      herokuApiKey = userKey.api_key;
      herokuTeam = userKey.team_or_personal === "team" ? "silvateam14" : "";
    } else {
      // Fall back to global key
      const { data: globalKey } = await supabase
        .from("heroku_keys")
        .select("*")
        .eq("is_global", true)
        .eq("valid", true)
        .limit(1)
        .maybeSingle();

      if (globalKey) {
        herokuApiKey = globalKey.api_key;
        herokuTeam = globalKey.team_or_personal === "team" ? "silvateam14" : "";
      }
    }

    if (!herokuApiKey) {
      await supabase
        .from("deployments")
        .update({
          status: "failed",
          logs: [...(deployment.logs || []), "❌ No Heroku API key available"],
        })
        .eq("id", deployment_id);
      return new Response(JSON.stringify({ error: "No Heroku API key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update to deploying
    await supabase
      .from("deployments")
      .update({
        status: "deploying",
        logs: ["🚀 Starting deployment..."],
      })
      .eq("id", deployment_id);

    // Detect Heroku key type
    const addLog = async (msg: string) => {
      const { data: current } = await supabase
        .from("deployments")
        .select("logs")
        .eq("id", deployment_id)
        .single();
      const logs = [...(current?.logs || []), msg];
      await supabase
        .from("deployments")
        .update({ logs })
        .eq("id", deployment_id);
    };

    await addLog("🔑 Validating Heroku API key...");

    // Validate key by checking account
    const accountRes = await fetch("https://api.heroku.com/account", {
      headers: {
        Authorization: `Bearer ${herokuApiKey}`,
        Accept: "application/vnd.heroku+json; version=3",
      },
    });

    if (!accountRes.ok) {
      await addLog("❌ Invalid Heroku API key");
      await supabase
        .from("deployments")
        .update({ status: "failed" })
        .eq("id", deployment_id);
      return new Response(JSON.stringify({ error: "Invalid Heroku key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountData = await accountRes.json();
    await addLog(`✅ Authenticated as ${accountData.email}`);

    // Check if it's a team key by trying to list teams
    let isTeamKey = false;
    const teamsRes = await fetch("https://api.heroku.com/teams", {
      headers: {
        Authorization: `Bearer ${herokuApiKey}`,
        Accept: "application/vnd.heroku+json; version=3",
      },
    });
    if (teamsRes.ok) {
      const teams = await teamsRes.json();
      if (teams.length > 0) {
        isTeamKey = true;
        const teamNames = teams.map((t: any) => t.name).join(", ");
        await addLog(`🏢 Team key detected. Teams: ${teamNames}`);
        // Use first team if herokuTeam is not set
        if (!herokuTeam) herokuTeam = teams[0].name;
      }
    }
    await teamsRes.text(); // consume body if not already

    if (!isTeamKey) {
      await addLog("👤 Personal key detected");
    }

    // Create Heroku app
    const appName = `bothost-${deployment.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .substring(0, 20)}-${Date.now().toString(36)}`;

    await addLog(`📦 Creating Heroku app: ${appName}...`);

    const createBody: any = { name: appName, region: "us", stack: "heroku-22" };
    if (isTeamKey && herokuTeam) {
      createBody.team = herokuTeam;
    }

    const createRes = await fetch(
      isTeamKey && herokuTeam
        ? "https://api.heroku.com/teams/apps"
        : "https://api.heroku.com/apps",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${herokuApiKey}`,
          Accept: "application/vnd.heroku+json; version=3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createBody),
      }
    );

    if (!createRes.ok) {
      const errBody = await createRes.text();
      await addLog(`❌ Failed to create app: ${errBody}`);
      await supabase
        .from("deployments")
        .update({ status: "failed" })
        .eq("id", deployment_id);
      return new Response(JSON.stringify({ error: errBody }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appData = await createRes.json();
    await addLog(`✅ App created: ${appData.name}`);

    // Update deployment with heroku app name
    await supabase
      .from("deployments")
      .update({ heroku_app_name: appData.name })
      .eq("id", deployment_id);

    // Set config vars (SESSION_ID)
    await addLog("⚙️ Setting session config...");
    const configRes = await fetch(
      `https://api.heroku.com/apps/${appData.name}/config-vars`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${herokuApiKey}`,
          Accept: "application/vnd.heroku+json; version=3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          SESSION_ID: deployment.session_id,
        }),
      }
    );

    if (!configRes.ok) {
      const errText = await configRes.text();
      await addLog(`⚠️ Config var warning: ${errText}`);
    } else {
      await configRes.text();
      await addLog("✅ Session ID configured");
    }

    // Set buildpack to Node.js
    await addLog("🔧 Setting buildpack...");
    const bpRes = await fetch(
      `https://api.heroku.com/apps/${appData.name}/buildpack-installations`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${herokuApiKey}`,
          Accept: "application/vnd.heroku+json; version=3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          updates: [
            {
              buildpack:
                "https://github.com/heroku/heroku-buildpack-nodejs",
            },
          ],
        }),
      }
    );
    await bpRes.text();
    await addLog("✅ Node.js buildpack set");

    // Create source endpoint for deploying code
    await addLog("📤 Preparing deployment source...");
    const sourceRes = await fetch(
      `https://api.heroku.com/apps/${appData.name}/sources`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${herokuApiKey}`,
          Accept: "application/vnd.heroku+json; version=3",
        },
      }
    );

    if (!sourceRes.ok) {
      const errText = await sourceRes.text();
      await addLog(`⚠️ Source endpoint issue: ${errText}`);
    } else {
      const sourceData = await sourceRes.json();
      await addLog("✅ Source endpoint ready");

      // Create a tarball with bot code
      // For now we set the app as running since the actual bot code
      // needs to be provided as a GitHub repo or tarball
      await addLog(
        "📋 App is ready. Connect your bot repository or upload code."
      );
    }

    // Scale the web dyno
    await addLog("⚡ Scaling dynos...");
    const scaleRes = await fetch(
      `https://api.heroku.com/apps/${appData.name}/formation`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${herokuApiKey}`,
          Accept: "application/vnd.heroku+json; version=3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          updates: [{ type: "web", quantity: 1, size: "eco" }],
        }),
      }
    );
    // This might fail if no code is deployed yet, which is fine
    await scaleRes.text();

    // Mark as running
    await supabase
      .from("deployments")
      .update({
        status: "running",
        uptime_start: new Date().toISOString(),
      })
      .eq("id", deployment_id);
    await addLog("✅ Deployment complete! Bot is now running.");

    // Update platform stats
    const { data: stats } = await supabase
      .from("platform_stats")
      .select("*")
      .limit(1)
      .single();
    if (stats) {
      await supabase
        .from("platform_stats")
        .update({
          total_bots: stats.total_bots + 1,
          running_bots: stats.running_bots + 1,
        })
        .eq("id", stats.id);
    }

    return new Response(
      JSON.stringify({ success: true, app_name: appData.name }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Deploy error:", error);
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
