/*
  # Fix partner access to driver records
  
  1. Create helper functions
    - Create get_user_driver_id function to safely retrieve driver ID
    - Create is_partner function to check if user has partner role
  
  2. Fix permissions
    - Ensure partners can access their own driver records
    - Use DO blocks to safely handle policy creation
*/

-- Create or replace get_user_driver_id function
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
  WHERE user_id = COALESCE(p_user_id, auth.uid());
  
  RETURN v_driver_id;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.get_user_driver_id TO authenticated;

-- Create or replace is_partner function
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

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.is_partner TO authenticated;

-- Ensure RLS is enabled on drivers table
ALTER TABLE IF EXISTS public.drivers ENABLE ROW LEVEL SECURITY;

-- Safely create partner access policies with DO blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can view their own driver records'
  ) THEN
    CREATE POLICY "Partners can view their own driver records"
    ON public.drivers
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can update their own driver records'
  ) THEN
    CREATE POLICY "Partners can update their own driver records"
    ON public.drivers
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can insert their own driver records'
  ) THEN
    CREATE POLICY "Partners can insert their own driver records"
    ON public.drivers
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- Create a policy allowing all authenticated users to access trips they're assigned to
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trips' AND policyname = 'Drivers can see their assigned trips'
  ) THEN
    CREATE POLICY "Drivers can see their assigned trips"
    ON public.trips
    FOR SELECT
    TO authenticated
    USING (driver_id = auth.uid());
  END IF;
END$$;

-- Ensure driver_documents has RLS enabled
ALTER TABLE IF EXISTS public.driver_documents ENABLE ROW LEVEL SECURITY;

-- Safely ensure access to documents through driver relationship
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_documents' AND policyname = 'Drivers can view own documents'
  ) THEN
    CREATE POLICY "Drivers can view own documents"
    ON public.driver_documents
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM drivers
        WHERE drivers.id = driver_documents.driver_id
        AND drivers.user_id = auth.uid()
      )
    );
  END IF;
END$$;