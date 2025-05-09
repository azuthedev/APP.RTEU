// This edge function fetches pending driver verification data for admin dashboard
// It uses the service role to bypass RLS policies

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

    // Check if user is admin
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
    
    if (userData?.user_role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse URL to get verification status filter
    const url = new URL(req.url);
    const verificationStatus = url.searchParams.get("verification_status") || "pending";
    
    // Fetch drivers with the specified verification status
    const { data: pendingDrivers, error: driversError } = await supabaseAdmin
      .from("drivers")
      .select(`
        *,
        user:users!drivers_user_id_fkey(id, name, email, phone, user_role),
        vehicle:vehicles(make, model, plate_number)
      `)
      .eq("verification_status", verificationStatus)
      .order("created_at", { ascending: false });

    if (driversError) {
      console.error("Error fetching pending drivers:", driversError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch pending drivers", details: driversError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // For each driver, get their document count
    const driversWithDocCounts = await Promise.all((pendingDrivers || []).map(async (driver) => {
      const { count, error: countError } = await supabaseAdmin
        .from("driver_documents")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", driver.id);
          
      return {
        ...driver,
        _documentCount: countError ? 0 : (count || 0)
      };
    }));

    return new Response(
      JSON.stringify(driversWithDocCounts),
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