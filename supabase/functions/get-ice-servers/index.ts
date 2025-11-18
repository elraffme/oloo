import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ICEServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface ICEServersResponse {
  iceServers: ICEServer[];
  hasTURN: boolean;
  warning?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read TURN configuration from Edge Function secrets
    const turnUrls = Deno.env.get('TURN_URLS');
    const turnUsername = Deno.env.get('TURN_USERNAME');
    const turnCredential = Deno.env.get('TURN_CREDENTIAL');

    const iceServers: ICEServer[] = [];
    let hasTURN = false;

    // Add TURN servers if configured
    if (turnUrls && turnUsername && turnCredential) {
      const urls = turnUrls.split(',').map(url => url.trim()).filter(url => url.length > 0);
      
      for (const url of urls) {
        iceServers.push({
          urls: url,
          username: turnUsername,
          credential: turnCredential
        });
      }
      
      hasTURN = urls.length > 0;
      console.log(`✓ Configured ${urls.length} TURN server(s):`, urls);
      console.log('  TURN Username:', turnUsername);
      console.log('  Credential length:', turnCredential.length);
    } else {
      console.warn('⚠️ TURN servers not configured - NAT traversal may fail');
      console.warn('  Missing:', { 
        turnUrls: !turnUrls, 
        turnUsername: !turnUsername, 
        turnCredential: !turnCredential 
      });
    }

    // Always add STUN servers as fallback
    iceServers.push(
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' }
    );

    const response: ICEServersResponse = {
      iceServers,
      hasTURN,
      ...((!hasTURN) && { 
        warning: 'TURN servers not configured. Connections may fail behind strict NATs/firewalls.' 
      })
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        } 
      }
    );

  } catch (error) {
    console.error('Error generating ICE servers:', error);
    
    // Return fallback STUN-only configuration
    return new Response(
      JSON.stringify({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        hasTURN: false,
        warning: 'Error loading TURN configuration - using STUN only'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200 // Still return 200 with fallback config
      }
    );
  }
});
