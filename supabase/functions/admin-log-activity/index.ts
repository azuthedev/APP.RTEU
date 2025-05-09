// This edge function logs admin activity for the dashboard
// It supports both driver logs and booking logs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the user making the request has admin privileges
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the user's role to verify they are an admin
    const { data: userRoleData, error: userRoleError } = await supabaseClient
      .from("users")
      .select("user_role")
      .eq("id", userData.user.id)
      .single();

    if (userRoleError || !userRoleData || userRoleData.user_role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const { bookingId, driverId, action, details } = await req.json();

    if (!action || (!bookingId && !driverId)) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result;

    // Log to the appropriate table based on what's being logged
    if (bookingId) {
      // Log booking activity
      const { data, error } = await supabaseClient
        .from("booking_activity_logs")
        .insert({
          booking_id: bookingId,
          user_id: userData.user.id,
          action,
          details,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) throw error;
      result = data;
    } 
    else if (driverId) {
      // Log driver activity
      const { data, error } = await supabaseClient
        .from("activity_logs")
        .insert({
          driver_id: driverId,
          admin_id: userData.user.id,
          action,
          details,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) throw error;
      result = data;
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in admin-log-activity:", error);

    return new Response(
      JSON.stringify({ error: error.message || "Failed to log activity" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});