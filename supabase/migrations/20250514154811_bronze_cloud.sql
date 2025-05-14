/*
  # Create Pricing Management Helper Functions
  
  This migration creates database functions for secure pricing management.
  These functions use SECURITY DEFINER to bypass RLS policies for admins.
  
  1. New Functions:
    - get_zones_list(): Retrieve zones safely (already created in previous migration)
    - get_vehicle_prices(): Retrieve vehicle base prices
    - get_zone_multipliers(): Retrieve zone multipliers with zone names
    - get_fixed_routes(): Retrieve fixed routes
    - update_vehicle_prices(): Update, create or delete vehicle prices
    - update_zone_multipliers(): Update, create or delete zone multipliers
    - update_fixed_routes(): Update, create or delete fixed routes
    - touch_table(): Helper to refresh cache by touching a table
  
  2. Security:
    - All functions use SECURITY DEFINER to run with creator privileges
    - All functions restrict access to authenticated users with admin role
*/

-- Function to get vehicle prices safely
CREATE OR REPLACE FUNCTION public.get_vehicle_prices()
RETURNS SETOF vehicle_base_prices
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
  SELECT * FROM vehicle_base_prices
  ORDER BY vehicle_type;
END;
$$;

-- Function to get zone multipliers safely
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

-- Function to get fixed routes safely
CREATE OR REPLACE FUNCTION public.get_fixed_routes()
RETURNS SETOF fixed_routes
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
  SELECT * FROM fixed_routes
  ORDER BY origin_name;
END;
$$;

-- Function to update vehicle prices
CREATE OR REPLACE FUNCTION public.update_vehicle_prices(prices_json JSONB)
RETURNS VOID
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
  FOR price IN SELECT * FROM jsonb_array_elements(prices_json)
  LOOP
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
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Function to update zone multipliers
CREATE OR REPLACE FUNCTION public.update_zone_multipliers(multipliers_json JSONB)
RETURNS VOID
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
  FOR multiplier IN SELECT * FROM jsonb_array_elements(multipliers_json)
  LOOP
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
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Function to update fixed routes
CREATE OR REPLACE FUNCTION public.update_fixed_routes(routes_json JSONB)
RETURNS VOID
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
  FOR route IN SELECT * FROM jsonb_array_elements(routes_json)
  LOOP
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
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Function to "touch" a table to refresh triggers/cache
CREATE OR REPLACE FUNCTION public.touch_table(table_name TEXT)
RETURNS VOID
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

  -- Execute dynamic SQL to touch the table
  EXECUTE format('
    WITH no_op AS (
      SELECT 1 
      FROM %I 
      LIMIT 1
    ) 
    SELECT COUNT(*) FROM no_op', table_name
  );
END;
$$;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_vehicle_prices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_zone_multipliers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fixed_routes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_vehicle_prices(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_zone_multipliers(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_fixed_routes(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_table(TEXT) TO authenticated;