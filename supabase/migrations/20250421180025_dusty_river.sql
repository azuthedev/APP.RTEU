/*
  # Create platform settings table
  
  1. New Tables:
    - `platform_settings` - Stores global system configuration options
  
  2. Purpose:
    - Centralize application settings for admin configuration
    - Store system-wide defaults and options
    
  3. Security:
    - RLS policies limit access to admin users only
*/

-- Create platform settings table
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

-- Enable Row Level Security
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Policies for admins only
CREATE POLICY "Admins can read platform settings" 
  ON platform_settings 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

CREATE POLICY "Admins can insert platform settings" 
  ON platform_settings 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

CREATE POLICY "Admins can update platform settings" 
  ON platform_settings 
  FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

-- Comment
COMMENT ON TABLE platform_settings IS 'Global system configuration options manageable by admins';