/*
  # Driver Verification Schema Update

  1. Schema Changes:
    - Adds verification_status field to drivers table
    - Adds verified_at timestamp to drivers table
    - Adds decline_reason text field to drivers table

  2. Updates:
    - Sets default verification_status to 'unverified'
    - Adds indexes for better query performance
*/

-- Add verification fields to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS verification_status text CHECK (
  verification_status IN ('unverified', 'pending', 'verified', 'declined')
) DEFAULT 'unverified';

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS verified_at timestamptz DEFAULT NULL;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS decline_reason text DEFAULT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS drivers_verification_status_idx ON drivers(verification_status);
CREATE INDEX IF NOT EXISTS drivers_verified_at_idx ON drivers(verified_at);

-- Add verified boolean to driver_documents if it doesn't exist
ALTER TABLE driver_documents ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;

-- Update existing rows to set default verification status if NULL
UPDATE drivers SET verification_status = 'unverified' WHERE verification_status IS NULL;