/*
  # Add driver verification enforcement and admin overrides

  1. New Tables:
    - `activity_logs`
      - `id` (uuid, primary key)
      - `driver_id` (uuid, foreign key to drivers.id)
      - `admin_id` (uuid, foreign key to users.id, nullable)
      - `action` (text)
      - `details` (jsonb)
      - `created_at` (timestamptz)
  
  2. Functions:
    - `toggle_driver_availability` - Enforces verification status before changing availability
    - `set_driver_availability_admin` - Allows admins to override availability with logging
    
  3. Updated Columns:
    - Added `updated_at` to drivers table to track last update time
*/

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id),
  admin_id uuid REFERENCES users(id),
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS activity_logs_driver_id_idx ON activity_logs(driver_id);
CREATE INDEX IF NOT EXISTS activity_logs_admin_id_idx ON activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON activity_logs(action);
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs(created_at);

-- Enable row-level security on activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy for inserting logs (driver self-updates and admin actions)
CREATE POLICY "Drivers and admins can insert activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Driver can log their own actions
    (auth.uid() IN (
      SELECT user_id FROM drivers WHERE id = driver_id
    ))
    OR
    -- Admin can log actions
    (
      EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND user_role = 'admin'
      )
    )
  );

-- Policy for viewing logs
CREATE POLICY "Drivers can view their own logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM drivers WHERE id = driver_id
    )
  );

CREATE POLICY "Admins can view all logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND user_role = 'admin'
    )
  );

-- Add updated_at to drivers if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'drivers' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE drivers ADD COLUMN updated_at timestamptz;
  END IF;
END $$;

-- Function to toggle driver availability with verification check
CREATE OR REPLACE FUNCTION toggle_driver_availability(driver_id uuid, new_status boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_verification_status text;
BEGIN
  -- Get the user_id and verification_status for this driver
  SELECT user_id, verification_status INTO v_user_id, v_verification_status
  FROM drivers
  WHERE id = driver_id;
  
  -- Check if the requesting user is the driver or an admin
  IF auth.uid() != v_user_id AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND user_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized to change this driver''s availability';
  END IF;
  
  -- Enforce verification status check (unless it's an admin)
  IF auth.uid() = v_user_id AND v_verification_status != 'verified' THEN
    RAISE EXCEPTION 'Driver must be verified before changing availability';
  END IF;
  
  -- Update the driver's availability
  UPDATE drivers
  SET is_available = new_status,
      updated_at = now()
  WHERE id = driver_id;
  
  -- Log the change
  INSERT INTO activity_logs (
    driver_id,
    admin_id,
    action,
    details
  ) VALUES (
    driver_id,
    CASE WHEN auth.uid() != v_user_id THEN auth.uid() ELSE NULL END,
    'availability_change',
    jsonb_build_object(
      'new_status', new_status,
      'changed_by', CASE WHEN auth.uid() != v_user_id THEN 'admin' ELSE 'driver' END,
      'timestamp', now()
    )
  );
  
  RETURN true;
END;
$$;

-- Admin function to set driver availability (for admin overrides)
CREATE OR REPLACE FUNCTION set_driver_availability_admin(driver_id uuid, new_status boolean, note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_user_id uuid;
BEGIN
  -- Check admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND user_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin permissions required';
  END IF;
  
  -- Get the user_id for this driver
  SELECT user_id INTO v_driver_user_id
  FROM drivers
  WHERE id = driver_id;
  
  IF v_driver_user_id IS NULL THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;
  
  -- Update driver availability
  UPDATE drivers
  SET is_available = new_status,
      updated_at = now()
  WHERE id = driver_id;
  
  -- Log the action
  INSERT INTO activity_logs (
    driver_id,
    admin_id,
    action,
    details
  ) VALUES (
    driver_id,
    auth.uid(),
    'admin_availability_change',
    jsonb_build_object(
      'new_status', new_status,
      'admin_id', auth.uid(),
      'admin_note', note,
      'timestamp', now()
    )
  );
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION toggle_driver_availability TO authenticated;
GRANT EXECUTE ON FUNCTION set_driver_availability_admin TO authenticated;