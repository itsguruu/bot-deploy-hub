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
    const herokuApiKey = Deno.env.get("HEROKU_API_KEY");
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

    // Get API key - prefer user's own, fall back to global
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
        body: JSON.stringify({
          lines: 100,
          tail: false,
        }),
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

    // Fetch the actual log content
    const logContentRes = await fetch(logData.logplex_url);
    const logContent = await logContentRes.text();

    const logLines = logContent
      .split("\n")
      .filter((l: string) => l.trim())
      .slice(-50);

    // Update deployment logs in DB (realtime will push to client)
    const existingLogs = deployment.logs || [];
    const newLogs = [...existingLogs, ...logLines].slice(-100);

    await supabase
      .from("deployments")
      .update({ logs: newLogs })
      .eq("id", deployment_id);

    return new Response(JSON.stringify({ logs: newLogs }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
