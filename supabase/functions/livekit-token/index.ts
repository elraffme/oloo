import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2.13.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenRequest {
  roomName: string;
  participantName: string;
  participantIdentity: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== LiveKit Token Request Started ===');
    
    // Get Supabase client to verify authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify the user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('❌ Authentication failed:', userError);
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          details: 'User authentication failed'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✓ User authenticated:', user.id);

    // Parse request body
    const body = await req.json();
    const { roomName, participantName, participantIdentity, canPublish = false, canSubscribe = true }: TokenRequest = body;

    // Validate required fields
    if (!roomName || !participantName || !participantIdentity) {
      console.error('❌ Missing required fields:', { roomName, participantName, participantIdentity });
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          details: 'roomName, participantName, and participantIdentity are required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✓ Token request:', { roomName, participantName, participantIdentity, canPublish, canSubscribe });

    // Get LiveKit credentials from environment
    const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY');
    const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const livekitUrl = Deno.env.get('LIVEKIT_URL');

    if (!livekitApiKey || !livekitApiSecret || !livekitUrl) {
      console.error('❌ Missing LiveKit credentials:', {
        hasApiKey: !!livekitApiKey,
        hasApiSecret: !!livekitApiSecret,
        hasUrl: !!livekitUrl
      });
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          details: 'LiveKit credentials not configured. Please add LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL to your edge function secrets.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✓ LiveKit credentials found');

    // Create access token
    console.log('Creating LiveKit access token...');
    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: participantIdentity,
      name: participantName,
    });

    // Grant permissions
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: canPublish,
      canPublishData: true,
      canSubscribe: canSubscribe,
    });

    const token = await at.toJwt();

    console.log('✅ Token generated successfully');
    console.log('=== LiveKit Token Request Complete ===');

    return new Response(
      JSON.stringify({ 
        token,
        url: livekitUrl,
        roomName,
        participantIdentity,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('❌ Error in livekit-token function:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        type: error.name
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
