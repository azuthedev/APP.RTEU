/*
  # Secure driver creation and document management
  
  1. Security Updates
    - Add function to safely get driver ID for the current user
    - Add policies for secure document access
  
  2. New Functions
    - Create `driver_exists` function to check if a user has a driver profile
    - Create `create_driver_profile` function for secure profile creation
    
  3. Storage Policies
    - Add secure storage policies for document uploads
*/

-- Function to safely get the current user's driver ID
CREATE OR REPLACE FUNCTION public.get_user_driver_id(p_user_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_driver_id uuid;
BEGIN
  -- Use provided user ID or fallback to current user
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Find the driver ID for the given user ID
  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE user_id = v_user_id;
  
  RETURN v_driver_id;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.get_user_driver_id TO authenticated;

-- Function to check if the current user has a driver profile
CREATE OR REPLACE FUNCTION public.driver_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM drivers
    WHERE user_id = auth.uid()
  );
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.driver_exists TO authenticated;

-- Function to securely create a driver profile
CREATE OR REPLACE FUNCTION public.create_driver_profile(p_user_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_driver_id uuid;
BEGIN
  -- Use provided user ID or fallback to current user
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  -- Check if user exists and is a partner
  SELECT user_role INTO v_user_role
  FROM public.users
  WHERE id = v_user_id;
  
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  IF v_user_role != 'partner' AND v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only partner users can create driver profiles';
  END IF;
  
  -- Check if driver profile already exists
  IF EXISTS (
    SELECT 1 FROM drivers
    WHERE user_id = v_user_id
  ) THEN
    SELECT id INTO v_driver_id
    FROM drivers
    WHERE user_id = v_user_id;
    
    RETURN v_driver_id; -- Return existing ID
  END IF;
  
  -- Create the driver profile
  INSERT INTO public.drivers (
    user_id,
    verification_status,
    is_available
  ) VALUES (
    v_user_id,
    'unverified',
    false
  ) RETURNING id INTO v_driver_id;
  
  -- Insert activity log
  INSERT INTO public.activity_logs (
    driver_id,
    action,
    details
  ) VALUES (
    v_driver_id,
    'driver_profile_created',
    jsonb_build_object(
      'created_by', CASE 
        WHEN auth.uid() = v_user_id THEN 'self' 
        ELSE 'admin' 
      END,
      'timestamp', now()
    )
  );
  
  RETURN v_driver_id;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.create_driver_profile TO authenticated;

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
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.is_partner TO authenticated;

-- Ensure drivers table has RLS enabled
ALTER TABLE IF EXISTS public.drivers ENABLE ROW LEVEL SECURITY;

-- Ensure driver_documents table has RLS enabled
ALTER TABLE IF EXISTS public.driver_documents ENABLE ROW LEVEL SECURITY;

-- Safe RLS policy creation using DO blocks
DO $$
BEGIN
  -- Drivers table policies
  
  -- Allow partners to view their own driver profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can view their own driver profiles'
  ) THEN
    CREATE POLICY "Partners can view their own driver profiles"
      ON public.drivers
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR is_admin());
  END IF;
  
  -- Allow partners to insert their own driver profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can create their own driver profile'
  ) THEN
    CREATE POLICY "Partners can create their own driver profile"
      ON public.drivers
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid() AND is_partner());
  END IF;
  
  -- Allow partners to update their own driver profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can update their own driver profile'
  ) THEN
    CREATE POLICY "Partners can update their own driver profile"
      ON public.drivers
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid() AND is_partner());
  END IF;
  
  -- Driver documents table policies
  
  -- Allow partners to view their own documents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_documents' AND policyname = 'Partners can view their own documents'
  ) THEN
    CREATE POLICY "Partners can view their own documents"
      ON public.driver_documents
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM drivers
          WHERE drivers.id = driver_documents.driver_id
          AND drivers.user_id = auth.uid()
        ) OR is_admin()
      );
  END IF;
  
  -- Allow partners to upload their own documents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_documents' AND policyname = 'Partners can upload their own documents'
  ) THEN
    CREATE POLICY "Partners can upload their own documents"
      ON public.driver_documents
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM drivers
          WHERE drivers.id = driver_documents.driver_id
          AND drivers.user_id = auth.uid()
        ) OR is_admin()
      );
  END IF;
  
  -- Allow partners to update their own documents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_documents' AND policyname = 'Partners can update their own documents'
  ) THEN
    CREATE POLICY "Partners can update their own documents"
      ON public.driver_documents
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM drivers
          WHERE drivers.id = driver_documents.driver_id
          AND drivers.user_id = auth.uid()
        ) OR is_admin()
      );
  END IF;
  
  -- Allow partners to delete their own documents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_documents' AND policyname = 'Partners can delete their own documents'
  ) THEN
    CREATE POLICY "Partners can delete their own documents"
      ON public.driver_documents
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM drivers
          WHERE drivers.id = driver_documents.driver_id
          AND drivers.user_id = auth.uid()
        ) OR is_admin()
      );
  END IF;
END$$;

-- Handle storage policies safely without requiring pg_crypto
DO $$
BEGIN
  -- Check if we can access storage schema tables
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    -- Partners can upload document files
    BEGIN
      CREATE POLICY "Partners can upload document files"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'documents'
          AND (storage.foldername(name))[1] = 'driver_documents'
        );
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Policy "Partners can upload document files" already exists';
    END;
    
    -- Partners can access document files
    BEGIN
      CREATE POLICY "Partners can access document files"
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (
          bucket_id = 'documents'
          AND (storage.foldername(name))[1] = 'driver_documents'
        );
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Policy "Partners can access document files" already exists';
    END;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Unable to create storage policies: %', SQLERRM;
END$$;

-- Comment on functions
COMMENT ON FUNCTION public.get_user_driver_id IS 'Securely get the driver ID for a user';
COMMENT ON FUNCTION public.driver_exists IS 'Check if the current user has a driver profile';
COMMENT ON FUNCTION public.create_driver_profile IS 'Securely create a driver profile';
COMMENT ON FUNCTION public.is_partner IS 'Check if the current user has the partner role';