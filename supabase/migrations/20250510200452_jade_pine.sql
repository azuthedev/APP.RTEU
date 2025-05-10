/*
  # Create pricing management tables

  1. New Tables
    - `vehicle_base_prices`
      - `id` (uuid, primary key)
      - `vehicle_type` (text, unique)
      - `base_price_per_km` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `zone_multipliers`
      - `id` (uuid, primary key)
      - `zone_id` (uuid, foreign key)
      - `multiplier` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `fixed_routes`
      - `id` (uuid, primary key)
      - `origin_name` (text)
      - `destination_name` (text)
      - `vehicle_type` (text)
      - `fixed_price` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for admin access
*/

-- Create vehicle_base_prices table
CREATE TABLE IF NOT EXISTS vehicle_base_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type text UNIQUE NOT NULL,
  base_price_per_km numeric NOT NULL CHECK (base_price_per_km > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create zone_multipliers table
CREATE TABLE IF NOT EXISTS zone_multipliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES zones(id) ON DELETE CASCADE,
  multiplier numeric NOT NULL DEFAULT 1.0 CHECK (multiplier > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(zone_id)
);

-- Create fixed_routes table
CREATE TABLE IF NOT EXISTS fixed_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_name text NOT NULL,
  destination_name text NOT NULL,
  vehicle_type text NOT NULL,
  fixed_price numeric NOT NULL CHECK (fixed_price > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(origin_name, destination_name, vehicle_type)
);

-- Enable RLS
ALTER TABLE vehicle_base_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_multipliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_routes ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can manage vehicle_base_prices" ON vehicle_base_prices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_role = 'admin'
    )
  );

CREATE POLICY "Admins can manage zone_multipliers" ON zone_multipliers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_role = 'admin'
    )
  );

CREATE POLICY "Admins can manage fixed_routes" ON fixed_routes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_role = 'admin'
    )
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_vehicle_base_prices_updated_at
  BEFORE UPDATE ON vehicle_base_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zone_multipliers_updated_at
  BEFORE UPDATE ON zone_multipliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fixed_routes_updated_at
  BEFORE UPDATE ON fixed_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();