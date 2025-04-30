// Edge function to safely toggle driver availability status
// Enforces verification status checks on server-side
// Also notifies the driver when their verification status changes

import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    // Extract auth token
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
    const { driverId, isAvailable } = await req.json();
    
    if (!driverId) {
      return new Response(
        JSON.stringify({ error: "Driver ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize the Supabase client
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

    // Verify the token and get the user
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

    // Verify driver ownership or admin rights
    const { data: driverData, error: driverError } = await supabase
      .from("drivers")
      .select("user_id, verification_status")
      .eq("id", driverId)
      .single();
    
    if (driverError) {
      return new Response(
        JSON.stringify({ error: "Driver not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Check if user is either the driver owner or an admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_role")
      .eq("id", user.id)
      .single();
    
    if (userError) {
      return new Response(
        JSON.stringify({ error: "User data not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const isAdmin = userData.user_role === "admin";
    const isOwner = driverData.user_id === user.id;
    
    if (!isAdmin && !isOwner) {
      return new Response(
        JSON.stringify({ error: "Not authorized to update this driver's availability" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Check verification status (for non-admin users)
    if (!isAdmin && driverData.verification_status !== "verified") {
      return new Response(
        JSON.stringify({ 
          error: "Driver must be verified before changing availability",
          verificationStatus: driverData.verification_status
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Safe to update availability now
    let updateResult;
    if (isAdmin) {
      // Use admin function with note
      updateResult = await supabase.rpc("set_driver_availability_admin", {
        driver_id: driverId,
        new_status: isAvailable,
        note: "Admin override via API"
      });
    } else {
      // Use regular function for drivers
      updateResult = await supabase.rpc("toggle_driver_availability", {
        driver_id: driverId,
        new_status: isAvailable
      });
    }
    
    if (updateResult.error) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to update availability",
          details: updateResult.error.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        isAvailable,
        message: `Driver is now ${isAvailable ? "available" : "unavailable"}`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});