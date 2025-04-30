/*
  # Fix driver table permissions for partners

  1. Changes
     - Update RLS policies on the drivers table to allow partners to access their own driver data
     - This ensures partners can view and manage their own driver profile

  2. Security
     - Partners can only access their own driver records
     - Row-level security remains in place with appropriate restrictions
*/

-- Check if policies exist and create them only if they don't
DO $$
BEGIN
  -- Check if "Partners can view their own driver records" policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can view their own driver records'
  ) THEN
    -- Create policy for partners to view their own driver records
    CREATE POLICY "Partners can view their own driver records"
      ON public.drivers
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- Check if "Partners can update their own driver records" policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can update their own driver records'
  ) THEN
    -- Create policy for partners to update their own driver records
    CREATE POLICY "Partners can update their own driver records"
      ON public.drivers
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Check if "Partners can insert their own driver records" policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can insert their own driver records'
  ) THEN
    -- Create policy for partners to insert their own driver records
    CREATE POLICY "Partners can insert their own driver records"
      ON public.drivers
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Make sure RLS is enabled on drivers table
ALTER TABLE IF EXISTS public.drivers ENABLE ROW LEVEL SECURITY;