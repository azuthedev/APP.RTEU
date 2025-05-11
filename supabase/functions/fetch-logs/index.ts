// Edge function to fetch logs from various Supabase services
// Since this accesses admin-only resources, it needs Service Role permissions

import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface FetchLogsRequest {
  source: string;
  timeRange: '15m' | '1h' | '6h' | '24h' | '7d';
  limit: number;
}

// Map time ranges to milliseconds for date calculations
const timeRangeToMs = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
};

// Create Supabase admin client with service role
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

// Helper function to check if a table exists
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
      .single();
    
    if (error) {
      console.error(`Error checking table ${tableName}:`, error);
      return false;
    }
    
    return !!data;
  } catch (e) {
    console.error(`Error checking if table ${tableName} exists:`, e);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Extract authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header is required");
    }

    // Verify JWT and check admin role
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Invalid or expired token");
    }

    // Check if the user is an admin
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("user_role")
      .eq("id", user.id)
      .single();
      
    if (userError || userData?.user_role !== "admin") {
      throw new Error("Admin permissions required");
    }

    // Parse request body
    let requestData: FetchLogsRequest;
    try {
      requestData = await req.json();
    } catch (e) {
      const url = new URL(req.url);
      requestData = {
        source: url.searchParams.get('source') || 'all',
        timeRange: (url.searchParams.get('timeRange') || '1h') as '1h',
        limit: parseInt(url.searchParams.get('limit') || '100', 10)
      };
    }
    
    const { source = 'all', timeRange = '1h', limit = 100 } = requestData;

    // Calculate time range for log retrieval
    const startTime = new Date(Date.now() - timeRangeToMs[timeRange]).toISOString();
    
    // Function to query logs from a table safely
    async function queryLogsFromTable(tableName: string, timeColumn = 'created_at', serviceColumn?: string, sourceValue?: string) {
      const exists = await tableExists(tableName);
      if (!exists) {
        console.log(`Table ${tableName} does not exist, skipping`);
        return { data: [], count: 0 };
      }

      try {
        let query = supabaseAdmin
          .from(tableName)
          .select('*', { count: 'exact' })
          .gte(timeColumn, startTime)
          .order(timeColumn, { ascending: false });
          
        if (serviceColumn && sourceValue && sourceValue !== 'all') {
          query = query.eq(serviceColumn, sourceValue);
        }
        
        const { data, error, count } = await query.limit(limit);
        
        if (error) {
          console.error(`Error querying ${tableName}:`, error);
          return { data: [], count: 0 };
        }
        
        return { 
          data: data || [], 
          count: count || 0 
        };
      } catch (e) {
        console.error(`Error querying ${tableName}:`, e);
        return { data: [], count: 0 };
      }
    }

    // Query logs based on source
    let logs = [];
    let totalCount = 0;

    // Only generate sample logs if tables don't exist
    if (source === 'all') {
      const hasLogQueries = await tableExists('log_queries');
      const hasZendeskTickets = await tableExists('zendesk_tickets');
      
      if (!hasLogQueries && !hasZendeskTickets) {
        logs = generateSampleLogs(limit);
        totalCount = logs.length;
      } else {
        // Query from existing tables
        const queries = [];
        
        if (hasLogQueries) {
          queries.push(queryLogsFromTable('log_queries'));
        }
        if (hasZendeskTickets) {
          queries.push(queryLogsFromTable('zendesk_tickets'));
        }
        
        const results = await Promise.all(queries);
        logs = results.flatMap(r => r.data);
        totalCount = results.reduce((sum, r) => sum + r.count, 0);
      }
    } else {
      const tableMap: Record<string, string> = {
        'auth': 'log_queries',
        'support': 'zendesk_tickets',
        'trips': 'trips',
        'payments': 'payments'
      };
      
      const tableName = tableMap[source];
      if (tableName) {
        const { data, count } = await queryLogsFromTable(tableName);
        logs = data;
        totalCount = count;
      }
      
      // Only generate sample logs if no real logs were found
      if (logs.length === 0) {
        logs = generateSampleLogs(limit, source);
        totalCount = logs.length;
      }
    }

    // Format logs consistently
    const formattedLogs = logs.map(log => ({
      id: log.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      level: log.level || (log.status === 'error' ? 'error' : 
                          log.status === 'warn' ? 'warn' : 'info'),
      message: log.message || log.msg || log.description || 
               (log.status ? `Status: ${log.status}` : JSON.stringify(log)),
      timestamp: log.timestamp || log.created_at || new Date().toISOString(),
      service: log.service || source,
      userId: log.user_id || log.userId,
      sessionId: log.session_id || log.sessionId,
      additionalData: log
    }));

    return new Response(
      JSON.stringify({ 
        logs: formattedLogs,
        total: totalCount,
        source,
        timeRange,
        isSampleData: logs.some(log => log.additionalData?.sample)
      }),
      {
        status: 200,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        },
      }
    );
  } catch (error) {
    console.error("Error handling request:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "An error occurred while fetching logs",
        status: "error",
        isSampleData: true,
        logs: generateSampleLogs(10) // Provide sample logs on error
      }),
      {
        status: error.message?.includes("Authorization") ? 401 :
               error.message?.includes("Admin") ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper function to generate sample logs
function generateSampleLogs(count = 10, serviceType: string | null = null) {
  const services = serviceType ? [serviceType] : ['auth', 'database', 'api', 'storage', 'edge-functions'];
  const levels = ['info', 'warn', 'error', 'debug'];
  const messages = [
    'User login successful',
    'Password reset requested',
    'Database query completed',
    'File uploaded to storage',
    'API endpoint called',
    'Authentication token expired',
    'Rate limit exceeded',
    'Database connection pool saturated',
    'Cache miss for frequent query',
    'Configuration update applied'
  ];
  
  return Array(count).fill(0).map((_, i) => {
    const service = services[Math.floor(Math.random() * services.length)];
    const level = levels[Math.floor(Math.random() * levels.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const timestamp = new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString();
    
    return {
      id: `sample_${i}_${Date.now()}`,
      service,
      level,
      message,
      timestamp,
      userId: level === 'error' ? null : `sample-user-${i}`,
      additionalData: {
        source: 'sample',
        request_id: `req_${Date.now()}_${i}`,
        sample: true
      }
    };
  });
}