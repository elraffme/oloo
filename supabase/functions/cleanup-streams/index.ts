import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse optional parameters from request body
    let staleMinutes = 15
    let archiveDays = 30
    let deleteArchived = false

    if (req.method === 'POST') {
      try {
        const body = await req.json()
        staleMinutes = body.staleMinutes ?? 15
        archiveDays = body.archiveDays ?? 30
        deleteArchived = body.deleteArchived ?? false
      } catch {
        // Use defaults if no body or invalid JSON
      }
    }

    const now = new Date()
    const staleThreshold = new Date(now.getTime() - staleMinutes * 60 * 1000)
    const archiveThreshold = new Date(now.getTime() - archiveDays * 24 * 60 * 60 * 1000)

    console.log(`Starting cleanup at ${now.toISOString()}`)
    console.log(`Stale threshold: ${staleThreshold.toISOString()} (${staleMinutes} minutes ago)`)

    // 1. End stale "live" streams (no activity for staleMinutes)
    const { data: staleStreams, error: staleError } = await supabase
      .from('streaming_sessions')
      .update({
        status: 'ended',
        ended_at: now.toISOString()
      })
      .eq('status', 'live')
      .lt('last_activity_at', staleThreshold.toISOString())
      .select('id, title, host_user_id, last_activity_at')

    if (staleError) {
      console.error('Error ending stale streams:', staleError)
    } else {
      console.log(`Ended ${staleStreams?.length ?? 0} stale live streams`)
      if (staleStreams?.length) {
        console.log('Stale streams ended:', staleStreams.map(s => ({ id: s.id, title: s.title })))
      }
    }

    // 2. Clean up orphaned viewer sessions for ended/non-live streams
    const { data: orphanedSessions, error: orphanError } = await supabase
      .from('stream_viewer_sessions')
      .update({ left_at: now.toISOString() })
      .is('left_at', null)
      .not('stream_id', 'in', `(SELECT id FROM streaming_sessions WHERE status = 'live')`)
      .select('id')

    if (orphanError) {
      console.error('Error cleaning orphaned sessions:', orphanError)
    } else {
      console.log(`Cleaned up ${orphanedSessions?.length ?? 0} orphaned viewer sessions`)
    }

    // 3. Optionally delete old archived streams
    let deletedArchivedCount = 0
    if (deleteArchived) {
      console.log(`Archive threshold: ${archiveThreshold.toISOString()} (${archiveDays} days ago)`)
      
      // First delete related records (viewer sessions, chat messages, likes)
      const { data: oldStreams } = await supabase
        .from('streaming_sessions')
        .select('id')
        .eq('status', 'ended')
        .lt('created_at', archiveThreshold.toISOString())

      if (oldStreams?.length) {
        const oldStreamIds = oldStreams.map(s => s.id)
        
        // Delete viewer sessions
        await supabase
          .from('stream_viewer_sessions')
          .delete()
          .in('stream_id', oldStreamIds)
        
        // Delete chat messages
        await supabase
          .from('stream_chat_messages')
          .delete()
          .in('stream_id', oldStreamIds)
        
        // Delete likes
        await supabase
          .from('stream_likes')
          .delete()
          .in('stream_id', oldStreamIds)
        
        // Delete the streams
        const { error: deleteError } = await supabase
          .from('streaming_sessions')
          .delete()
          .in('id', oldStreamIds)
        
        if (deleteError) {
          console.error('Error deleting old streams:', deleteError)
        } else {
          deletedArchivedCount = oldStreamIds.length
          console.log(`Deleted ${deletedArchivedCount} archived streams older than ${archiveDays} days`)
        }
      }
    }

    const result = {
      success: true,
      timestamp: now.toISOString(),
      staleStreamsEnded: staleStreams?.length ?? 0,
      orphanedSessionsCleaned: orphanedSessions?.length ?? 0,
      archivedStreamsDeleted: deletedArchivedCount,
      config: {
        staleMinutes,
        archiveDays,
        deleteArchived
      }
    }

    console.log('Cleanup complete:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Cleanup error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
