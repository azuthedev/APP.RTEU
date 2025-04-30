import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get authentication token from request header
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

    const token = authHeader.replace("Bearer ", "");

    // Initialize Supabase client with token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Verify user and check admin status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_role")
      .eq("id", user.id)
      .single();
      
    if (userError || userData?.user_role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin permissions required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use SERVICE_ROLE key for elevated permissions
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      {
        auth: {
          persistSession: false,
        }
      }
    );

    // Fetch platform settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("platform_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching platform settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch platform settings" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If no settings exist yet, create default settings
    if (!settings) {
      const defaultSettings = {
        default_currency: "EUR",
        default_timezone: "Europe/Berlin",
        booking_auto_assign: false,
        driver_verification_required: true,
        admin_email_notifications: true,
        email_from_name: "Royal Transfer",
        email_contact_address: "support@royaltransfer.eu",
        privacy_policy_url: "https://royaltransfer.eu/privacy",
        terms_url: "https://royaltransfer.eu/terms",
        max_failed_login_attempts: 5,
        maintenance_mode: false,
        api_rate_limit: 60,
        min_password_length: 8,
        auto_archive_days: 90,
        last_updated_by: user.id,
        last_updated_at: new Date().toISOString()
      };
      
      const { data: newSettings, error: insertError } = await supabaseAdmin
        .from("platform_settings")
        .insert(defaultSettings)
        .select()
        .single();
        
      if (insertError) {
        console.error("Error inserting default settings:", insertError);
        return new Response(
          JSON.stringify({ 
            error: "Failed to create default settings",
            defaultSettings
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify(newSettings),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify(settings),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});