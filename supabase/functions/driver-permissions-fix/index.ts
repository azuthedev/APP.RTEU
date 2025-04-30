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
    // Get the request parameters
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with admin privileges
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { persistSession: false } }
    );

    // Check if a driver record already exists
    const { data: existingDriver, error: checkError } = await supabaseAdmin
      .from("drivers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

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

    // If driver record exists, return it
    if (existingDriver) {
      return new Response(
        JSON.stringify({ success: true, driverId: existingDriver.id }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user exists and is a partner
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("user_role")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (userData.user_role !== "partner") {
      return new Response(
        JSON.stringify({ error: "Only partner users can create driver profiles" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create a new driver record
    const { data: newDriver, error: createError } = await supabaseAdmin
      .from("drivers")
      .insert({
        user_id: userId,
        verification_status: "unverified",
        is_available: false,
      })
      .select("id")
      .single();

    if (createError) {
      console.error("Error creating driver:", createError);
      return new Response(
        JSON.stringify({ error: "Failed to create driver profile" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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