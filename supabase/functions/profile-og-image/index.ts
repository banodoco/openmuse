import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Profile OG Image function starting up');

// Helper function to escape XML/HTML characters
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    // Assuming URL structure is /functions/v1/profile-og-image/DISPLAY_NAME
    const rawDisplayName = pathParts[pathParts.length - 1];
    
    if (!rawDisplayName) {
      throw new Error("Display name not provided in the URL path.");
    }

    const displayName = decodeURIComponent(rawDisplayName);
    console.log(`Generating OG image for display name: ${displayName}`);

    // Initialize Supabase client
    const supabaseClient = createClient(
      // Ensure these environment variables are set in your Supabase project settings
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Fetch profile data
    console.log(`Fetching profile for: ${displayName}`);
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('display_name, username, avatar_url, background_image_url')
      .or(`display_name.eq.${displayName},username.eq.${displayName}`) // Fetch by display name or username
      .maybeSingle();

    if (error) {
      console.error('Supabase error fetching profile:', error);
      throw new Error(`Error fetching profile: ${error.message}`);
    }

    if (!profile) {
      console.warn(`Profile not found for: ${displayName}`);
      // Return a default fallback image or error response
       return new Response(generateFallbackSvg("User Not Found"), { 
         headers: { ...corsHeaders, 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=60' }, // Cache not found for 1 min
         status: 404 
       });
    }

    console.log(`Profile found: ${profile.display_name || profile.username}`);
    const finalDisplayName = profile.display_name || profile.username;
    const avatarUrl = profile.avatar_url;
    const backgroundUrl = profile.background_image_url;

    // --- Generate SVG ---
    const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <style>
      .name-text {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
        font-size: 70px;
        font-weight: bold;
        fill: white;
        filter: drop-shadow(3px 3px 4px rgba(0,0,0,0.5));
      }
       .background-fallback {
         fill: linear-gradient(to bottom right, #a7e1d2, #dbd1a7); /* Cream to Olive gradient */
       }
       .avatar-fallback {
         fill: #a7e1d2; /* Cream */
         stroke: #fff;
         stroke-width: 8;
       }
    </style>
    <clipPath id="avatarClip">
      <circle cx="150" cy="150" r="100" />
    </clipPath>
  </defs>

  <!-- Background -->
  ${backgroundUrl ? `
    <image href="${escapeHtml(backgroundUrl)}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice" />
    <rect x="0" y="0" width="1200" height="630" fill="rgba(0,0,0,0.3)" /> <!-- Dark overlay for text contrast -->
  ` : `
    <rect x="0" y="0" width="1200" height="630" class="background-fallback" />
  `}

  <!-- Avatar -->
  ${avatarUrl ? `
    <image href="${escapeHtml(avatarUrl)}" x="50" y="50" width="200" height="200" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice" />
    <circle cx="150" cy="150" r="100" fill="none" stroke="#fff" stroke-width="8" /> <!-- White border -->
  ` : `
    <circle cx="150" cy="150" r="100" class="avatar-fallback" />
  `}

  <!-- Display Name -->
  <text x="100" y="350" class="name-text">${escapeHtml(finalDisplayName)}</text>
  
  <!-- Optional: Site Name/Logo -->
  <text x="1150" y="590" font-size="30" fill="#ffffffcc" text-anchor="end" font-family="sans-serif" font-weight="600">OpenMuse</text>

</svg>
`;

    console.log('SVG generated successfully.');
    return new Response(svg, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'image/svg+xml',
        // Cache for 1 hour, stale-while-revalidate for 1 day
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' 
      },
      status: 200,
    });

  } catch (error) {
    console.error('Error in Edge Function:', error);
    // Generate a generic error SVG
    const errorSvg = generateFallbackSvg("Error Generating Image");
    return new Response(errorSvg, { 
      headers: { ...corsHeaders, 'Content-Type': 'image/svg+xml' },
      status: 500 
    });
  }
});

// Helper to generate fallback SVG content
function generateFallbackSvg(message: string): string {
  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .message-text {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
        font-size: 60px;
        font-weight: bold;
        fill: #555;
        text-anchor: middle;
      }
       .background-fallback {
         fill: #eee;
       }
    </style>
  </defs>
  <rect x="0" y="0" width="1200" height="630" class="background-fallback" />
  <text x="600" y="330" class="message-text">${escapeHtml(message)}</text>
</svg>
  `;
} 