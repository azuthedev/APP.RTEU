-- Add missing columns to the trips table to support the enhanced booking management system

-- Add internal notes column if it doesn't exist
ALTER TABLE trips ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;

-- Add priority field (0=normal, 1=high, 2=urgent)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0;

-- Add last_reminder_sent timestamp
ALTER TABLE trips ADD COLUMN IF NOT EXISTS last_reminder_sent timestamptz DEFAULT NULL;

-- Add custom_fees JSON field to store custom fees and discounts
ALTER TABLE trips ADD COLUMN IF NOT EXISTS custom_fees jsonb DEFAULT '[]'::jsonb;

-- Add internal_tags array for tagging and categorization
ALTER TABLE trips ADD COLUMN IF NOT EXISTS internal_tags text[] DEFAULT '{}'::text[];

-- Create activity logs table to track all booking-related activities
CREATE TABLE IF NOT EXISTS booking_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster activity log queries
CREATE INDEX IF NOT EXISTS booking_activity_logs_booking_id_idx ON booking_activity_logs(booking_id);
CREATE INDEX IF NOT EXISTS booking_activity_logs_user_id_idx ON booking_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS booking_activity_logs_created_at_idx ON booking_activity_logs(created_at);

-- Add RLS policies for booking_activity_logs
ALTER TABLE booking_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all booking activity logs"
  ON booking_activity_logs
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.user_role = 'admin'
  ));

-- Users can insert logs
CREATE POLICY "Users can insert booking activity logs"
  ON booking_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);