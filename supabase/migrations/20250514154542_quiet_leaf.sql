/*
  # Create log_pricing_change function and trigger

  1. New Functions
    - `log_pricing_change` - Function to log price changes

  2. Triggers
    - Added triggers to all pricing tables (vehicle_base_prices, zone_multipliers, fixed_routes) 
    - Tracks all changes to pricing data
*/

-- Create a function to log pricing changes
CREATE OR REPLACE FUNCTION public.log_pricing_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  change_type pricing_change_type;
  admin_id uuid;
  change_notes text := 'Automatic change detection';
BEGIN
  -- Get the admin ID based on auth.uid()
  SELECT id INTO admin_id FROM auth.users WHERE id = auth.uid();
  
  -- Determine the change type based on the table
  IF TG_TABLE_NAME = 'vehicle_base_prices' THEN
    change_type := 'base_price';
  ELSIF TG_TABLE_NAME = 'zone_multipliers' THEN
    change_type := 'zone_multiplier';
  ELSIF TG_TABLE_NAME = 'fixed_routes' THEN
    change_type := 'fixed_route';
  END IF;
  
  -- Handle inserts
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO pricing_change_logs (
      changed_by,
      change_type,
      previous_value,
      new_value,
      notes
    ) VALUES (
      admin_id,
      change_type,
      '{}',
      to_jsonb(NEW),
      'New record created'
    );
    RETURN NEW;
  
  -- Handle updates
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Only log if there are actual changes
    IF to_jsonb(OLD) <> to_jsonb(NEW) THEN
      INSERT INTO pricing_change_logs (
        changed_by,
        change_type,
        previous_value,
        new_value,
        notes
      ) VALUES (
        admin_id,
        change_type,
        to_jsonb(OLD),
        to_jsonb(NEW),
        'Record updated'
      );
    END IF;
    RETURN NEW;
  
  -- Handle deletes
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO pricing_change_logs (
      changed_by,
      change_type,
      previous_value,
      new_value,
      notes
    ) VALUES (
      admin_id,
      change_type,
      to_jsonb(OLD),
      '{}',
      'Record deleted'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create triggers for each pricing table if they don't already exist

-- Check and create trigger for vehicle_base_prices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'log_vehicle_price_changes'
  ) THEN
    CREATE TRIGGER log_vehicle_price_changes
    AFTER INSERT OR UPDATE OR DELETE ON vehicle_base_prices
    FOR EACH ROW EXECUTE FUNCTION log_pricing_change();
  END IF;
END $$;

-- Check and create trigger for zone_multipliers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'log_zone_multiplier_changes'
  ) THEN
    CREATE TRIGGER log_zone_multiplier_changes
    AFTER INSERT OR UPDATE OR DELETE ON zone_multipliers
    FOR EACH ROW EXECUTE FUNCTION log_pricing_change();
  END IF;
END $$;

-- Check and create trigger for fixed_routes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'log_fixed_route_changes'
  ) THEN
    CREATE TRIGGER log_fixed_route_changes
    AFTER INSERT OR UPDATE OR DELETE ON fixed_routes
    FOR EACH ROW EXECUTE FUNCTION log_pricing_change();
  END IF;
END $$;