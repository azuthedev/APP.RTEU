// This edge function updates booking data for admin dashboard
// It uses service role to bypass RLS policies

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
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
    const { bookingId, data } = await req.json();

    if (!bookingId || !data) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update the booking
    const { data: updatedBooking, error } = await supabaseClient
      .from("trips")
      .update(data)
      .eq("id", bookingId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the activity
    await supabaseClient.from("booking_activity_logs").insert({
      booking_id: bookingId,
      user_id: userData.user.id,
      action: "admin_updated_booking",
      details: { fields_updated: Object.keys(data) },
      created_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ success: true, data: updatedBooking }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in admin-update-booking:", error);

    return new Response(
      JSON.stringify({ error: error.message || "Failed to update booking" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});