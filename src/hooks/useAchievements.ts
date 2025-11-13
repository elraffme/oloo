import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Hook to automatically check and award achievements
 * Call this on key user actions to trigger achievement checks
 */
export function useAchievements() {
  const { user } = useAuth();

  const checkAchievements = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('check_and_award_achievements', {
        p_user_id: user.id,
      });

      if (error) throw error;

      // Show toast for new achievements
      const result = data as { new_achievements: any[] };
      if (result?.new_achievements?.length > 0) {
        result.new_achievements.forEach((ach: any) => {
          toast.success(`🎉 Achievement Unlocked: ${ach.name}!`, {
            description: ach.coin_reward > 0 ? `+${ach.coin_reward} coins earned!` : undefined,
            duration: 5000,
          });
        });
      }

      return data;
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  };

  return { checkAchievements };
}

/**
 * Hook to check achievements on specific events
 */
export function useAchievementTrigger(triggerEvents: string[] = []) {
  const { user } = useAuth();
  const { checkAchievements } = useAchievements();

  useEffect(() => {
    if (!user) return;

    // Check achievements when component mounts
    checkAchievements();

    // Set up realtime subscription for new user achievements
    const channel = supabase
      .channel('user_achievements_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_achievements',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Achievement was awarded
          checkAchievements();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, triggerEvents]);
}
