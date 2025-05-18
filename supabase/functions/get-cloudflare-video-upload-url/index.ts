import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Your actual frontend domain
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, upload-length, upload-metadata, tus-resumable, x-test-header", // x-test-header for debugging if needed
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Location, Stream-Media-Id, Tus-Resumable, Tus-Version, Tus-Extension, Tus-Max-Size, Tus-Checksum-Algorithm, Upload-Offset, Upload-Length"
};

const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");

console.log("[EdgeFn-CF-TUSURL-v2] Initializing. CF_ACCOUNT_ID provided:", !!CLOUDFLARE_ACCOUNT_ID, "CF_API_TOKEN provided:", !!CLOUDFLARE_API_TOKEN);

serve(async (req) => {
  // Log all incoming headers for debugging (can be removed in production)
  const incomingHeadersForLog: Record<string, string> = {};
  for (const [key, value] of req.headers.entries()) {
    incomingHeadersForLog[key.toLowerCase()] = value;
  }
  console.log("[EdgeFn-CF-TUSURL-v2] Request received. Method:", req.method, "URL:", req.url);
  console.log("[EdgeFn-CF-TUSURL-v2] All Incoming Headers (lowercase keys):", JSON.stringify(incomingHeadersForLog));
  
  const authHeader = req.headers.get("Authorization");
  console.log("[EdgeFn-CF-TUSURL-v2] Received Authorization header:", authHeader ? `${authHeader.substring(0, 15)}...` : "null");
  console.log("[EdgeFn-CF-TUSURL-v2] Received X-Test-Header:", req.headers.get("x-test-header"));

  if (req.method === "OPTIONS") {
    console.log("[EdgeFn-CF-TUSURL-v2] Handling OPTIONS preflight.");
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // Check for Authorization header (Supabase JWT)
  // Note: Supabase gateway typically handles JWT validation by default if function security is set to JWT.
  // If you are relying on that, this manual check might be redundant or could conflict.
  // However, for clarity and to ensure it was passed, we log it. If it's null, Supabase gateway likely already rejected.
  if (!authHeader) {
    console.error("[EdgeFn-CF-TUSURL-v2] Authorization header is missing. This request should have been rejected by Supabase gateway if JWT security is enforced.");
    // Even if gateway didn't reject, we will.
    return new Response(JSON.stringify({ error: "Authorization header required" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  if (req.method !== "POST") {
    console.warn("[EdgeFn-CF-TUSURL-v2] Method not allowed:", req.method);
    return new Response(JSON.stringify({ error: "Method not allowed. Only POST is accepted for TUS creation." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    console.error("[EdgeFn-CF-TUSURL-v2] CRITICAL SETUP ERROR: Missing Cloudflare API token or Account ID in environment variables.");
    return new Response(JSON.stringify({ error: "Cloudflare service misconfiguration on server." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const uploadLength = req.headers.get("Upload-Length");
  const uploadMetadata = req.headers.get("Upload-Metadata"); // Forwarded by tus-js-client
  const tusResumable = req.headers.get("Tus-Resumable");

  if (!tusResumable || tusResumable !== "1.0.0") {
    console.warn("[EdgeFn-CF-TUSURL-v2] Invalid or missing Tus-Resumable header:", tusResumable);
    return new Response(JSON.stringify({ error: "Invalid Tus-Resumable header." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 412 });
  }
  if (!uploadLength) {
    console.warn("[EdgeFn-CF-TUSURL-v2] Missing Upload-Length header.");
    return new Response(JSON.stringify({ error: "Missing Upload-Length header." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
  // uploadMetadata can be optional per Cloudflare docs, but TUS spec implies client should send if it has it.

  console.log("[EdgeFn-CF-TUSURL-v2] Attempting to create Cloudflare TUS upload. Headers to be sent to CF:", {
    "Authorization": "Bearer [REDACTED_CF_TOKEN]",
    "Tus-Resumable": tusResumable,
    "Upload-Length": uploadLength,
    ...(uploadMetadata && { "Upload-Metadata": uploadMetadata }),
  });

  try {
    const cfApiHeaders: HeadersInit = {
      "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Tus-Resumable": "1.0.0", // Must be 1.0.0
      "Upload-Length": uploadLength,
    };
    if (uploadMetadata) { // Only include if client sent it
      cfApiHeaders["Upload-Metadata"] = uploadMetadata;
    }

    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream?direct_user=true`,
      {
        method: "POST",
        headers: cfApiHeaders,
        body: null, // TUS creation POST has no body
      }
    );

    console.log("[EdgeFn-CF-TUSURL-v2] Cloudflare API response status:", cfResponse.status);

    const responseHeadersFromCF = new Headers(cfResponse.headers);

    if (cfResponse.status !== 201) {
      const errorBodyText = await cfResponse.text();
      console.error("[EdgeFn-CF-TUSURL-v2] Error from Cloudflare API. Status:", cfResponse.status, "Body:", errorBodyText);
      // Attempt to proxy Cloudflare's error response headers and status if possible
      const proxyErrorHeaders = new Headers(corsHeaders);
      responseHeadersFromCF.forEach((value, key) => {
        if(key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'content-length') { // Avoid issues with Deno serving gzipped empty body for example
            proxyErrorHeaders.set(key, value);
        }
      });
       proxyErrorHeaders.set("Content-Type", responseHeadersFromCF.get("Content-Type") || "application/json");

      return new Response(errorBodyText || JSON.stringify({ error: "Failed to create TUS upload at Cloudflare." }), {
        headers: proxyErrorHeaders,
        status: cfResponse.status, // Proxy CF status
      });
    }

    const location = responseHeadersFromCF.get("Location");
    const streamMediaId = responseHeadersFromCF.get("Stream-Media-Id");

    if (!location) {
      const allCFHeaders = Object.fromEntries(responseHeadersFromCF.entries());
      console.error("[EdgeFn-CF-TUSURL-v2] CRITICAL: Cloudflare TUS creation response missing Location header. CF Headers dump:", JSON.stringify(allCFHeaders));
      // This is a server-side issue with Cloudflare or our request, return 500.
      return new Response(JSON.stringify({ error: "Cloudflare did not return a TUS upload location." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
    }
    // streamMediaId is good to have but not strictly required by TUS client if Location is present.
    if (!streamMediaId) {
      console.warn("[EdgeFn-CF-TUSURL-v2] Cloudflare response missing Stream-Media-Id header. This is okay if Location is present. Location:", location);
    }

    console.log("[EdgeFn-CF-TUSURL-v2] Cloudflare TUS endpoint successfully created. Location:", location, "Stream-Media-Id:", streamMediaId);
    
    // Construct response headers for the TUS client
    const clientResponseHeaders = new Headers(corsHeaders);
    clientResponseHeaders.set("Location", location);
    if (streamMediaId) {
      clientResponseHeaders.set("Stream-Media-Id", streamMediaId);
    }
    // Standard TUS headers for creation response
    clientResponseHeaders.set("Tus-Resumable", "1.0.0");
    // Expose other relevant headers from Cloudflare if any, beyond Location and Stream-Media-Id, are needed by client
    // Example: cfResponse.headers.get('Tus-Version') etc. can be proxied if needed.

    return new Response(null, { // Successful TUS creation returns 201 with no body
      headers: clientResponseHeaders,
      status: 201,
    });

  } catch (error) {
    console.error("[EdgeFn-CF-TUSURL-v2] UNHANDLED EXCEPTION in TUS proxy logic:", error.message, error.stack, error);
    return new Response(JSON.stringify({ error: "Internal server error proxying TUS request to Cloudflare.", details: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}); 