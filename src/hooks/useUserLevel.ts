import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserLevel {
  current_level: number;
  current_xp: number;
  total_xp_earned: number;
  xp_for_next_level: number;
  progress_percentage: number;
}

export function useUserLevel() {
  const { user } = useAuth();
  const [level, setLevel] = useState<UserLevel | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLevel = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Calculate XP for next level
        const xpForNext = data.current_level * data.current_level * 100;
        const progressPercentage = (data.current_xp / xpForNext) * 100;

        setLevel({
          current_level: data.current_level,
          current_xp: data.current_xp,
          total_xp_earned: data.total_xp_earned,
          xp_for_next_level: xpForNext,
          progress_percentage: progressPercentage,
        });
      } else {
        // Initialize level for new user
        setLevel({
          current_level: 1,
          current_xp: 0,
          total_xp_earned: 0,
          xp_for_next_level: 100,
          progress_percentage: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching user level:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLevel();

      // Subscribe to level changes
      const channel = supabase
        .channel('user_level_updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_levels',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              const newData = payload.new as any;
              const xpForNext = newData.current_level * newData.current_level * 100;
              const progressPercentage = (newData.current_xp / xpForNext) * 100;

              const oldLevel = level?.current_level;
              const newLevel = newData.current_level;

              setLevel({
                current_level: newLevel,
                current_xp: newData.current_xp,
                total_xp_earned: newData.total_xp_earned,
                xp_for_next_level: xpForNext,
                progress_percentage: progressPercentage,
              });

              // Show level up toast
              if (oldLevel && newLevel > oldLevel) {
                toast.success(`🎉 Level Up! You're now Level ${newLevel}!`, {
                  description: `You earned ${newLevel * 50} bonus coins!`,
                  duration: 5000,
                });
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id]);

  return { level, loading, refreshLevel: fetchLevel };
}
