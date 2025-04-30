/*
  # Fix Admin RLS Policies

  1. Updated Functions
    - Improve `is_admin()` function to check both JWT claims and database role
  
  2. Updated Policies
    - Fix drivers table policies to ensure admins can view all drivers
    - Fix payments table policies to ensure admins can view all payments
    - Ensure proper admin access across relevant tables
*/

-- Improved is_admin function that checks both JWT claims and database user role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_id uuid;
  user_role text;
BEGIN
  -- Get the user ID from the JWT
  user_id := auth.uid();
  
  -- If not authenticated, return false
  IF user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check the user role in the database
  SELECT u.user_role INTO user_role
  FROM public.users u
  WHERE u.id = user_id;
  
  -- Return true if user_role is 'admin'
  RETURN user_role = 'admin';
END;
$$;

-- Drop and recreate drivers table RLS policies for admin view
DROP POLICY IF EXISTS "Admins can view all drivers" ON public.drivers;
CREATE POLICY "Admins can view all drivers" 
ON public.drivers
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Drop and recreate payments table RLS policies for admin view 
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments" 
ON public.payments
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Ensure drivers table has the right policies for driver updates
DROP POLICY IF EXISTS "Admins can update drivers" ON public.drivers;
CREATE POLICY "Admins can update drivers" 
ON public.drivers
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Ensure drivers table has the right policies for driver inserts
DROP POLICY IF EXISTS "Admins can insert drivers" ON public.drivers;
CREATE POLICY "Admins can insert drivers" 
ON public.drivers
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Drop and recreate RLS policy for admin to delete drivers
DROP POLICY IF EXISTS "Admins can delete drivers" ON public.drivers;
CREATE POLICY "Admins can delete drivers" 
ON public.drivers
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Make sure trips table has admin policies 
DROP POLICY IF EXISTS "Admins can view all trips" ON public.trips;
CREATE POLICY "Admins can view all trips" 
ON public.trips
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Drop and recreate RLS policy for admin to update payments
DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;
CREATE POLICY "Admins can update payments" 
ON public.payments
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Drop and recreate RLS policy for admin to insert payments
DROP POLICY IF EXISTS "Admins can insert payments" ON public.payments;
CREATE POLICY "Admins can insert payments" 
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());