/*
  # Create function to get driver counts

  1. Database Function
    - Creates a new database function `get_driver_counts` that returns driver statistics
    - Allows admin users to access driver counts without direct table access
  
  2. Security
    - Function is SECURITY DEFINER to execute with creator's permissions
    - Returns count of total drivers and active drivers
*/

-- Function for admin users to get driver counts while bypassing RLS
CREATE OR REPLACE FUNCTION public.get_driver_counts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Execute with privileges of function creator
AS $$
DECLARE
  total_count integer;
  active_count integer;
  result json;
BEGIN
  -- Only allow admins to execute this function
  IF (SELECT user_role FROM public.users WHERE id = auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Only admin users can access driver counts';
  END IF;

  SELECT COUNT(*) INTO total_count FROM public.drivers;
  SELECT COUNT(*) INTO active_count FROM public.drivers WHERE is_available = true;

  result := json_build_object(
    'total', total_count,
    'active', active_count
  );

  RETURN result;
END;
$$;

-- Grant EXECUTE permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.get_driver_counts() TO authenticated;

COMMENT ON FUNCTION public.get_driver_counts() IS 'Get count of total and active drivers, restricted to admin users';