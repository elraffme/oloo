import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
    if (!channelRef.current || !user) {
      return;
    }

    try {
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
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  };

  // Set up activity heartbeat
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(updateActivity, 30000); // Update every 30 seconds
    
    // Update on user activity
    const handleActivity = () => updateActivity();
    
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
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