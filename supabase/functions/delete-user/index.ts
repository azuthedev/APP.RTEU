// Supabase Edge Function to delete a user completely from both auth.users and public.users
// This function requires service role permissions to delete from auth.users

import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// CORS headers for the function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Create Supabase client with SERVICE_ROLE key (has elevated permissions)
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  {
    auth: {
      persistSession: false,
    }
  }
);

// Handle the incoming request
Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header is required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract the token
    const token = authHeader.replace("Bearer ", "");
    
    // Verify the token and check admin role
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if the user is an admin by querying the public.users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("user_role")
      .eq("id", user.id)
      .single();
      
    if (userError || userData?.user_role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin permissions required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body to get the user ID to delete
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Start the deletion process in a specific order to maintain referential integrity
    console.log(`Deleting user with ID: ${userId}`);
    
    // First, try to delete the user from public.users where we have referential constraints
    const { error: deletePublicUserError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId);

    // Check for public.users deletion error (except for "not found" which we can ignore)
    if (deletePublicUserError && !deletePublicUserError.message.includes("not found")) {
      console.error("Error deleting from public.users:", deletePublicUserError);
      // If deletion failed, return the error 
      return new Response(
        JSON.stringify({ 
          error: "Failed to delete user from public.users", 
          details: deletePublicUserError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user's email to have a better confirmation message
    const { data: userToDelete } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = userToDelete?.user?.email || "unknown";

    // Now delete from auth.users using the admin API
    const { error: deleteAuthUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthUserError) {
      console.error("Error deleting from auth.users:", deleteAuthUserError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to delete user from auth.users", 
          details: deleteAuthUserError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `User ${userEmail} has been completely deleted`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "An unexpected error occurred", 
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});