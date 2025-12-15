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
  provider?: string;
  warning?: string;
  ttl?: number;
}

interface TwilioToken {
  username: string;
  password: string;
  ttl: string;
  ice_servers: Array<{
    url: string;
    urls: string;
    username?: string;
    credential?: string;
  }>;
}

// Cache for Twilio tokens (edge functions are stateless, but within a single invocation this helps)
let cachedTwilioResponse: { data: TwilioToken; timestamp: number } | null = null;
const TWILIO_CACHE_TTL = 300000; // 5 minutes in ms

async function getTwilioTurnCredentials(): Promise<ICEServer[] | null> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!accountSid || !authToken) {
    console.log('Twilio credentials not configured');
    return null;
  }

  try {
    // Check cache
    if (cachedTwilioResponse && (Date.now() - cachedTwilioResponse.timestamp) < TWILIO_CACHE_TTL) {
      console.log('Using cached Twilio TURN credentials');
      return formatTwilioServers(cachedTwilioResponse.data);
    }

    console.log('Fetching fresh Twilio TURN credentials...');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'Ttl=86400', // 24 hour TTL for tokens
      }
    );

    if (!response.ok) {
      console.error('Twilio API error:', response.status, await response.text());
      return null;
    }

    const data: TwilioToken = await response.json();
    cachedTwilioResponse = { data, timestamp: Date.now() };
    
    console.log('✓ Twilio TURN credentials obtained, expires in:', data.ttl);
    return formatTwilioServers(data);
  } catch (error) {
    console.error('Error fetching Twilio credentials:', error);
    return null;
  }
}

function formatTwilioServers(data: TwilioToken): ICEServer[] {
  return data.ice_servers.map(server => ({
    urls: server.urls || server.url,
    username: server.username,
    credential: server.credential,
  }));
}

async function getMeteredTurnCredentials(): Promise<ICEServer[] | null> {
  const apiKey = Deno.env.get('METERED_API_KEY');
  const appName = Deno.env.get('METERED_APP_NAME') || 'default';

  if (!apiKey) {
    console.log('Metered.ca credentials not configured');
    return null;
  }

  try {
    console.log('Fetching Metered.ca TURN credentials...');
    const response = await fetch(
      `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
    );

    if (!response.ok) {
      console.error('Metered API error:', response.status);
      return null;
    }

    const servers = await response.json();
    console.log('✓ Metered.ca TURN credentials obtained');
    
    return servers.map((server: any) => ({
      urls: server.urls,
      username: server.username,
      credential: server.credential,
    }));
  } catch (error) {
    console.error('Error fetching Metered credentials:', error);
    return null;
  }
}

function getStaticTurnServers(): ICEServer[] | null {
  const turnUrls = Deno.env.get('TURN_URLS');
  const turnUsername = Deno.env.get('TURN_USERNAME');
  const turnCredential = Deno.env.get('TURN_CREDENTIAL');

  if (!turnUrls || !turnUsername || !turnCredential) {
    return null;
  }

  const urls = turnUrls.split(',').map(url => url.trim()).filter(url => url.length > 0);
  
  return urls.map(url => ({
    urls: url,
    username: turnUsername,
    credential: turnCredential,
  }));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const iceServers: ICEServer[] = [];
    let hasTURN = false;
    let provider = 'none';
    let ttl = 86400; // Default 24 hours

    // Priority 1: Twilio (best for production - global infrastructure)
    const twilioServers = await getTwilioTurnCredentials();
    if (twilioServers && twilioServers.length > 0) {
      iceServers.push(...twilioServers);
      hasTURN = true;
      provider = 'twilio';
      console.log(`✓ Using Twilio TURN (${twilioServers.length} servers)`);
    }

    // Priority 2: Metered.ca (good alternative)
    if (!hasTURN) {
      const meteredServers = await getMeteredTurnCredentials();
      if (meteredServers && meteredServers.length > 0) {
        iceServers.push(...meteredServers);
        hasTURN = true;
        provider = 'metered';
        console.log(`✓ Using Metered.ca TURN (${meteredServers.length} servers)`);
      }
    }

    // Priority 3: Static TURN configuration (self-hosted coturn)
    if (!hasTURN) {
      const staticServers = getStaticTurnServers();
      if (staticServers && staticServers.length > 0) {
        iceServers.push(...staticServers);
        hasTURN = true;
        provider = 'static';
        console.log(`✓ Using static TURN (${staticServers.length} servers)`);
      }
    }

    // Always add STUN servers as fallback (free, but no relay capability)
    iceServers.push(
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    );

    const response: ICEServersResponse = {
      iceServers,
      hasTURN,
      provider,
      ttl,
      ...((!hasTURN) && { 
        warning: 'TURN servers not configured. WebRTC connections may fail behind strict NATs/firewalls. Configure TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN for production.' 
      })
    };

    console.log(`ICE servers response: hasTURN=${hasTURN}, provider=${provider}, total=${iceServers.length}`);

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
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
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
        hasTURN: false,
        provider: 'fallback',
        warning: 'Error loading TURN configuration - using STUN only'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200
      }
    );
  }
});
