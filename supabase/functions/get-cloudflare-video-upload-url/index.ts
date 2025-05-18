import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "shared/cors.ts";

const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");

serve(async (req: Request) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    return new Response(
      JSON.stringify({ error: "Cloudflare API token or Account ID not set in environment variables." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }

  try {
    // const { maxDurationSeconds, metadata } = await req.json(); 
    // maxDurationSeconds is not directly used when fetching TUS upload URL this way.
    // It can be set as Upload-Metadata by the TUS client later.
    // For now, we'll remove it from the direct request body to simplify,
    // as the primary goal is to get the TUS endpoint.
    // The client will handle sending metadata like filename, maxDurationSeconds with the TUS upload itself.

    const tusEndpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream?direct_user=true`;
    
    const cfResponse = await fetch(tusEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
        // According to Cloudflare docs for TUS, specific TUS headers like
        // Tus-Resumable, Upload-Length, Upload-Metadata are sent by the client
        // to the 'Location' URL returned by this initial request.
        // This first request just establishes the TUS endpoint for the client.
      },
      // Body is typically empty for this initial TUS endpoint request,
      // or might contain 'upload-creator' if you have creator IDs.
    });

    if (!cfResponse.ok) {
      const errorBody = await cfResponse.text();
      console.error("Cloudflare API error:", cfResponse.status, errorBody);
      return new Response(
        JSON.stringify({ error: "Failed to get Cloudflare TUS endpoint.", details: errorBody }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: cfResponse.status }
      );
    }

    const tusUploadUrl = cfResponse.headers.get("Location");
    if (!tusUploadUrl) {
        console.error("Cloudflare response did not include TUS Location header. Headers:", JSON.stringify(Object.fromEntries(cfResponse.headers.entries())));
        return new Response(
            JSON.stringify({ error: "Cloudflare response did not include TUS Location header." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
    
    const uid = tusUploadUrl.substring(tusUploadUrl.lastIndexOf('/') + 1);

    return new Response(
      JSON.stringify({ uploadURL: tusUploadUrl, uid: uid, provider: 'cloudflare-stream' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in Edge Function:", error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}); 