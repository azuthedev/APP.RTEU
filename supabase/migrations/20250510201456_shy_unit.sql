/*
  # Add pricing change logging

  1. New Tables
    - `pricing_change_logs`
      - `id` (uuid, primary key)
      - `changed_by` (uuid, foreign key to users)
      - `change_type` (enum: base_price, zone_multiplier, fixed_route)
      - `previous_value` (jsonb)
      - `new_value` (jsonb)
      - `created_at` (timestamp)
      - `notes` (text, optional)

  2. Security
    - Enable RLS
    - Add policies for admin access
    - Add trigger for automatic logging
*/

-- Create change type enum
CREATE TYPE pricing_change_type AS ENUM ('base_price', 'zone_multiplier', 'fixed_route');

-- Create pricing_change_logs table
CREATE TABLE IF NOT EXISTS pricing_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid REFERENCES users(id) NOT NULL,
  change_type pricing_change_type NOT NULL,
  previous_value jsonb NOT NULL,
  new_value jsonb NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE pricing_change_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admins can view pricing change logs" ON pricing_change_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_role = 'admin'
    )
  );

-- Create function to automatically log pricing changes
CREATE OR REPLACE FUNCTION log_pricing_change()
RETURNS TRIGGER AS $$
DECLARE
  change_type pricing_change_type;
BEGIN
  -- Determine change type based on table
  CASE TG_TABLE_NAME
    WHEN 'vehicle_base_prices' THEN
      change_type := 'base_price';
    WHEN 'zone_multipliers' THEN
      change_type := 'zone_multiplier';
    WHEN 'fixed_routes' THEN
      change_type := 'fixed_route';
  END CASE;

  -- Insert log entry
  INSERT INTO pricing_change_logs (
    changed_by,
    change_type,
    previous_value,
    new_value,
    notes
  ) VALUES (
    auth.uid(),
    change_type,
    CASE 
      WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb
      ELSE '{}'::jsonb 
    END,
    CASE 
      WHEN TG_OP = 'DELETE' THEN '{}'::jsonb
      ELSE row_to_json(NEW)::jsonb
    END,
    'Automatic log entry'
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for each pricing table
CREATE TRIGGER log_vehicle_price_changes
  AFTER INSERT OR UPDATE OR DELETE ON vehicle_base_prices
  FOR EACH ROW EXECUTE FUNCTION log_pricing_change();

CREATE TRIGGER log_zone_multiplier_changes
  AFTER INSERT OR UPDATE OR DELETE ON zone_multipliers
  FOR EACH ROW EXECUTE FUNCTION log_pricing_change();

CREATE TRIGGER log_fixed_route_changes
  AFTER INSERT OR UPDATE OR DELETE ON fixed_routes
  FOR EACH ROW EXECUTE FUNCTION log_pricing_change();