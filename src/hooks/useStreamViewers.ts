import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamViewer {
  session_id: string;
  viewer_id: string | null;
  viewer_display_name: string;
  is_guest: boolean;
  joined_at: string;
  avatar_url: string;
  camera_enabled: boolean | null;
  camera_stream_active: boolean | null;
}

export const useStreamViewers = (streamId: string) => {
  const [viewers, setViewers] = useState<StreamViewer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!streamId) return;

    const loadViewers = async () => {
      try {
        const { data, error } = await supabase
          .from('stream_viewer_sessions')
          .select(`
            id,
            session_token,
            viewer_id,
            viewer_display_name,
            is_guest,
            joined_at,
            camera_enabled,
            camera_stream_active,
            left_at
          `)
          .eq('stream_id', streamId)
          .is('left_at', null)
          .order('joined_at', { ascending: false });

        if (error) {
          console.error('Error loading viewers:', error);
          return;
        }

        // Transform to match StreamViewer interface
        const transformedViewers = (data || []).map(viewer => ({
          session_id: viewer.id,
          viewer_id: viewer.viewer_id,
          viewer_display_name: viewer.viewer_display_name,
          is_guest: viewer.is_guest,
          joined_at: viewer.joined_at,
          avatar_url: '', // Will be fetched if needed
          camera_enabled: viewer.camera_enabled,
          camera_stream_active: viewer.camera_stream_active,
        }));

        setViewers(transformedViewers);
      } catch (error) {
        console.error('Error loading viewers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadViewers();

    // Subscribe to viewer changes
    const channel = supabase
      .channel(`stream_viewers_${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_viewer_sessions',
          filter: `stream_id=eq.${streamId}`
        },
        () => {
          // Reload viewers on any change
          loadViewers();
        }
      )
      .subscribe();

    // Refresh every 30 seconds to catch stale sessions
    const interval = setInterval(loadViewers, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [streamId]);

  return { viewers, isLoading };
};
