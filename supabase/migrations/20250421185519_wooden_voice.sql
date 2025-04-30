/*
  # Fix admin permissions for payments and drivers tables

  1. RLS Policy Updates
    - Ensures admin users have proper SELECT permissions on payments table
    - Ensures admin users have proper SELECT permissions on drivers table
  
  2. Security
    - Maintains existing RLS policies while fixing permission issues
    - Ensures proper access control based on user roles
*/

-- Check and recreate admin policy for payments table if it doesn't work properly
DO $$
BEGIN
  -- Drop existing admin view policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'payments' AND policyname = 'Admins can view all payments'
  ) THEN
    DROP POLICY "Admins can view all payments" ON public.payments;
  END IF;
  
  -- Create the policy with corrected permissions
  CREATE POLICY "Admins can view all payments" ON public.payments
    FOR SELECT
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.user_role = 'admin'
    ));
END;
$$;

-- Check and recreate admin policy for drivers table if it doesn't work properly
DO $$
BEGIN
  -- Drop existing admin view policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Admins can view all drivers'
  ) THEN
    DROP POLICY "Admins can view all drivers" ON public.drivers;
  END IF;
  
  -- Create the policy with corrected permissions
  CREATE POLICY "Admins can view all drivers" ON public.drivers
    FOR SELECT
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.user_role = 'admin'
    ));
END;
$$;

-- Make sure RLS is enabled on these tables
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.drivers ENABLE ROW LEVEL SECURITY;

-- Add comments to explain the purpose of these policies
COMMENT ON POLICY "Admins can view all payments" ON public.payments IS 'Allows admin users to view all payment records';
COMMENT ON POLICY "Admins can view all drivers" ON public.drivers IS 'Allows admin users to view all driver information';