import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// import { corsHeaders } from "../_shared/cors.ts"; // Removed import

// CORS headers simplified for this debug step, ensure X-Test-Header is allowed if testing that.
const corsHeadersForOptions = {
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, upload-length, upload-metadata, tus-resumable, x-test-header", // Added x-test-header
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Location, Stream-Media-Id, Tus-Resumable, Tus-Version, Tus-Extension, Tus-Max-Size, Tus-Checksum-Algorithm, Upload-Offset, Upload-Length"
};

const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");

console.log("[EdgeFunction-TUSProxy-SIMPLIFIED-DEBUG] Function Initializing.");

serve(async (req) => {
  const incomingHeaders: Record<string, string> = {};
  for (const [key, value] of req.headers.entries()) {
    incomingHeaders[key.toLowerCase()] = value; // Store keys as lowercase for easier access
  }

  console.log(`[EdgeFunction-TUSProxy-SIMPLIFIED-DEBUG] Request Method: ${req.method}, URL: ${req.url}`);
  console.log("[EdgeFunction-TUSProxy-SIMPLIFIED-DEBUG] ALL INCOMING HEADERS (keys lowercased):", JSON.stringify(incomingHeaders));
  console.log("[EdgeFunction-TUSProxy-SIMPLIFIED-DEBUG] Raw req.headers.get('Authorization'):", req.headers.get("Authorization"));
  console.log("[EdgeFunction-TUSProxy-SIMPLIFIED-DEBUG] Raw req.headers.get('x-test-header'):", req.headers.get("x-test-header"));
  console.log("[EdgeFunction-TUSProxy-SIMPLIFIED-DEBUG] Manually checked incomingHeaders.authorization:", incomingHeaders["authorization"]);
  console.log("[EdgeFunction-TUSProxy-SIMPLIFIED-DEBUG] Manually checked incomingHeaders.x-test-header:", incomingHeaders["x-test-header"]);

  if (req.method === "OPTIONS") {
    console.log("[EdgeFunction-TUSProxy-SIMPLIFIED-DEBUG] Handling OPTIONS preflight.");
    return new Response(null, { headers: corsHeadersForOptions, status: 204 });
  }

  // For any non-OPTIONS request (e.g., POST), just return the headers received and a 200 OK.
  // This bypasses all other logic to focus on what headers arrive.
  console.log("[EdgeFunction-TUSProxy-SIMPLIFIED-DEBUG] Returning received headers for non-OPTIONS request.");
  return new Response(JSON.stringify({ message: "Debug: Received headers", receivedHeaders: incomingHeaders }), {
    headers: { 
      "Content-Type": "application/json", 
      "Access-Control-Allow-Origin": "*" // Basic CORS for the response
    },
    status: 200, // Respond with 200 OK to see if TUS client proceeds differently
  });
}); 