/*
  # Create get_zones_list function

  1. New Functions
    - `get_zones_list` - Function to safely fetch zones information with proper security
  
  2. Security
    - Function is created as DEFINER with security invoker to bypass RLS policies
*/

-- Create a function to get zones list safely
CREATE OR REPLACE FUNCTION public.get_zones_list()
RETURNS TABLE (
  id uuid,
  name text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    zones.id,
    zones.name
  FROM zones
  ORDER BY zones.name;
END;
$$;

-- Grant execution permissions for authenticated users
GRANT EXECUTE ON FUNCTION public.get_zones_list() TO authenticated;