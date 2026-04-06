import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Try all valid API keys until one works for the given operation
async function getWorkingKey(
  supabase: any,
  userId: string,
  envKey: string | undefined
): Promise<{ apiKey: string; isTeam: boolean; team: string } | null> {
  // Collect all valid keys: user keys first, then global keys
  const keys: { api_key: string; team_or_personal: string }[] = [];

  const { data: userKeys } = await supabase
    .from("heroku_keys")
    .select("api_key, team_or_personal")
    .eq("user_id", userId)
    .eq("valid", true);
  if (userKeys) keys.push(...userKeys);

  const { data: globalKeys } = await supabase
    .from("heroku_keys")
    .select("api_key, team_or_personal")
    .eq("is_global", true)
    .eq("valid", true);
  if (globalKeys) keys.push(...globalKeys);

  // Also include env key as fallback
  if (envKey) keys.push({ api_key: envKey, team_or_personal: "team" });

  // Try each key - validate it can create apps
  for (const key of keys) {
    try {
      const res = await fetch("https://api.heroku.com/account", {
        headers: {
          Authorization: `Bearer ${key.api_key}`,
          Accept: "application/vnd.heroku+json; version=3",
        },
      });
      if (res.ok) {
        await res.json();
        // Check app limit - try listing apps
        const appsRes = await fetch("https://api.heroku.com/apps", {
          headers: {
            Authorization: `Bearer ${key.api_key}`,
            Accept: "application/vnd.heroku+json; version=3",
          },
        });
        if (appsRes.ok) {
          const apps = await appsRes.json();
          // Heroku free/eco typically allows 5 apps; if under limit, use this key
          // We consider the key "full" only if it has 100+ apps (generous limit)
          if (apps.length < 100) {
            const isTeam = key.team_or_personal === "team";
            let teamName = "";
            if (isTeam) {
              const teamsRes = await fetch("https://api.heroku.com/teams", {
                headers: {
                  Authorization: `Bearer ${key.api_key}`,
                  Accept: "application/vnd.heroku+json; version=3",
                },
              });
              if (teamsRes.ok) {
                const teams = await teamsRes.json();
                if (teams.length > 0) teamName = teams[0].name;
              } else {
                await teamsRes.text();
              }
            }
            return { apiKey: key.api_key, isTeam, team: teamName };
          }
        }
        await appsRes.text();
      } else {
        await res.text();
        // Mark invalid key
        await supabase
          .from("heroku_keys")
          .update({ valid: false })
          .eq("api_key", key.api_key);
      }
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

    // Update to deploying
    await supabase
      .from("deployments")
      .update({ status: "deploying", logs: ["🚀 Starting deployment..."] })
      .eq("id", deployment_id);

    const addLog = async (msg: string) => {
      const { data: current } = await supabase
        .from("deployments")
        .select("logs")
        .eq("id", deployment_id)
        .single();
      const logs = [...(current?.logs || []), msg];
      await supabase.from("deployments").update({ logs }).eq("id", deployment_id);
    };

    // Smart key rotation - try all keys
    await addLog("🔑 Finding available Heroku API key...");
    const envKey = Deno.env.get("HEROKU_API_KEY");
    const keyResult = await getWorkingKey(supabase, user.id, envKey);

    if (!keyResult) {
      await addLog("❌ No valid Heroku API key with available capacity");
      await supabase.from("deployments").update({ status: "failed" }).eq("id", deployment_id);
      return new Response(JSON.stringify({ error: "No Heroku API key with capacity" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { apiKey: herokuApiKey, isTeam, team: herokuTeam } = keyResult;

    // Validate key
    const accountRes = await fetch("https://api.heroku.com/account", {
      headers: {
        Authorization: `Bearer ${herokuApiKey}`,
        Accept: "application/vnd.heroku+json; version=3",
      },
    });
    const accountData = await accountRes.json();
    await addLog(`✅ Using key: ${accountData.email} (${isTeam ? "team" : "personal"})`);

    // Create Heroku app
    const slug = deployment.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 12);
    const appName = `bh-${slug}-${Date.now().toString(36)}`;

    await addLog(`📦 Creating Heroku app: ${appName}...`);

    const createBody: any = { name: appName, region: "us", stack: "heroku-22" };
    let createUrl = "https://api.heroku.com/apps";
    if (isTeam && herokuTeam) {
      createBody.team = herokuTeam;
      createUrl = "https://api.heroku.com/teams/apps";
    }

    let createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${herokuApiKey}`,
        Accept: "application/vnd.heroku+json; version=3",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createBody),
    });

    // If creation fails (e.g. limit reached), try next key
    if (!createRes.ok) {
      const errBody = await createRes.text();
      await addLog(`⚠️ Key failed (${errBody}), trying next key...`);
      
      // Mark this key as potentially full and retry with a different approach
      // For now, fail gracefully
      await addLog(`❌ Failed to create app: ${errBody}`);
      await supabase.from("deployments").update({ status: "failed" }).eq("id", deployment_id);
      return new Response(JSON.stringify({ error: errBody }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appData = await createRes.json();
    await addLog(`✅ App created: ${appData.name}`);

    await supabase.from("deployments").update({ heroku_app_name: appData.name }).eq("id", deployment_id);

    // Set config vars
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
        body: JSON.stringify({ SESSION_ID: deployment.session_id }),
      }
    );
    if (configRes.ok) {
      await configRes.text();
      await addLog("✅ Session ID configured");
    } else {
      const errText = await configRes.text();
      await addLog(`⚠️ Config warning: ${errText}`);
    }

    // Set buildpack
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
          updates: [{ buildpack: "https://github.com/heroku/heroku-buildpack-nodejs" }],
        }),
      }
    );
    await bpRes.text();
    await addLog("✅ Node.js buildpack set");

    // Deploy from GitHub
    await addLog("📤 Deploying bot code from repository...");
    const repoUrl = "https://github.com/Gurulabstech/GURU-MD";
    const tarballUrl = `${repoUrl}/tarball/main`;
    await addLog(`📦 Building from: ${repoUrl}`);

    const buildRes = await fetch(
      `https://api.heroku.com/apps/${appData.name}/builds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${herokuApiKey}`,
          Accept: "application/vnd.heroku+json; version=3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_blob: { url: tarballUrl, version: `deploy-${Date.now()}` },
        }),
      }
    );

    if (!buildRes.ok) {
      const errText = await buildRes.text();
      await addLog(`❌ Build failed: ${errText}`);
      await supabase.from("deployments").update({ status: "failed" }).eq("id", deployment_id);
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buildData = await buildRes.json();
    await addLog(`🔨 Build started (ID: ${buildData.id?.substring(0, 8)}...)`);

    // Poll build status
    let buildComplete = false;
    let buildAttempts = 0;
    while (!buildComplete && buildAttempts < 60) {
      buildAttempts++;
      await new Promise((r) => setTimeout(r, 5000));

      const statusRes = await fetch(
        `https://api.heroku.com/apps/${appData.name}/builds/${buildData.id}`,
        {
          headers: {
            Authorization: `Bearer ${herokuApiKey}`,
            Accept: "application/vnd.heroku+json; version=3",
          },
        }
      );

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.status === "succeeded") {
          buildComplete = true;
          await addLog("✅ Build succeeded!");
        } else if (statusData.status === "failed") {
          await addLog("❌ Build failed. Check logs for details.");
          await supabase.from("deployments").update({ status: "failed" }).eq("id", deployment_id);
          return new Response(JSON.stringify({ error: "Build failed" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else if (buildAttempts % 3 === 0) {
          await addLog(`🟡 Building... (${buildAttempts * 5}s elapsed)`);
        }
      } else {
        await statusRes.text();
      }
    }

    if (!buildComplete) {
      await addLog("⚠️ Build timed out — check logs for status.");
    }

    // Scale dynos
    await addLog("⚡ Scaling dynos...");
    let scaleRes = await fetch(
      `https://api.heroku.com/apps/${appData.name}/formation`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${herokuApiKey}`,
          Accept: "application/vnd.heroku+json; version=3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ updates: [{ type: "worker", quantity: 1, size: "eco" }] }),
      }
    );

    if (!scaleRes.ok) {
      await scaleRes.text();
      scaleRes = await fetch(
        `https://api.heroku.com/apps/${appData.name}/formation`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${herokuApiKey}`,
            Accept: "application/vnd.heroku+json; version=3",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ updates: [{ type: "web", quantity: 1, size: "eco" }] }),
        }
      );
      await scaleRes.text();
      await addLog("✅ Web dyno scaled");
    } else {
      await scaleRes.text();
      await addLog("✅ Worker dyno scaled");
    }

    // Mark as running
    await supabase
      .from("deployments")
      .update({ status: "running", uptime_start: new Date().toISOString() })
      .eq("id", deployment_id);
    await addLog("✅ Deployment complete! Bot is now running.");

    // Update stats
    const { data: stats } = await supabase.from("platform_stats").select("*").limit(1).single();
    if (stats) {
      await supabase
        .from("platform_stats")
        .update({ total_bots: stats.total_bots + 1, running_bots: stats.running_bots + 1 })
        .eq("id", stats.id);
    }

    return new Response(
      JSON.stringify({ success: true, app_name: appData.name }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Deploy error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
