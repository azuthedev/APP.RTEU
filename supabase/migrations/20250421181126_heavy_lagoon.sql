-- Add profile image URL field to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS profile_image_url text DEFAULT NULL;

-- Add new fields to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type text DEFAULT NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS license_expiry date DEFAULT NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_expiry date DEFAULT NULL;

-- Create storage policy for profile images
DO $$
BEGIN
  -- Create the bucket if it doesn't exist
  -- Note: This requires admin access, intended to be run during database setup
  BEGIN
    PERFORM storage.create_bucket('driver_images', jsonb_build_object('public', false));
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Bucket might already exist or insufficient privileges';
  END;
END $$;

-- Allow drivers to upload their own profile images
CREATE POLICY "Drivers can upload their own profile images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver_images'
  AND (storage.foldername(name))[1] = 'profile_images'
  AND EXISTS (
    SELECT 1 FROM drivers
    WHERE drivers.id = (storage.foldername(name))[2]::uuid
    AND drivers.user_id = auth.uid()
  )
);

-- Allow drivers to read their own profile images
CREATE POLICY "Drivers can view their own profile images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver_images'
  AND (storage.foldername(name))[1] = 'profile_images'
  AND EXISTS (
    SELECT 1 FROM drivers
    WHERE drivers.id = (storage.foldername(name))[2]::uuid
    AND drivers.user_id = auth.uid()
  )
);

-- Allow admins to access all driver images
CREATE POLICY "Admins can access all driver images"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'driver_images'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.user_role = 'admin'
  )
);

-- Set profile images to public access
UPDATE storage.buckets
SET public = true
WHERE name = 'driver_images';