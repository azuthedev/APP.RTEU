/*
  # Fix admin permissions for payments and drivers tables

  1. Schema Changes:
    - Ensures the is_admin() function exists and works correctly
    - Drops and recreates admin policies for the payments table
    - Drops and recreates admin policies for the drivers table

  2. Security:
    - Ensures admin users can properly view all payments and drivers data
    - Fixes permission denied errors in the admin bookings page
*/

-- First, ensure the is_admin() function exists and is correctly defined
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND user_role = 'admin'
  );
END;
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Fix admin access to payments table
DO $$
BEGIN
  -- Drop existing admin view policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payments' AND policyname = 'Admins can view all payments'
  ) THEN
    DROP POLICY "Admins can view all payments" ON public.payments;
  END IF;
  
  -- Create the policy with simpler and more direct admin check
  CREATE POLICY "Admins can view all payments" ON public.payments
    FOR SELECT
    TO authenticated
    USING (is_admin());
END;
$$;

-- Fix admin access to drivers table
DO $$
BEGIN
  -- Drop existing admin view policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Admins can view all drivers'
  ) THEN
    DROP POLICY "Admins can view all drivers" ON public.drivers;
  END IF;
  
  -- Create the policy with simpler and more direct admin check
  CREATE POLICY "Admins can view all drivers" ON public.drivers
    FOR SELECT
    TO authenticated
    USING (is_admin());
END;
$$;

-- Make sure RLS is enabled on these tables
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.drivers ENABLE ROW LEVEL SECURITY;

-- Add comments to explain the purpose of these policies
COMMENT ON POLICY "Admins can view all payments" ON public.payments IS 'Allows admin users to view all payment records using the is_admin() function';
COMMENT ON POLICY "Admins can view all drivers" ON public.drivers IS 'Allows admin users to view all driver information using the is_admin() function';