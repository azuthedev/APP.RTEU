// This edge function duplicates a booking for admin dashboard
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

    // Get the original booking
    const { data: originalBooking, error: fetchError } = await supabaseClient
      .from("trips")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (fetchError || !originalBooking) {
      return new Response(
        JSON.stringify({ error: "Original booking not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create a new booking reference
    const newBookingReference = `DUP-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Create a new booking with the same details but a new reference
    const newBooking = {
      user_id: originalBooking.user_id,
      pickup_zone_id: originalBooking.pickup_zone_id,
      dropoff_zone_id: originalBooking.dropoff_zone_id,
      pickup_address: originalBooking.pickup_address,
      dropoff_address: originalBooking.dropoff_address,
      estimated_distance_km: originalBooking.estimated_distance_km,
      estimated_duration_min: originalBooking.estimated_duration_min,
      estimated_price: originalBooking.estimated_price,
      status: 'pending',
      datetime: new Date().toISOString(), // Default to current time
      booking_reference: newBookingReference,
      customer_name: originalBooking.customer_name,
      customer_email: originalBooking.customer_email,
      customer_phone: originalBooking.customer_phone,
      notes: `Duplicated from ${originalBooking.booking_reference} on ${new Date().toLocaleDateString()}. ${originalBooking.notes || ''}`,
      priority: 0, // Reset priority
      created_at: new Date().toISOString()
    };

    // Insert the new booking
    const { data: insertedBooking, error: insertError } = await supabaseClient
      .from("trips")
      .insert([newBooking])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Log the activity
    await supabaseClient.from("booking_activity_logs").insert({
      booking_id: bookingId,
      user_id: userData.user.id,
      action: "booking_duplicated",
      details: {
        new_booking_id: insertedBooking.id,
        new_booking_reference: insertedBooking.booking_reference,
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify(insertedBooking),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in admin-duplicate-booking:", error);

    return new Response(
      JSON.stringify({ error: error.message || "Failed to duplicate booking" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});