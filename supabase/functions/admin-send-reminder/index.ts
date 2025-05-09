// This edge function sends a reminder for a booking
// It uses service role to bypass RLS policies

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
    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: bookingId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from("trips")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update the booking to record the reminder
    const now = new Date().toISOString();
    const { data: updatedBooking, error } = await supabaseClient
      .from("trips")
      .update({ 
        last_reminder_sent: now,
        // Increase priority level if not already urgent
        priority: booking.priority < 2 ? Math.max(booking.priority || 0, 1) : booking.priority
      })
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
      action: "reminder_sent",
      details: { 
        timestamp: now,
        recipient: booking.customer_email
      },
      created_at: now
    });

    // In a real scenario, you would send an actual email here
    // This is a placeholder for that logic
    console.log(`Reminder would be sent to ${booking.customer_email} for booking ${booking.booking_reference}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Reminder sent to ${booking.customer_email}`,
        data: updatedBooking
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in admin-send-reminder:", error);

    return new Response(
      JSON.stringify({ error: error.message || "Failed to send reminder" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});