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

    // Subscribe to viewer changes with proper event handling
    const channel = supabase
      .channel(`stream_viewers_${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_viewer_sessions',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          // Add new viewer
          const newViewer = {
            session_id: payload.new.id,
            viewer_id: payload.new.viewer_id,
            viewer_display_name: payload.new.viewer_display_name,
            is_guest: payload.new.is_guest,
            joined_at: payload.new.joined_at,
            avatar_url: '',
            camera_enabled: payload.new.camera_enabled,
            camera_stream_active: payload.new.camera_stream_active,
          };
          setViewers(prev => {
            // Prevent duplicates by checking if session already exists
            if (prev.some(v => v.session_id === newViewer.session_id)) {
              return prev;
            }
            return [...prev, newViewer];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stream_viewer_sessions',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          // Update existing viewer
          setViewers(prev => prev.map(v => 
            v.session_id === payload.new.id
              ? {
                  ...v,
                  camera_enabled: payload.new.camera_enabled,
                  camera_stream_active: payload.new.camera_stream_active,
                  viewer_display_name: payload.new.viewer_display_name,
                }
              : v
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'stream_viewer_sessions',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          // Remove viewer
          setViewers(prev => prev.filter(v => v.session_id !== payload.old.id));
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
