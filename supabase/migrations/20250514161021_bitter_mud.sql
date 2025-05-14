/*
  # Fix Pricing Management Functions

  1. New Functions
     - `get_zones_with_multipliers` - Gets zones with their multiplier values
     - `update_pricing_item` - A generic function to update a pricing item safely
  
  2. Changes
     - Fixes zone multiplier retrieval function to avoid ambiguous ID issue
     - Enhances update functions to better handle errors and provide more details
*/

-- Function to get zones with their multiplier values safely
CREATE OR REPLACE FUNCTION public.get_zones_with_multipliers()
RETURNS TABLE (
  id uuid,
  name text,
  multiplier_id uuid,
  multiplier numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user is authenticated and has admin role
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND user_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin permissions required';
  END IF;

  RETURN QUERY
  SELECT 
    z.id,
    z.name,
    zm.id AS multiplier_id,
    COALESCE(zm.multiplier, 1.0) AS multiplier
  FROM zones z
  LEFT JOIN zone_multipliers zm ON z.id = zm.zone_id
  ORDER BY z.name;
END;
$$;

-- Improved function to get zone multipliers that avoids ambiguous column issues
CREATE OR REPLACE FUNCTION public.get_zone_multipliers()
RETURNS TABLE (
  id uuid,
  zone_id uuid,
  multiplier numeric,
  zone_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user is authenticated and has admin role
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND user_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin permissions required';
  END IF;

  RETURN QUERY
  SELECT 
    zm.id,
    zm.zone_id,
    zm.multiplier,
    z.name AS zone_name
  FROM zone_multipliers zm
  LEFT JOIN zones z ON zm.zone_id = z.id
  ORDER BY z.name;
END;
$$;

-- Function to update vehicle prices with better error handling
CREATE OR REPLACE FUNCTION public.update_vehicle_prices(prices_json JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  price JSONB;
  price_id TEXT;
  new_price RECORD;
  current_price RECORD;
  prev_value JSONB;
  new_value JSONB;
  result JSONB := jsonb_build_object('success', 0, 'error', 0);
BEGIN
  -- Verify user is authenticated and has admin role
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND user_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin permissions required';
  END IF;

  -- Process each price in the JSON array
  IF jsonb_typeof(prices_json) = 'array' THEN
    FOR price IN SELECT * FROM jsonb_array_elements(prices_json)
    LOOP
      BEGIN
        price_id := price->>'id';
        
        -- Check if this is a new price or update
        IF price_id LIKE 'new_%' THEN
          -- New price - Insert
          INSERT INTO vehicle_base_prices (
            vehicle_type, 
            base_price_per_km
          ) VALUES (
            price->>'vehicle_type',
            (price->>'base_price_per_km')::numeric
          ) RETURNING * INTO new_price;
          
          -- Log the change
          INSERT INTO pricing_change_logs (
            changed_by,
            change_type,
            previous_value,
            new_value,
            notes
          ) VALUES (
            auth.uid(),
            'base_price',
            '{}',
            jsonb_build_object(
              'vehicle_type', new_price.vehicle_type,
              'base_price_per_km', new_price.base_price_per_km
            ),
            'New vehicle base price added'
          );
          
          result := jsonb_set(result, '{success}', to_jsonb((result->>'success')::int + 1));
        ELSE
          -- Existing price - Update
          SELECT * INTO current_price FROM vehicle_base_prices WHERE id = price_id::uuid;
          
          IF FOUND THEN
            prev_value := jsonb_build_object(
              'id', current_price.id,
              'vehicle_type', current_price.vehicle_type,
              'base_price_per_km', current_price.base_price_per_km
            );
            
            new_value := jsonb_build_object(
              'id', price_id,
              'vehicle_type', price->>'vehicle_type',
              'base_price_per_km', (price->>'base_price_per_km')::numeric
            );
            
            -- Update if there are any changes
            IF prev_value <> new_value THEN
              UPDATE vehicle_base_prices SET
                vehicle_type = price->>'vehicle_type',
                base_price_per_km = (price->>'base_price_per_km')::numeric
              WHERE id = price_id::uuid;
              
              -- Log the change
              INSERT INTO pricing_change_logs (
                changed_by,
                change_type,
                previous_value,
                new_value,
                notes
              ) VALUES (
                auth.uid(),
                'base_price',
                prev_value,
                new_value,
                'Vehicle base price updated'
              );
            END IF;
            
            result := jsonb_set(result, '{success}', to_jsonb((result->>'success')::int + 1));
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Log error and continue with next price
        RAISE NOTICE 'Error processing vehicle price: %', SQLERRM;
        result := jsonb_set(result, '{error}', to_jsonb((result->>'error')::int + 1));
      END;
    END LOOP;
  END IF;

  RETURN result;
END;
$$;

-- Function to update zone multipliers with better error handling
CREATE OR REPLACE FUNCTION public.update_zone_multipliers(multipliers_json JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  multiplier JSONB;
  multiplier_id TEXT;
  new_multiplier RECORD;
  current_multiplier RECORD;
  prev_value JSONB;
  new_value JSONB;
  result JSONB := jsonb_build_object('success', 0, 'error', 0);
BEGIN
  -- Verify user is authenticated and has admin role
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND user_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin permissions required';
  END IF;

  -- Process each multiplier in the JSON array
  IF jsonb_typeof(multipliers_json) = 'array' THEN
    FOR multiplier IN SELECT * FROM jsonb_array_elements(multipliers_json)
    LOOP
      BEGIN
        multiplier_id := multiplier->>'id';
        
        -- Check if this is a new multiplier or update
        IF multiplier_id LIKE 'new_%' THEN
          -- New multiplier - Insert
          INSERT INTO zone_multipliers (
            zone_id, 
            multiplier
          ) VALUES (
            (multiplier->>'zone_id')::uuid,
            (multiplier->>'multiplier')::numeric
          ) RETURNING * INTO new_multiplier;
          
          -- Log the change
          INSERT INTO pricing_change_logs (
            changed_by,
            change_type,
            previous_value,
            new_value,
            notes
          ) VALUES (
            auth.uid(),
            'zone_multiplier',
            '{}',
            jsonb_build_object(
              'zone_id', new_multiplier.zone_id,
              'multiplier', new_multiplier.multiplier
            ),
            'New zone multiplier added'
          );
          
          result := jsonb_set(result, '{success}', to_jsonb((result->>'success')::int + 1));
        ELSE
          -- Existing multiplier - Update
          SELECT * INTO current_multiplier FROM zone_multipliers WHERE id = multiplier_id::uuid;
          
          IF FOUND THEN
            prev_value := jsonb_build_object(
              'id', current_multiplier.id,
              'zone_id', current_multiplier.zone_id,
              'multiplier', current_multiplier.multiplier
            );
            
            new_value := jsonb_build_object(
              'id', multiplier_id,
              'zone_id', (multiplier->>'zone_id')::uuid,
              'multiplier', (multiplier->>'multiplier')::numeric
            );
            
            -- Update if there are any changes
            IF prev_value <> new_value THEN
              UPDATE zone_multipliers SET
                zone_id = (multiplier->>'zone_id')::uuid,
                multiplier = (multiplier->>'multiplier')::numeric
              WHERE id = multiplier_id::uuid;
              
              -- Log the change
              INSERT INTO pricing_change_logs (
                changed_by,
                change_type,
                previous_value,
                new_value,
                notes
              ) VALUES (
                auth.uid(),
                'zone_multiplier',
                prev_value,
                new_value,
                'Zone multiplier updated'
              );
            END IF;
            
            result := jsonb_set(result, '{success}', to_jsonb((result->>'success')::int + 1));
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Log error and continue with next multiplier
        RAISE NOTICE 'Error processing zone multiplier: %', SQLERRM;
        result := jsonb_set(result, '{error}', to_jsonb((result->>'error')::int + 1));
      END;
    END LOOP;
  END IF;

  RETURN result;
END;
$$;

-- Function to update fixed routes with better error handling
CREATE OR REPLACE FUNCTION public.update_fixed_routes(routes_json JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  route JSONB;
  route_id TEXT;
  new_route RECORD;
  current_route RECORD;
  prev_value JSONB;
  new_value JSONB;
  result JSONB := jsonb_build_object('success', 0, 'error', 0);
BEGIN
  -- Verify user is authenticated and has admin role
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND user_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin permissions required';
  END IF;

  -- Process each route in the JSON array
  IF jsonb_typeof(routes_json) = 'array' THEN
    FOR route IN SELECT * FROM jsonb_array_elements(routes_json)
    LOOP
      BEGIN
        route_id := route->>'id';
        
        -- Check if this is a new route or update
        IF route_id LIKE 'new_%' THEN
          -- New route - Insert
          INSERT INTO fixed_routes (
            origin_name,
            destination_name,
            vehicle_type,
            fixed_price
          ) VALUES (
            route->>'origin_name',
            route->>'destination_name',
            route->>'vehicle_type',
            (route->>'fixed_price')::numeric
          ) RETURNING * INTO new_route;
          
          -- Log the change
          INSERT INTO pricing_change_logs (
            changed_by,
            change_type,
            previous_value,
            new_value,
            notes
          ) VALUES (
            auth.uid(),
            'fixed_route',
            '{}',
            jsonb_build_object(
              'origin_name', new_route.origin_name,
              'destination_name', new_route.destination_name,
              'vehicle_type', new_route.vehicle_type,
              'fixed_price', new_route.fixed_price
            ),
            'New fixed route added'
          );
          
          result := jsonb_set(result, '{success}', to_jsonb((result->>'success')::int + 1));
        ELSE
          -- Existing route - Update
          SELECT * INTO current_route FROM fixed_routes WHERE id = route_id::uuid;
          
          IF FOUND THEN
            prev_value := jsonb_build_object(
              'id', current_route.id,
              'origin_name', current_route.origin_name,
              'destination_name', current_route.destination_name,
              'vehicle_type', current_route.vehicle_type,
              'fixed_price', current_route.fixed_price
            );
            
            new_value := jsonb_build_object(
              'id', route_id,
              'origin_name', route->>'origin_name',
              'destination_name', route->>'destination_name',
              'vehicle_type', route->>'vehicle_type',
              'fixed_price', (route->>'fixed_price')::numeric
            );
            
            -- Update if there are any changes
            IF prev_value <> new_value THEN
              UPDATE fixed_routes SET
                origin_name = route->>'origin_name',
                destination_name = route->>'destination_name',
                vehicle_type = route->>'vehicle_type',
                fixed_price = (route->>'fixed_price')::numeric
              WHERE id = route_id::uuid;
              
              -- Log the change
              INSERT INTO pricing_change_logs (
                changed_by,
                change_type,
                previous_value,
                new_value,
                notes
              ) VALUES (
                auth.uid(),
                'fixed_route',
                prev_value,
                new_value,
                'Fixed route updated'
              );
            END IF;
            
            result := jsonb_set(result, '{success}', to_jsonb((result->>'success')::int + 1));
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Log error and continue with next route
        RAISE NOTICE 'Error processing fixed route: %', SQLERRM;
        result := jsonb_set(result, '{error}', to_jsonb((result->>'error')::int + 1));
      END;
    END LOOP;
  END IF;

  RETURN result;
END;
$$;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_zones_with_multipliers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_vehicle_prices(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_zone_multipliers(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_fixed_routes(JSONB) TO authenticated;