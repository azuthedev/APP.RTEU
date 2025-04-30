import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
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
    
    // Initialize Supabase client with user's token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // First, check if driver is a partner
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_role")
      .eq("id", user.id)
      .single();
      
    if (userError) {
      return new Response(
        JSON.stringify({ error: "Failed to verify user role" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (userData.user_role !== "partner" && userData.user_role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only partners can access document requirements" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get driver id if exists
    const { data: driverId, error: driverIdError } = await supabase
      .rpc("get_user_driver_id");
      
    let driverStatus = null;
    let driverDocs = [];
    
    if (driverId) {
      // Get driver verification status
      const { data: driverData, error: driverError } = await supabase
        .from("drivers")
        .select("verification_status, decline_reason")
        .eq("id", driverId)
        .single();
        
      if (!driverError && driverData) {
        driverStatus = {
          status: driverData.verification_status,
          declineReason: driverData.decline_reason
        };
      }
      
      // Get uploaded documents
      const { data: documents, error: docsError } = await supabase
        .from("driver_documents")
        .select("*")
        .eq("driver_id", driverId);
        
      if (!docsError) {
        driverDocs = documents || [];
      }
    }

    // Define document requirements
    const documentRequirements = [
      {
        type: "license",
        label: "Driver License",
        description: "Valid driver license issued by government",
        required: true,
        formats: ["jpg", "jpeg", "png", "pdf"],
        maxSize: "5MB",
        expiryRequired: true,
      },
      {
        type: "insurance",
        label: "Insurance Certificate",
        description: "Valid vehicle insurance document",
        required: true,
        formats: ["jpg", "jpeg", "png", "pdf"],
        maxSize: "5MB",
        expiryRequired: true,
      },
      {
        type: "registration",
        label: "Vehicle Registration",
        description: "Valid vehicle registration document",
        required: true,
        formats: ["jpg", "jpeg", "png", "pdf"],
        maxSize: "5MB",
        expiryRequired: true,
      },
      {
        type: "other",
        label: "Other Document",
        description: "Any other relevant document",
        required: false,
        formats: ["jpg", "jpeg", "png", "pdf"],
        maxSize: "5MB",
        expiryRequired: false,
      }
    ];

    return new Response(
      JSON.stringify({
        requirements: documentRequirements,
        driverId,
        driverStatus,
        documents: driverDocs,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});