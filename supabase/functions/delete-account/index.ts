import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteAccountRequest {
  target_user_id?: string; // Optional: for admin deletion of another user
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = 'https://kdvnxzniqyomdeicmycs.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkdm54em5pcXlvbWRlaWNteWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjA4NjAsImV4cCI6MjA3MDY5Njg2MH0.OpjCOM_0uI5MujiR191FXaGx_INpWPGPXY6Z6oJEb5E';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseServiceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Client for user authentication check
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Admin client for deletions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body: DeleteAccountRequest = {};
    try {
      body = await req.json();
    } catch {
      // No body provided, self-deletion
    }

    const targetUserId = body.target_user_id || user.id;
    const isSelfDeletion = targetUserId === user.id;

    // If deleting another user, check if requester is admin
    if (!isSelfDeletion) {
      const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can delete other users' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Deleting user ${targetUserId} (requested by ${user.id}, self=${isSelfDeletion})`);

    // Delete user data from all related tables in correct order
    // Using the service role client to bypass RLS

    const tablesToClean = [
      // Messages and communications
      { table: 'messages', column: 'sender_id' },
      { table: 'messages', column: 'receiver_id' },
      { table: 'stream_chat_messages', column: 'user_id' },
      
      // Connections and interactions
      { table: 'user_connections', column: 'user_id' },
      { table: 'user_connections', column: 'connected_user_id' },
      { table: 'social_interactions', column: 'from_user_id' },
      { table: 'social_interactions', column: 'to_user_id' },
      { table: 'profile_views', column: 'viewer_id' },
      { table: 'profile_views', column: 'viewed_profile_id' },
      
      // Meet Me
      { table: 'meet_me_interactions', column: 'user_id' },
      { table: 'meet_me_interactions', column: 'target_user_id' },
      { table: 'meet_me_stats', column: 'user_id' },
      
      // Gifts
      { table: 'gift_transactions', column: 'sender_id' },
      { table: 'gift_transactions', column: 'receiver_id' },
      
      // Streaming
      { table: 'stream_likes', column: 'user_id' },
      { table: 'stream_viewer_sessions', column: 'viewer_id' },
      { table: 'streaming_sessions', column: 'host_user_id' },
      { table: 'streaming_analytics', column: 'host_user_id' },
      { table: 'webrtc_signals', column: 'session_token' }, // Clear by stream owner
      { table: 'viewer_webrtc_signals', column: 'viewer_session_token' },
      
      // Currency and shop
      { table: 'currency_transactions', column: 'user_id' },
      { table: 'currency_balances', column: 'user_id' },
      { table: 'token_transactions', column: 'user_id' },
      { table: 'user_purchases', column: 'user_id' },
      { table: 'shop_wishlists', column: 'user_id' },
      
      // Achievements and levels
      { table: 'user_achievements', column: 'user_id' },
      { table: 'user_levels', column: 'user_id' },
      { table: 'xp_transactions', column: 'user_id' },
      { table: 'daily_login_rewards', column: 'user_id' },
      
      // Trivia
      { table: 'trivia_answers', column: 'user_id' },
      { table: 'trivia_stats', column: 'user_id' },
      
      // Feed
      { table: 'post_reactions', column: 'user_id' },
      { table: 'feed_posts', column: 'user_id' },
      
      // Video calls
      { table: 'video_calls', column: 'caller_id' },
      { table: 'video_calls', column: 'receiver_id' },
      
      // Verification and security
      { table: 'face_verifications', column: 'user_id' },
      { table: 'video_verification_requests', column: 'requester_id' },
      { table: 'video_verification_requests', column: 'target_user_id' },
      { table: 'verification_attempts', column: 'user_id' },
      { table: 'otp_attempts', column: 'user_id' },
      
      // Rate limiting and audit
      { table: 'rate_limit_actions', column: 'user_id' },
      { table: 'security_audit_log', column: 'user_id' },
      { table: 'payment_audit_log', column: 'user_id' },
      { table: 'payment_intents', column: 'user_id' },
      
      // Sensitive info
      { table: 'user_sensitive_info', column: 'user_id' },
      
      // AR sessions
      { table: 'ar_sessions', column: 'user_id' },
      
      // Memberships
      { table: 'memberships', column: 'user_id' },
      
      // User roles (before profile)
      { table: 'user_roles', column: 'user_id' },
      
      // Profile (last, as other tables may reference it)
      { table: 'profiles', column: 'user_id' },
    ];

    const errors: string[] = [];

    for (const { table, column } of tablesToClean) {
      try {
        const { error } = await supabaseAdmin
          .from(table)
          .delete()
          .eq(column, targetUserId);

        if (error) {
          console.error(`Error deleting from ${table}.${column}:`, error.message);
          // Don't fail completely, continue with other tables
          errors.push(`${table}.${column}: ${error.message}`);
        } else {
          console.log(`Cleaned ${table}.${column}`);
        }
      } catch (e) {
        console.error(`Exception deleting from ${table}.${column}:`, e);
        errors.push(`${table}.${column}: ${e.message}`);
      }
    }

    // Finally, delete the user from auth.users
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete authentication record',
          details: deleteAuthError.message,
          partialErrors: errors
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully deleted user ${targetUserId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `User ${targetUserId} has been deleted`,
        warnings: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
