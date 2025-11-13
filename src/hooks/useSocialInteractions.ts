import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SocialInteraction {
  id: string;
  from_user_id: string;
  to_user_id: string;
  interaction_type: 'wave' | 'wink' | 'icebreaker';
  message: string | null;
  created_at: string;
  read_at: string | null;
  from_profile?: {
    display_name: string;
    avatar_url: string | null;
  };
}

export function useSocialInteractions() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [interactions, setInteractions] = useState<SocialInteraction[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchUnreadCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      const { count } = await supabase
        .from('social_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', user.id)
        .is('read_at', null);

      if (mounted && count !== null) {
        setUnreadCount(count);
      }
    };

    const fetchInteractions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      const { data, error } = await supabase
        .from('social_interactions')
        .select(`
          *,
          from_profile:profiles!social_interactions_from_user_id_fkey(
            display_name,
            avatar_url
          )
        `)
        .eq('to_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching interactions:', error);
        return;
      }

      if (mounted && data) {
        setInteractions(data as any);
      }
    };

    fetchUnreadCount();
    fetchInteractions();

    // Set up realtime subscription
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('social_interactions_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'social_interactions',
            filter: `to_user_id=eq.${user.id}`,
          },
          async (payload) => {
            if (!mounted) return;

            // Fetch the sender's profile info
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('user_id', payload.new.from_user_id)
              .single();

            const newInteraction = {
              ...payload.new,
              from_profile: profile,
            } as SocialInteraction;

            setInteractions(prev => [newInteraction, ...prev]);
            setUnreadCount(prev => prev + 1);

            // Show notification
            const interactionEmoji = 
              newInteraction.interaction_type === 'wave' ? '👋' :
              newInteraction.interaction_type === 'wink' ? '😉' : '❄️';
            
            const actionText = 
              newInteraction.interaction_type === 'wave' ? 'waved at you' :
              newInteraction.interaction_type === 'wink' ? 'winked at you' : 
              'sent you an icebreaker';

            toast(`${interactionEmoji} ${profile?.display_name || 'Someone'} ${actionText}!`, {
              description: newInteraction.message || undefined,
            });

            // Request browser notification permission and show notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`${profile?.display_name || 'Someone'} ${actionText}!`, {
                body: newInteraction.message || `New ${newInteraction.interaction_type} interaction`,
                icon: profile?.avatar_url || undefined,
              });
            }
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    };

    setupRealtimeSubscription();

    return () => {
      mounted = false;
    };
  }, []);

  const markAsRead = async (interactionId: string) => {
    const { error } = await supabase
      .from('social_interactions')
      .update({ read_at: new Date().toISOString() })
      .eq('id', interactionId);

    if (!error) {
      setUnreadCount(prev => Math.max(0, prev - 1));
      setInteractions(prev =>
        prev.map(int => int.id === interactionId ? { ...int, read_at: new Date().toISOString() } : int)
      );
    }
  };

  return {
    unreadCount,
    interactions,
    markAsRead,
  };
}
