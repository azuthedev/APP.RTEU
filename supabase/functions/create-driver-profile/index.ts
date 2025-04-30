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

    // Initialize Supabase client with token for user authentication
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

    // Verify user and check if they are a partner
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

    // Check if user is a partner
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_role")
      .eq("id", user.id)
      .single();
      
    if (userError) {
      return new Response(
        JSON.stringify({ error: "Failed to verify user role" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (userData.user_role !== "partner" && userData.user_role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only partners can create driver profiles" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if driver profile already exists
    const { data: existingDriver, error: checkError } = await supabase
      .rpc("get_user_driver_id");
      
    if (checkError) {
      console.error("Error checking existing driver:", checkError);
      return new Response(
        JSON.stringify({ error: "Error checking driver status" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // If driver profile already exists, return it
    if (existingDriver) {
      return new Response(
        JSON.stringify({ success: true, driverId: existingDriver, message: "Driver profile already exists" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create new driver profile with initial verification status of 'unverified'
    const { data: newDriver, error: createError } = await supabase
      .from("drivers")
      .insert({
        user_id: user.id,
        verification_status: "unverified",
        is_available: false,
      })
      .select("id")
      .single();
      
    if (createError) {
      console.error("Error creating driver profile:", createError);
      
      // Initialize admin client to check for permission errors
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        { auth: { persistSession: false } }
      );
      
      // If permission error, use admin client to create the profile
      if (createError.code === "42501" || createError.message.includes("permission denied")) {
        const { data: adminCreatedDriver, error: adminError } = await supabaseAdmin
          .from("drivers")
          .insert({
            user_id: user.id,
            verification_status: "unverified",
            is_available: false,
          })
          .select("id")
          .single();
          
        if (adminError) {
          console.error("Admin fallback error:", adminError);
          return new Response(
            JSON.stringify({ error: "Failed to create driver profile" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        // Log the creation for audit purposes
        await supabaseAdmin
          .from("activity_logs")
          .insert({
            driver_id: adminCreatedDriver.id,
            action: "driver_profile_created",
            details: {
              method: "edge_function",
              created_by: user.id,
              created_at: new Date().toISOString()
            }
          });
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            driverId: adminCreatedDriver.id,
            message: "Driver profile created successfully by admin" 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to create driver profile" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log the creation for audit purposes
    await supabase
      .from("activity_logs")
      .insert({
        driver_id: newDriver.id,
        action: "driver_profile_created",
        details: {
          method: "edge_function",
          created_at: new Date().toISOString()
        }
      })
      .catch(error => {
        console.warn("Error logging activity:", error);
        // Continue anyway, this is not critical
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        driverId: newDriver.id,
        message: "Driver profile created successfully" 
      }),
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