/*
  # Add log query tracking functionality
  
  1. New Tables:
    - `log_queries` - Stores query logs for auditing and analysis
  
  2. Security:
    - RLS policies for proper access control
    - Admin access to all logs
    - User access to own logs only
    
  3. Helper Functions:
    - `is_admin()` - Utility function to check admin status
*/

-- Create log_queries table if it doesn't exist
CREATE TABLE IF NOT EXISTS log_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  source text NOT NULL,
  query text,
  created_at timestamptz DEFAULT now(),
  results_count integer,
  time_range text
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS log_queries_created_at_idx ON log_queries(created_at);
CREATE INDEX IF NOT EXISTS log_queries_source_idx ON log_queries(source);
CREATE INDEX IF NOT EXISTS log_queries_user_id_idx ON log_queries(user_id);

-- Enable Row Level Security
ALTER TABLE log_queries ENABLE ROW LEVEL SECURITY;

-- Create policies for access control using DO blocks to check existence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'log_queries' AND policyname = 'Admins can view all log queries'
  ) THEN
    EXECUTE format('
      CREATE POLICY "Admins can view all log queries" 
        ON log_queries 
        FOR SELECT 
        TO authenticated 
        USING (
          EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.user_role = ''admin''
          )
        );
    ');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'log_queries' AND policyname = 'Users can insert their own log queries'
  ) THEN
    EXECUTE format('
      CREATE POLICY "Users can insert their own log queries" 
        ON log_queries 
        FOR INSERT 
        TO authenticated 
        WITH CHECK (auth.uid() = user_id);
    ');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'log_queries' AND policyname = 'Users can view their own log queries'
  ) THEN
    EXECUTE format('
      CREATE POLICY "Users can view their own log queries" 
        ON log_queries 
        FOR SELECT 
        TO authenticated 
        USING (auth.uid() = user_id);
    ');
  END IF;
END $$;

-- Create helper function for checking admin status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin'
  ) THEN
    EXECUTE format('
      CREATE FUNCTION is_admin()
      RETURNS boolean
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $func$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM users
          WHERE id = auth.uid()
          AND user_role = ''admin''
        );
      END;
      $func$;
      
      -- Grant execution permission to authenticated users
      GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
    ');
  END IF;
END $$;