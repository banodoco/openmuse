import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// import { corsHeaders } from "../_shared/cors.ts"; // Removed import

// CORS headers directly defined in the function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Or your specific frontend domain
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, upload-length, upload-metadata, tus-resumable",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Location, Stream-Media-Id, Tus-Resumable, Tus-Version, Tus-Extension, Tus-Max-Size, Tus-Checksum-Algorithm, Upload-Offset, Upload-Length"
};

const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");

console.log("[EdgeFunction-TUSProxy] Initializing. CF_ACCOUNT_ID provided:", !!CLOUDFLARE_ACCOUNT_ID, "CF_API_TOKEN provided:", !!CLOUDFLARE_API_TOKEN);

serve(async (req) => {
  console.log("[EdgeFunction-TUSProxy] Request received:", req.method, req.url);

  if (req.method === "OPTIONS") {
    console.log("[EdgeFunction-TUSProxy] Handling OPTIONS preflight.");
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    console.warn("[EdgeFunction-TUSProxy] Method not allowed:", req.method);
    return new Response(JSON.stringify({ error: "Method not allowed. Only POST is accepted for TUS creation." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    console.error("[EdgeFunction-TUSProxy] Missing Cloudflare API token or Account ID.");
    return new Response(JSON.stringify({ error: "Cloudflare configuration error." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const uploadLength = req.headers.get("Upload-Length");
  const uploadMetadata = req.headers.get("Upload-Metadata");
  const tusResumable = req.headers.get("Tus-Resumable");

  if (!tusResumable || tusResumable !== "1.0.0") {
    return new Response(JSON.stringify({ error: "Invalid Tus-Resumable header." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 412 });
  }
  if (!uploadLength) {
    return new Response(JSON.stringify({ error: "Missing Upload-Length header." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }

  console.log("[EdgeFunction-TUSProxy] Forwarding TUS creation request to Cloudflare with headers:", {
    "Upload-Length": uploadLength,
    "Upload-Metadata": uploadMetadata,
    "Tus-Resumable": tusResumable
  });

  try {
    const cfApiHeaders: HeadersInit = {
      "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": uploadLength,
    };
    if (uploadMetadata) {
      cfApiHeaders["Upload-Metadata"] = uploadMetadata;
    }

    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream?direct_user=true`,
      {
        method: "POST",
        headers: cfApiHeaders,
        body: null,
      }
    );

    console.log("[EdgeFunction-TUSProxy] Cloudflare API response status:", cfResponse.status);

    if (cfResponse.status !== 201) {
      const errorBody = await cfResponse.text();
      console.error("[EdgeFunction-TUSProxy] Cloudflare API error:", cfResponse.status, errorBody);
      return new Response(errorBody || JSON.stringify({ error: "Failed to create TUS upload at Cloudflare." }), {
        headers: { ...corsHeaders, "Content-Type": cfResponse.headers.get("Content-Type") || "application/json" },
        status: cfResponse.status,
      });
    }

    const location = cfResponse.headers.get("Location");
    const streamMediaId = cfResponse.headers.get("Stream-Media-Id");

    if (!location) {
      console.error("[EdgeFunction-TUSProxy] Cloudflare response missing Location header. Headers:", Object.fromEntries(cfResponse.headers.entries()));
      throw new Error("Cloudflare TUS creation response missing Location header.");
    }
     if (!streamMediaId) {
      console.warn("[EdgeFunction-TUSProxy] Cloudflare response missing Stream-Media-Id header. Will attempt to parse from Location. Location:", location);
    }

    console.log("[EdgeFunction-TUSProxy] Cloudflare TUS endpoint created. Location:", location, "Stream-Media-Id:", streamMediaId);
    
    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set("Location", location);
    if (streamMediaId) {
        responseHeaders.set("Stream-Media-Id", streamMediaId);
    }
    responseHeaders.set("Tus-Resumable", "1.0.0");

    return new Response(null, {
      headers: responseHeaders,
      status: 201,
    });

  } catch (error) {
    console.error("[EdgeFunction-TUSProxy] Internal error:", error.message, error.stack);
    return new Response(JSON.stringify({ error: "Internal server error proxying TUS request." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 