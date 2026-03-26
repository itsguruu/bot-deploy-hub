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

    if (!deployment) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership or admin
    if (deployment.user_id !== user.id) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Delete Heroku app if exists
    if (deployment.heroku_app_name) {
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

      if (apiKey) {
        const deleteRes = await fetch(
          `https://api.heroku.com/apps/${deployment.heroku_app_name}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: "application/vnd.heroku+json; version=3",
            },
          }
        );
        await deleteRes.text();
      }
    }

    // Delete deployment record
    await supabase.from("deployments").delete().eq("id", deployment_id);

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
          total_bots: Math.max(0, stats.total_bots - 1),
          running_bots:
            deployment.status === "running"
              ? Math.max(0, stats.running_bots - 1)
              : stats.running_bots,
        })
        .eq("id", stats.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Delete error:", error);
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
