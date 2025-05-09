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
    
    // Create supabase client with user token for auth verification
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

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token", details: authError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const docType = formData.get("docType") as string;
    const driverId = formData.get("driverId") as string;
    const expiryDate = formData.get("expiryDate") as string;
    const fileName = formData.get("fileName") as string;

    if (!file || !docType || !driverId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file, docType, driverId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create supabase service client with admin permissions
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      {
        auth: {
          persistSession: false,
        }
      }
    );

    // Verify user owns this driver ID
    const { data: driverData, error: driverError } = await supabaseAdmin
      .from("drivers")
      .select("user_id")
      .eq("id", driverId)
      .single();

    if (driverError || !driverData) {
      return new Response(
        JSON.stringify({ error: "Driver not found", details: driverError?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (driverData.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "You do not have permission to upload documents for this driver" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if bucket exists and create if it doesn't
    const { data: buckets } = await supabaseAdmin
      .storage
      .listBuckets();
      
    const bucketExists = buckets?.some(bucket => bucket.name === "documents");
    
    if (!bucketExists) {
      await supabaseAdmin.storage.createBucket("documents", {
        public: false,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB limit
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf']
      });
    }

    // Generate file path
    const fileExt = fileName.split('.').pop();
    const filePath = `driver_documents/${driverId}/${docType}_${Date.now()}.${fileExt}`;

    // Delete previous document of the same type (if exists)
    const { data: existingDocs } = await supabaseAdmin
      .from("driver_documents")
      .select("id, file_url")
      .eq("driver_id", driverId)
      .eq("doc_type", docType);

    if (existingDocs && existingDocs.length > 0) {
      // Extract storage paths from URLs
      for (const doc of existingDocs) {
        try {
          const url = new URL(doc.file_url);
          const pathParts = url.pathname.split('/');
          const storagePath = pathParts.slice(pathParts.indexOf('documents') + 1).join('/');
          
          // Delete the file from storage
          await supabaseAdmin.storage.from("documents").remove([storagePath]);
        } catch (err) {
          console.error("Error deleting previous file:", err);
          // Continue anyway - old file might not exist
        }

        // Delete the database record
        await supabaseAdmin
          .from("driver_documents")
          .delete()
          .eq("id", doc.id);
      }
    }

    // Upload the new file
    const fileArrayBuffer = await file.arrayBuffer();
    const fileUint8Array = new Uint8Array(fileArrayBuffer);

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(filePath, fileUint8Array, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: "Failed to upload file", details: uploadError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("documents")
      .getPublicUrl(filePath);

    // Insert the document record
    const { data: docData, error: docError } = await supabaseAdmin
      .from("driver_documents")
      .insert({
        driver_id: driverId,
        doc_type: docType,
        file_url: publicUrl,
        name: fileName,
        verified: false,
        expiry_date: expiryDate || null
      })
      .select()
      .single();

    if (docError) {
      return new Response(
        JSON.stringify({ error: "Failed to create document record", details: docError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        document: docData,
        publicUrl
      }),
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