import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    // Listen for friend requests
    const friendRequestsChannel = supabase
      .channel('global-friend-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_connections',
          filter: `connected_user_id=eq.${user.id}`
        },
        async (payload) => {
          const newConnection = payload.new as any;
          
          if (newConnection.connection_type === 'friend_request') {
            // Fetch requester profile for notification
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('user_id', newConnection.user_id)
                .single();

              if (profile) {
                toast({
                  title: "New Friend Request! 👋",
                  description: `${profile.display_name} wants to be your friend`,
                  duration: 5000,
                });
              }
            } catch (error) {
              console.error('Error fetching profile for notification:', error);
            }
          }
        }
      )
      .subscribe();

    // Listen for new messages globally (for notifications)
    const messagesChannel = supabase
      .channel('global-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // Only show notification, don't update UI (components handle that)
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', newMessage.sender_id)
              .single();

            if (profile) {
              // Create notification sound (optional)
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`New message from ${profile.display_name}`, {
                  body: newMessage.content.length > 100 
                    ? newMessage.content.substring(0, 100) + '...' 
                    : newMessage.content,
                  icon: '/favicon.ico'
                });
              }
            }
          } catch (error) {
            console.error('Error fetching profile for message notification:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(friendRequestsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [user, toast]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
};