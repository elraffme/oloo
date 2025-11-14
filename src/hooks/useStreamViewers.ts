import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamViewer {
  session_id: string;
  viewer_id: string | null;
  viewer_display_name: string;
  is_guest: boolean;
  joined_at: string;
  avatar_url: string;
}

export const useStreamViewers = (streamId: string) => {
  const [viewers, setViewers] = useState<StreamViewer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!streamId) return;

    const loadViewers = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_active_stream_viewers', { p_stream_id: streamId });

        if (error) {
          console.error('Error loading viewers:', error);
          return;
        }

        setViewers(data || []);
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
