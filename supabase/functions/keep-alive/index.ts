import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all running deployments
    const { data: deployments } = await supabase
      .from("deployments")
      .select("id, heroku_app_name, status")
      .eq("status", "running")
      .not("heroku_app_name", "is", null);

    if (!deployments || deployments.length === 0) {
      return new Response(JSON.stringify({ pinged: 0, message: "No running apps" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get any valid API key to ping with
    const { data: apiKeyRow } = await supabase
      .from("heroku_keys")
      .select("api_key")
      .eq("valid", true)
      .limit(1)
      .maybeSingle();

    const envKey = Deno.env.get("HEROKU_API_KEY");
    const apiKey = apiKeyRow?.api_key || envKey;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "No API key for keep-alive" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let pinged = 0;
    const results: string[] = [];

    for (const dep of deployments) {
      if (!dep.heroku_app_name) continue;
      try {
        // Ping the app's web URL to prevent sleeping
        const pingRes = await fetch(`https://${dep.heroku_app_name}.herokuapp.com/`, {
          method: "HEAD",
          signal: AbortSignal.timeout(10000),
        });
        pinged++;
        results.push(`✅ ${dep.heroku_app_name}: ${pingRes.status}`);
      } catch (e) {
        // Also try hitting the Heroku API to check dyno state
        try {
          const dynoRes = await fetch(
            `https://api.heroku.com/apps/${dep.heroku_app_name}/dynos`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/vnd.heroku+json; version=3",
              },
            }
          );
          if (dynoRes.ok) {
            const dynos = await dynoRes.json();
            const activeDynos = dynos.filter((d: any) => d.state === "up" || d.state === "starting");
            if (activeDynos.length > 0) {
              pinged++;
              results.push(`✅ ${dep.heroku_app_name}: dyno active (${activeDynos[0].state})`);
            } else {
              results.push(`⚠️ ${dep.heroku_app_name}: no active dynos`);
              // Auto-restart idle dynos
              await fetch(
                `https://api.heroku.com/apps/${dep.heroku_app_name}/dynos`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${apiKey}`,
                    Accept: "application/vnd.heroku+json; version=3",
                  },
                }
              );
              results.push(`🔄 ${dep.heroku_app_name}: restart triggered`);
            }
          } else {
            await dynoRes.text();
            results.push(`❌ ${dep.heroku_app_name}: API check failed`);
          }
        } catch {
          results.push(`❌ ${dep.heroku_app_name}: unreachable`);
        }
      }
    }

    console.log("Keep-alive results:", results);

    return new Response(
      JSON.stringify({ pinged, total: deployments.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Keep-alive error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
