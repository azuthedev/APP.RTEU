import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get authentication token from request header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Create Supabase admin client with service role key first
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      {
        auth: {
          persistSession: false,
        }
      }
    );

    // Use admin client to verify the JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token", details: authError }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is admin, support, or partner
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("user_role, id")
      .eq("id", user.id)
      .single();
      
    if (userError) {
      return new Response(
        JSON.stringify({ error: "Error checking user role", details: userError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Allow partners to access the endpoint, in addition to admins and support
    const isAdminOrSupport = userData?.user_role === "admin" || userData?.user_role === "support";
    const isPartner = userData?.user_role === "partner";
    
    if (!isAdminOrSupport && !isPartner) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // For partners, only allow access to their own driver data
    let driversQuery = supabaseAdmin.from("drivers").select(`
      *,
      user:users!drivers_user_id_fkey(id, name, email, phone, user_role)
    `);
    
    // If user is a partner, restrict to only their own driver data
    if (isPartner) {
      driversQuery = driversQuery.eq("user_id", userData.id);
    }
    
    // Order results
    driversQuery = driversQuery.order("created_at", { ascending: false });
    
    // Execute the query
    const { data: existingDrivers, error: driversError } = await driversQuery;

    if (driversError) {
      console.error("Error fetching drivers:", driversError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch drivers", details: driversError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // For admin/support users, also include partners without driver profiles
    let combinedResults = [...(existingDrivers || [])];
    
    if (isAdminOrSupport) {
      // 2. Find all users with "partner" role
      const { data: partnerUsers, error: partnerError } = await supabaseAdmin
        .from("users")
        .select(`
          id, name, email, phone, created_at, user_role, updated_at
        `)
        .eq("user_role", "partner")
        .order("created_at", { ascending: false });

      if (partnerError) {
        console.error("Error fetching partner users:", partnerError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch partner users", details: partnerError }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // 3. Create a set of user IDs who already have driver profiles
      const existingDriverUserIds = new Set(
        (existingDrivers || []).map(driver => driver.user_id)
      );

      // 4. Find partners without driver profiles
      const partnersWithoutDrivers = (partnerUsers || [])
        .filter(user => !existingDriverUserIds.has(user.id))
        .map(user => ({
          id: `pending_${user.id}`, // Add a prefix to avoid ID conflicts
          user_id: user.id,
          verification_status: 'unverified',
          is_available: false,
          created_at: user.created_at,
          _isPartnerWithoutProfile: true, // Add a flag to identify these records
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone
          }
        }));

      // 5. Combine existing drivers and partners without driver profiles
      combinedResults = [
        ...combinedResults,
        ...partnersWithoutDrivers
      ];
    }

    // Get document counts for drivers
    const driversWithDocCounts = await Promise.all(combinedResults.map(async (driver) => {
      // Only query document counts for real drivers (not pending partners)
      if (driver._isPartnerWithoutProfile) {
        return {
          ...driver,
          _documentCount: 0
        };
      }
      
      const { count, error: countError } = await supabaseAdmin
        .from("driver_documents")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", driver.id);
          
      return {
        ...driver,
        _documentCount: countError ? 0 : (count || 0)
      };
    }));

    return new Response(
      JSON.stringify(driversWithDocCounts),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});