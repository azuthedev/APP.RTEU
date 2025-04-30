/*
  # Add platform_settings table and policies

  1. New Tables:
    - `platform_settings` - Global configuration for the system
  
  2. Security:
    - RLS policies for admin access
    - Safe creation of policies to handle idempotent runs
*/

-- Create the platform_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_currency text NOT NULL DEFAULT 'EUR',
  default_timezone text NOT NULL DEFAULT 'Europe/Berlin',
  booking_auto_assign boolean NOT NULL DEFAULT false,
  driver_verification_required boolean NOT NULL DEFAULT true,
  admin_email_notifications boolean NOT NULL DEFAULT true,
  email_from_name text NOT NULL DEFAULT 'Royal Transfer',
  email_contact_address text NOT NULL DEFAULT 'support@royaltransfer.eu',
  privacy_policy_url text NOT NULL DEFAULT 'https://royaltransfer.eu/privacy',
  terms_url text NOT NULL DEFAULT 'https://royaltransfer.eu/terms',
  max_failed_login_attempts integer NOT NULL DEFAULT 5,
  maintenance_mode boolean NOT NULL DEFAULT false,
  api_rate_limit integer NOT NULL DEFAULT 60,
  min_password_length integer NOT NULL DEFAULT 8,
  auto_archive_days integer NOT NULL DEFAULT 90,
  last_updated_by uuid REFERENCES users(id),
  last_updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security if not already enabled
DO $$
BEGIN
  -- Check if RLS is already enabled
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'platform_settings' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create admin policies safely - only if they don't already exist
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'platform_settings' 
    AND policyname = 'Admins can read platform settings'
  ) THEN
    CREATE POLICY "Admins can read platform settings"
      ON platform_settings
      FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.user_role = 'admin'
      ));
  END IF;
  
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'platform_settings' 
    AND policyname = 'Admins can update platform settings'
  ) THEN
    CREATE POLICY "Admins can update platform settings"
      ON platform_settings
      FOR UPDATE
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.user_role = 'admin'
      ));
  END IF;
  
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'platform_settings' 
    AND policyname = 'Admins can insert platform settings'
  ) THEN
    CREATE POLICY "Admins can insert platform settings"
      ON platform_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.user_role = 'admin'
      ));
  END IF;
END $$;

-- Safely create/replace the is_admin function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.user_role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default settings if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM platform_settings LIMIT 1) THEN
    INSERT INTO platform_settings (
      default_currency,
      default_timezone,
      booking_auto_assign,
      driver_verification_required,
      admin_email_notifications,
      email_from_name,
      email_contact_address,
      privacy_policy_url,
      terms_url,
      max_failed_login_attempts,
      maintenance_mode,
      api_rate_limit,
      min_password_length,
      auto_archive_days
    ) VALUES (
      'EUR',
      'Europe/Berlin',
      false,
      true,
      true,
      'Royal Transfer',
      'support@royaltransfer.eu',
      'https://royaltransfer.eu/privacy',
      'https://royaltransfer.eu/terms',
      5,
      false,
      60,
      8,
      90
    );
  END IF;
END $$;