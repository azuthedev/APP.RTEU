-- Create RPC function to allow partners to safely check their driver profile
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

-- Function to check partner status
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

-- Fix permissions for drivers table
DO $$
BEGIN
  -- Check if policies exist before trying to drop them
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can create their own driver profile'
  ) THEN
    DROP POLICY "Partners can create their own driver profile" ON drivers;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can update their own driver profile'
  ) THEN
    DROP POLICY "Partners can update their own driver profile" ON drivers;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can view their own driver profiles'
  ) THEN
    DROP POLICY "Partners can view their own driver profiles" ON drivers;
  END IF;
END$$;

-- Create policies for partners to manage their own driver profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can create their own driver profile'
  ) THEN
    CREATE POLICY "Partners can create their own driver profile"
    ON drivers
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND is_partner());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can update their own driver profile'
  ) THEN
    CREATE POLICY "Partners can update their own driver profile"
    ON drivers
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() AND is_partner());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Partners can view their own driver profiles'
  ) THEN
    CREATE POLICY "Partners can view their own driver profiles"
    ON drivers
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR is_admin());
  END IF;
END$$;

-- Fix permissions for driver_documents table
ALTER TABLE IF EXISTS driver_documents ENABLE ROW LEVEL SECURITY;

-- Check for existing policies before creating new ones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_documents' AND policyname = 'Partners can view their own documents'
  ) THEN
    CREATE POLICY "Partners can view their own documents"
    ON driver_documents
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
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_documents' AND policyname = 'Partners can upload their own documents'
  ) THEN
    CREATE POLICY "Partners can upload their own documents"
    ON driver_documents
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
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_documents' AND policyname = 'Partners can update their own documents'
  ) THEN
    CREATE POLICY "Partners can update their own documents"
    ON driver_documents
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
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_documents' AND policyname = 'Partners can delete their own documents'
  ) THEN
    CREATE POLICY "Partners can delete their own documents"
    ON driver_documents
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

-- Handle storage policy
DO $$
BEGIN
  -- Check if storage.objects table exists before trying to drop policy
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'storage' AND tablename = 'objects'
  ) THEN
    -- Check if the policy exists before dropping it
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Partners can upload their own document files'
    ) THEN
      DROP POLICY IF EXISTS "Partners can upload their own document files" ON storage.objects;
    END IF;
    
    -- Check if the policy already exists before creating it
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Partners can upload their own document files'
    ) THEN
      CREATE POLICY "Partners can upload their own document files"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = 'driver_documents'
      );
    END IF;
  END IF;
END$$;

-- Function to validate and set driver verification status
CREATE OR REPLACE FUNCTION submit_driver_for_verification(driver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_owner boolean;
  has_docs boolean;
BEGIN
  -- Check if user is the owner of this driver profile
  SELECT EXISTS (
    SELECT 1 FROM drivers
    WHERE id = driver_id
    AND user_id = auth.uid()
  ) INTO is_owner;
  
  IF NOT is_owner THEN
    RAISE EXCEPTION 'You do not have permission to modify this driver profile';
  END IF;
  
  -- Check if any documents are uploaded
  SELECT EXISTS (
    SELECT 1 
    FROM driver_documents
    WHERE driver_id = submit_driver_for_verification.driver_id
  ) INTO has_docs;
  
  IF NOT has_docs THEN
    RAISE EXCEPTION 'At least one document must be uploaded before submission';
  END IF;
  
  -- Update driver status to pending
  UPDATE drivers
  SET 
    verification_status = 'pending',
    updated_at = now()
  WHERE id = driver_id
  AND user_id = auth.uid();
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION submit_driver_for_verification TO authenticated;