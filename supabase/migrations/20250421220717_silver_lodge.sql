/*
  # Fix partner permissions for drivers table
  
  1. Purpose
     - Allow partners to create and access their own driver profiles
     - Fix permission denied errors for partners viewing trips
     - Enable proper access to driver-related functionality
     
  2. Changes
     - Update RLS policies for the drivers table
     - Add policies for partners to create and access their own driver profiles
     - Fix related permissions for partners accessing trips
*/

-- First, ensure drivers table has RLS enabled
ALTER TABLE IF EXISTS public.drivers ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting policies
DROP POLICY IF EXISTS "Drivers can view own data" ON public.drivers;
DROP POLICY IF EXISTS "Partners can create their own driver profile" ON public.drivers;
DROP POLICY IF EXISTS "Partners can update their own driver profile" ON public.drivers;

-- Create policy for partners to view their own driver data
CREATE POLICY "Drivers can view own data" 
ON public.drivers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create policy for partners to insert their own driver profile
CREATE POLICY "Partners can create their own driver profile"
ON public.drivers
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create policy for partners to update their own driver profile
CREATE POLICY "Partners can update their own driver profile"
ON public.drivers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Ensure trips table properly references drivers
ALTER TABLE IF EXISTS public.trips 
  DROP CONSTRAINT IF EXISTS trips_driver_id_fkey;

-- Re-create the constraint with proper references
ALTER TABLE IF EXISTS public.trips
  ADD CONSTRAINT trips_driver_id_fkey 
  FOREIGN KEY (driver_id) 
  REFERENCES public.users(id);

-- Create a helper function to safely get driver ID from user ID
CREATE OR REPLACE FUNCTION public.get_user_driver_id(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  -- Find the driver ID for the given user ID
  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE user_id = p_user_id;
  
  RETURN v_driver_id;
END;
$$;

-- Grant permission to execute function
GRANT EXECUTE ON FUNCTION public.get_user_driver_id TO authenticated;

-- Helper function to check if user is a partner
CREATE OR REPLACE FUNCTION public.is_partner() 
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND user_role = 'partner'
  );
END
$$;

-- Grant permission to execute function
GRANT EXECUTE ON FUNCTION public.is_partner TO authenticated;

-- Create robust driver access policy that allows access to own driver profile
-- even if it's not yet created (to avoid permission denied when checking existence)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' 
    AND policyname = 'Partners can access driver content'
  ) THEN
    CREATE POLICY "Partners can access driver content"
      ON public.drivers
      FOR ALL
      TO authenticated
      USING (
        user_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND (users.user_role = 'admin' OR users.user_role = 'support')
        )
      );
  END IF;
END $$;