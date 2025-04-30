/*
  # Fix driver table permissions for partners

  1. Changes
     - Update RLS policies on the drivers table to allow partners to access their own driver data
     - This ensures partners can view and manage their own driver profile

  2. Security
     - Partners can only access their own driver records
     - Row-level security remains in place with appropriate restrictions
*/

-- Allow partners to view their own driver records
CREATE POLICY IF NOT EXISTS "Partners can view their own driver records"
  ON public.drivers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow partners to update their own driver records
CREATE POLICY IF NOT EXISTS "Partners can update their own driver records"
  ON public.drivers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow partners to insert their own driver records 
CREATE POLICY IF NOT EXISTS "Partners can insert their own driver records"
  ON public.drivers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);