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
      
    if (userError || userData?.user_role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin permissions required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse the pricing data from the request
    const requestData = await req.json();
    const vehiclePrices = Array.isArray(requestData.vehiclePrices) ? requestData.vehiclePrices : [];
    const zoneMultipliers = Array.isArray(requestData.zoneMultipliers) ? requestData.zoneMultipliers : [];
    const fixedRoutes = Array.isArray(requestData.fixedRoutes) ? requestData.fixedRoutes : [];
    
    if (!vehiclePrices.length && !zoneMultipliers.length && !fixedRoutes.length) {
      return new Response(
        JSON.stringify({ error: "Missing required pricing data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const successResults = {
      vehiclePrices: { success: 0, error: 0 },
      zoneMultipliers: { success: 0, error: 0 },
      fixedRoutes: { success: 0, error: 0 }
    };

    // Process vehicle base prices
    for (const price of vehiclePrices) {
      try {
        if (!price) continue;
        
        if (price.id && price.id.startsWith('new_')) {
          // It's a new record, insert it
          const { id, ...newPrice } = price;
          
          // Store the previous state for logging
          const previousValue = { vehicle_type: '', base_price_per_km: 0 };
          
          const { error: insertError } = await supabaseAdmin
            .from("vehicle_base_prices")
            .insert(newPrice);
            
          if (insertError) throw insertError;
          
          // Log the pricing change
          await supabaseAdmin.from("pricing_change_logs").insert({
            changed_by: user.id,
            change_type: 'base_price',
            previous_value: previousValue,
            new_value: newPrice,
            notes: 'New vehicle base price added'
          });
          
          successResults.vehiclePrices.success++;
        } else if (price.id) {
          // Get current value for logging
          const { data: currentPrice, error: fetchError } = await supabaseAdmin
            .from("vehicle_base_prices")
            .select('*')
            .eq('id', price.id)
            .single();
            
          if (fetchError) {
            console.error(`Error fetching current price for ${price.id}:`, fetchError);
            successResults.vehiclePrices.error++;
            continue;
          }
          
          // Extract ID and update the record
          const { id, ...updatePrice } = price;
          
          const { error: updateError } = await supabaseAdmin
            .from("vehicle_base_prices")
            .update(updatePrice)
            .eq("id", id);
            
          if (updateError) throw updateError;
          
          // Log the change if values changed
          if (
            currentPrice.vehicle_type !== price.vehicle_type || 
            parseFloat(currentPrice.base_price_per_km) !== parseFloat(price.base_price_per_km)
          ) {
            await supabaseAdmin.from("pricing_change_logs").insert({
              changed_by: user.id,
              change_type: 'base_price',
              previous_value: currentPrice,
              new_value: updatePrice,
              notes: 'Vehicle base price updated'
            });
          }
          
          successResults.vehiclePrices.success++;
        }
      } catch (error) {
        console.error('Error processing vehicle price:', error);
        successResults.vehiclePrices.error++;
        // Continue with other items
      }
    }

    // Process zone multipliers
    for (const multiplier of zoneMultipliers) {
      try {
        if (!multiplier) continue;
        
        if (multiplier.id && multiplier.id.startsWith('new_')) {
          // It's a new record, insert it
          const { id, ...newMultiplier } = multiplier;
          
          // Store previous value for logging
          const previousValue = { zone_id: multiplier.zone_id, multiplier: 1.0 };
          
          const { error: insertError } = await supabaseAdmin
            .from("zone_multipliers")
            .insert(newMultiplier);
            
          if (insertError) throw insertError;
          
          // Log the pricing change
          await supabaseAdmin.from("pricing_change_logs").insert({
            changed_by: user.id,
            change_type: 'zone_multiplier',
            previous_value: previousValue,
            new_value: newMultiplier,
            notes: 'New zone multiplier added'
          });
          
          successResults.zoneMultipliers.success++;
        } else if (multiplier.id) {
          // Get current value for logging
          const { data: currentMultiplier, error: fetchError } = await supabaseAdmin
            .from("zone_multipliers")
            .select('*')
            .eq('id', multiplier.id)
            .single();
            
          if (fetchError) {
            console.error(`Error fetching current multiplier for ${multiplier.id}:`, fetchError);
            successResults.zoneMultipliers.error++;
            continue;
          }
          
          // Extract ID and update
          const { id, ...updateMultiplier } = multiplier;
          
          const { error: updateError } = await supabaseAdmin
            .from("zone_multipliers")
            .update(updateMultiplier)
            .eq("id", id);
            
          if (updateError) throw updateError;
          
          // Log the change if values changed
          if (
            currentMultiplier.zone_id !== multiplier.zone_id ||
            parseFloat(currentMultiplier.multiplier) !== parseFloat(multiplier.multiplier)
          ) {
            await supabaseAdmin.from("pricing_change_logs").insert({
              changed_by: user.id,
              change_type: 'zone_multiplier',
              previous_value: currentMultiplier,
              new_value: updateMultiplier,
              notes: 'Zone multiplier updated'
            });
          }
          
          successResults.zoneMultipliers.success++;
        }
      } catch (error) {
        console.error('Error processing zone multiplier:', error);
        successResults.zoneMultipliers.error++;
        // Continue with other items
      }
    }

    // Process fixed routes
    for (const route of fixedRoutes) {
      try {
        if (!route) continue;
        
        if (route.id && route.id.startsWith('new_')) {
          // It's a new record, insert it
          const { id, ...newRoute } = route;
          
          // Store previous value for logging
          const previousValue = { origin_name: '', destination_name: '', vehicle_type: '', fixed_price: 0 };
          
          const { error: insertError } = await supabaseAdmin
            .from("fixed_routes")
            .insert(newRoute);
            
          if (insertError) throw insertError;
          
          // Log the pricing change
          await supabaseAdmin.from("pricing_change_logs").insert({
            changed_by: user.id,
            change_type: 'fixed_route',
            previous_value: previousValue,
            new_value: newRoute,
            notes: 'New fixed route added'
          });
          
          successResults.fixedRoutes.success++;
        } else if (route.id) {
          // Get current value for logging
          const { data: currentRoute, error: fetchError } = await supabaseAdmin
            .from("fixed_routes")
            .select('*')
            .eq('id', route.id)
            .single();
            
          if (fetchError) {
            console.error(`Error fetching current route for ${route.id}:`, fetchError);
            successResults.fixedRoutes.error++;
            continue;
          }
          
          // Extract ID and update
          const { id, ...updateRoute } = route;
          
          const { error: updateError } = await supabaseAdmin
            .from("fixed_routes")
            .update(updateRoute)
            .eq("id", id);
            
          if (updateError) throw updateError;
          
          // Log the change if values changed
          if (
            currentRoute.origin_name !== route.origin_name ||
            currentRoute.destination_name !== route.destination_name ||
            currentRoute.vehicle_type !== route.vehicle_type ||
            parseFloat(currentRoute.fixed_price) !== parseFloat(route.fixed_price)
          ) {
            await supabaseAdmin.from("pricing_change_logs").insert({
              changed_by: user.id,
              change_type: 'fixed_route',
              previous_value: currentRoute,
              new_value: updateRoute,
              notes: 'Fixed route updated'
            });
          }
          
          successResults.fixedRoutes.success++;
        }
      } catch (error) {
        console.error('Error processing fixed route:', error);
        successResults.fixedRoutes.error++;
        // Continue with other items
      }
    }

    // Refresh the pricing cache by calling the refresh endpoint
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/refresh-pricing-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (cacheError) {
      console.warn("Error refreshing pricing cache:", cacheError);
      // Continue anyway since changes were still applied
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Pricing data updated successfully",
        results: successResults
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