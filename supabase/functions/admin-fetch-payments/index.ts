// This edge function fetches payment data for admin dashboard
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

    // Parse URL to get query parameters
    const url = new URL(req.url);
    const dateFilter = url.searchParams.get("since_date");
    const statusFilter = url.searchParams.get("status");
    
    // Build query for payments
    let query = supabaseAdmin
      .from("payments")
      .select(`
        *,
        user:users!payments_user_id_fkey(name, email),
        trip:trips!payments_trip_id_fkey(booking_reference, pickup_address, dropoff_address)
      `);
    
    // Add date filter if provided
    if (dateFilter) {
      query = query.gte("created_at", dateFilter);
    }
    
    // Add status filter if provided
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }
    
    // Order by created_at descending
    query = query.order("created_at", { ascending: false });
    
    // Execute the query
    const { data: payments, error: paymentsError } = await query;

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch payments", details: paymentsError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify(payments),
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