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

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      {
        auth: {
          persistSession: false,
        }
      }
    );

    // Verify the JWT token
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
      
    if (userError || userData?.user_role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin permissions required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const { origin, destination, vehicleType } = await req.json();
    
    if (!origin || !destination || !vehicleType) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check for fixed route first
    const { data: fixedRoute } = await supabaseAdmin
      .from("fixed_routes")
      .select("*")
      .eq("origin_name", origin)
      .eq("destination_name", destination)
      .eq("vehicle_type", vehicleType)
      .maybeSingle();

    if (fixedRoute) {
      return new Response(
        JSON.stringify({
          distance: 0, // Not applicable for fixed routes
          basePrice: fixedRoute.fixed_price,
          zoneMultiplier: 1,
          finalPrice: fixedRoute.fixed_price,
          breakdown: [
            {
              description: "Fixed Route Price",
              amount: fixedRoute.fixed_price
            }
          ],
          isFixedRoute: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get base price for vehicle type
    const { data: vehiclePrice } = await supabaseAdmin
      .from("vehicle_base_prices")
      .select("base_price_per_km")
      .eq("vehicle_type", vehicleType)
      .single();

    if (!vehiclePrice) {
      return new Response(
        JSON.stringify({ error: "Vehicle type not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Simulate distance calculation (in a real app, use Google Maps API)
    const simulatedDistance = Math.floor(Math.random() * 50) + 10; // 10-60km
    const basePrice = vehiclePrice.base_price_per_km * simulatedDistance;

    // Get zone multiplier (simplified - in reality, would need proper zone detection)
    const zoneMultiplier = 1.2; // Example multiplier

    const finalPrice = basePrice * zoneMultiplier;

    return new Response(
      JSON.stringify({
        distance: simulatedDistance,
        basePrice,
        zoneMultiplier,
        finalPrice,
        breakdown: [
          {
            description: `Base Rate (${simulatedDistance}km × €${vehiclePrice.base_price_per_km}/km)`,
            amount: basePrice
          },
          {
            description: "Zone Multiplier Adjustment",
            amount: basePrice * (zoneMultiplier - 1)
          }
        ],
        isFixedRoute: false
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