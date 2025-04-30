import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract token
    const token = authHeader.replace("Bearer ", "");
    
    // Create Supabase admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      {
        auth: {
          persistSession: false,
        }
      }
    );
    
    // Use admin client to verify the JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token", details: authError }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if the user is an admin or support
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("user_role")
      .eq("id", user.id)
      .single();
      
    if (userError) {
      return new Response(
        JSON.stringify({ error: "Error checking user role", details: userError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (userData?.user_role !== "admin" && userData?.user_role !== "support") {
      return new Response(
        JSON.stringify({ error: "Admin or support permissions required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Get all auth users using the admin client
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      return new Response(
        JSON.stringify({ error: "Error fetching auth users", details: usersError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Calculate time ranges
    const now = new Date();
    const last24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const last7d = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const last30d = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Count sign-ins within each time range
    let logins24h = 0;
    let logins7d = 0;
    let logins30d = 0;
    
    if (usersData?.users) {
      usersData.users.forEach(user => {
        if (user.last_sign_in_at) {
          const signInDate = new Date(user.last_sign_in_at);
          
          if (signInDate >= last24h) {
            logins24h++;
          }
          
          if (signInDate >= last7d) {
            logins7d++;
          }
          
          if (signInDate >= last30d) {
            logins30d++;
          }
        }
      });
    }
    
    // Log the request for audit purposes
    try {
      await supabaseAdmin.from("log_queries").insert({
        user_id: user.id,
        source: "login",
        query: "login_stats",
        created_at: new Date().toISOString(),
        results_count: usersData?.users?.length || 0,
        time_range: "last_30_days"
      });
    } catch (logError) {
      console.warn("Failed to log query:", logError);
      // Continue anyway, this is not critical
    }
    
    return new Response(
      JSON.stringify({ 
        logins24h,
        logins7d,
        logins30d,
        total_users: usersData?.users?.length || 0
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in get-login-stats function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "An error occurred while fetching login statistics",
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});