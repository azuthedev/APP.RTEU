/*
  # Add log query functions

  1. New Tables:
    - `log_queries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users.id)
      - `source` (text)
      - `query` (text)
      - `created_at` (timestamp)
      - `results_count` (integer)
      - `time_range` (text)

  2. Security
    - Enable RLS on `log_queries` table
    - Add policies for admins to view all queries
    - Add policies for authenticated users to see their own queries

  3. Functions:
    - `log_query_attempt` - Records log query attempts for auditing
*/

-- Create table to track log queries for auditing and analytics
CREATE TABLE IF NOT EXISTS public.log_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  source text NOT NULL,
  query text,
  created_at timestamptz DEFAULT now(),
  results_count integer,
  time_range text
);

-- Enable RLS on the new table
ALTER TABLE public.log_queries ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own queries
CREATE POLICY "Users can insert their own log queries"
  ON public.log_queries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own queries 
CREATE POLICY "Users can view their own log queries"
  ON public.log_queries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to view all queries (for auditing)
CREATE POLICY "Admins can view all log queries"
  ON public.log_queries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.user_role = 'admin'
    )
  );

-- Add indexes
CREATE INDEX IF NOT EXISTS log_queries_user_id_idx ON public.log_queries(user_id);
CREATE INDEX IF NOT EXISTS log_queries_created_at_idx ON public.log_queries(created_at);
CREATE INDEX IF NOT EXISTS log_queries_source_idx ON public.log_queries(source);

-- Create function to record log query attempts
CREATE OR REPLACE FUNCTION public.log_query_attempt(
  p_source text,
  p_query text,
  p_time_range text,
  p_results_count integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Verify the user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Insert the log query record
  INSERT INTO public.log_queries (
    user_id, 
    source, 
    query, 
    time_range, 
    results_count
  )
  VALUES (
    auth.uid(),
    p_source,
    p_query,
    p_time_range,
    p_results_count
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.log_query_attempt TO authenticated;

COMMENT ON FUNCTION public.log_query_attempt IS 'Records a log query attempt for auditing purposes';