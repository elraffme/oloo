import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Throttle function to prevent excessive updates
const throttle = (func: Function, delay: number) => {
  let lastCall = 0;
  return (...args: any[]) => {
    const now = new Date().getTime();
    if (now - lastCall < delay) return;
    lastCall = now;
    return func(...args);
  };
};

interface PresenceState {
  [key: string]: {
    user_id: string;
    display_name: string;
    online_at: string;
    avatar_url?: string;
  }[];
}

export const usePresence = () => {
  const { user } = useAuth();
  const [presenceState, setPresenceState] = useState<PresenceState>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user) {
      // Clean up if user logs out
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setPresenceState({});
      setOnlineUsers(new Set());
      return;
    }

    // Create presence channel
    const channel = supabase.channel('online_users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    // Listen to presence changes
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as PresenceState;
        setPresenceState(state);
        
        // Extract online user IDs
        const online = new Set<string>();
        Object.values(state).forEach(presences => {
          presences.forEach(presence => {
            online.add(presence.user_id);
          });
        });
        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Get user profile data
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url, profile_photos')
            .eq('user_id', user.id)
            .single();

          // Track user presence
          const presenceTrackStatus = await channel.track({
            user_id: user.id,
            display_name: profile?.display_name || 'Unknown User',
            online_at: new Date().toISOString(),
            avatar_url: profile?.profile_photos?.[0] || profile?.avatar_url || '/placeholder.svg',
          });
          
          console.log('Presence track status:', presenceTrackStatus);
        }
      });

    // Cleanup function
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

  // Update presence activity (heartbeat)
  const updateActivity = async () => {
    if (channelRef.current && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, profile_photos')
        .eq('user_id', user.id)
        .single();

      await channelRef.current.track({
        user_id: user.id,
        display_name: profile?.display_name || 'Unknown User',
        online_at: new Date().toISOString(),
        avatar_url: profile?.profile_photos?.[0] || profile?.avatar_url || '/placeholder.svg',
      });
    }
  };

  // Set up activity heartbeat with throttling
  useEffect(() => {
    if (!user) return;

    // Only update every 30 seconds automatically
    const interval = setInterval(updateActivity, 30000);
    
    // Throttle user activity updates to max once per 5 seconds
    const throttledUpdate = throttle(updateActivity, 5000);
    
    // Only listen to meaningful interactions (removed mousemove and scroll)
    window.addEventListener('click', throttledUpdate);
    window.addEventListener('keypress', throttledUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('click', throttledUpdate);
      window.removeEventListener('keypress', throttledUpdate);
    };
  }, [user]);

  const isUserOnline = (userId: string): boolean => {
    return onlineUsers.has(userId);
  };

  const getOnlineUsers = (): string[] => {
    return Array.from(onlineUsers);
  };

  return {
    presenceState,
    onlineUsers: Array.from(onlineUsers),
    isUserOnline,
    getOnlineUsers,
    updateActivity,
  };
};