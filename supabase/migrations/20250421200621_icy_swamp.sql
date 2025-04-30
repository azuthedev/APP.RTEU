/*
  # Fix permission issues for admin access
  
  1. Changes
     - Add RLS policies to allow admin access to drivers table
     - Add RLS policies to allow admin access to trips table
     - Fix permissions for log_queries table
     - Create helper functions for admin operations
     
  2. Security
     - All new policies use is_admin() function for proper authorization
     - Enable RLS on all tables to ensure proper access control
*/

-- First check if is_admin() function exists, if not create it
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_role = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant appropriate permissions on drivers table for admins
DO $$
BEGIN
  -- Check if policies already exist to avoid errors
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Admins can view all drivers'
  ) THEN
    CREATE POLICY "Admins can view all drivers" 
      ON drivers
      FOR SELECT
      TO authenticated
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Admins can update drivers'
  ) THEN
    CREATE POLICY "Admins can update drivers" 
      ON drivers
      FOR UPDATE
      TO authenticated
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Admins can delete drivers'
  ) THEN
    CREATE POLICY "Admins can delete drivers" 
      ON drivers
      FOR DELETE
      TO authenticated
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Admins can insert drivers'
  ) THEN
    CREATE POLICY "Admins can insert drivers" 
      ON drivers
      FOR INSERT
      TO authenticated
      WITH CHECK (is_admin());
  END IF;
END
$$;

-- Grant appropriate permissions on trips table for admins
DO $$
BEGIN
  -- Ensure RLS is enabled
  ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

  -- Check if policies already exist to avoid errors
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trips' AND policyname = 'Admins can view all trips'
  ) THEN
    CREATE POLICY "Admins can view all trips" 
      ON trips
      FOR SELECT
      TO authenticated
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trips' AND policyname = 'Admins can update trips'
  ) THEN
    CREATE POLICY "Admins can update trips" 
      ON trips
      FOR UPDATE
      TO authenticated
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trips' AND policyname = 'Admins can insert trips'
  ) THEN
    CREATE POLICY "Admins can insert trips" 
      ON trips
      FOR INSERT
      TO authenticated
      WITH CHECK (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trips' AND policyname = 'Admins can delete trips'
  ) THEN
    CREATE POLICY "Admins can delete trips" 
      ON trips
      FOR DELETE
      TO authenticated
      USING (is_admin());
  END IF;
END
$$;

-- Grant appropriate permissions on log_queries table for admins and users
DO $$
BEGIN
  -- Ensure RLS is enabled
  ALTER TABLE log_queries ENABLE ROW LEVEL SECURITY;

  -- Check if policies already exist to avoid errors
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'log_queries' AND policyname = 'Admins can view all log queries'
  ) THEN
    CREATE POLICY "Admins can view all log queries" 
      ON log_queries
      FOR SELECT
      TO authenticated
      USING (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'log_queries' AND policyname = 'Users can insert their own log queries'
  ) THEN
    CREATE POLICY "Users can insert their own log queries" 
      ON log_queries
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id OR is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'log_queries' AND policyname = 'Users can view their own log queries'
  ) THEN
    CREATE POLICY "Users can view their own log queries" 
      ON log_queries
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Create a helper function for admin to set driver availability
CREATE OR REPLACE FUNCTION set_driver_availability_admin(
  driver_id UUID,
  new_status BOOLEAN,
  note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  driver_exists BOOLEAN;
  driver_user_id UUID;
BEGIN
  -- Check if the driver exists
  SELECT EXISTS (
    SELECT 1 FROM drivers WHERE id = driver_id
  ) INTO driver_exists;
  
  IF NOT driver_exists THEN
    RAISE EXCEPTION 'Driver with ID % does not exist', driver_id;
  END IF;
  
  -- Get the driver's user ID for logging
  SELECT user_id INTO driver_user_id FROM drivers WHERE id = driver_id;
  
  -- Update driver availability
  UPDATE drivers
  SET 
    is_available = new_status,
    updated_at = NOW()
  WHERE id = driver_id;
  
  -- Log the action
  INSERT INTO activity_logs (
    driver_id,
    admin_id,
    action,
    details,
    created_at
  ) VALUES (
    driver_id,
    auth.uid(),
    'availability_changed_by_admin',
    jsonb_build_object(
      'previous_status', NOT new_status,
      'new_status', new_status,
      'note', note,
      'timestamp', NOW()
    ),
    NOW()
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;