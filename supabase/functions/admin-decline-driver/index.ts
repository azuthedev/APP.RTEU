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
    
    // Parse request body
    const { driverId, declineReason } = await req.json();
    
    if (!driverId) {
      return new Response(
        JSON.stringify({ error: "Driver ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
    
    // Check if driver exists
    const { data: driverData, error: driverCheckError } = await supabaseAdmin
      .from("drivers")
      .select("id, is_available")
      .eq("id", driverId)
      .single();
      
    if (driverCheckError || !driverData) {
      return new Response(
        JSON.stringify({ error: "Driver not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update driver status to declined and store the reason
    const { error: updateError } = await supabaseAdmin
      .from("drivers")
      .update({
        verification_status: 'declined',
        decline_reason: declineReason || "Your verification was declined. Please contact support.",
      })
      .eq("id", driverId);

    if (updateError) {
      console.error("Error updating driver:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update driver verification status" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If the driver was available, set them to unavailable
    if (driverData.is_available) {
      const { error: availError } = await supabaseAdmin
        .from("drivers")
        .update({
          is_available: false
        })
        .eq("id", driverId);
        
      if (availError) {
        console.warn("Warning: Error setting driver to unavailable:", availError);
      }
    }
    
    // Log the decline action
    await supabaseAdmin.from("activity_logs").insert({
      driver_id: driverId,
      admin_id: user.id,
      action: "driver_declined",
      details: {
        timestamp: new Date().toISOString(),
        verification_status: "declined",
        reason: declineReason || "No reason provided"
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Driver verification declined"
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