import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface LoginStreakInfo {
  current_streak: number;
  claimed_today: boolean;
  day_in_month: number;
  last_login_date: string | null;
  coins_today?: number;
  xp_today?: number;
  is_milestone_today?: boolean;
  milestone_type_today?: string;
  next_milestone_days?: number;
}

export interface ClaimResult {
  success: boolean;
  coins_awarded?: number;
  xp_awarded?: number;
  current_streak?: number;
  day_in_month?: number;
  is_milestone?: boolean;
  milestone_type?: string;
  next_milestone?: number;
  already_claimed?: boolean;
  message?: string;
}

export const useDailyLoginRewards = () => {
  const { user } = useAuth();
  const [streakInfo, setStreakInfo] = useState<LoginStreakInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const fetchStreakInfo = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const tzOffset = new Date().getTimezoneOffset();
      const { data, error } = await supabase.rpc('get_login_streak_info', {
        p_tz_offset_minutes: tzOffset
      });

      if (error) throw error;

      console.debug('[DailyRewards] Streak info:', data);
      setStreakInfo(data as unknown as LoginStreakInfo);
    } catch (error) {
      console.error('Error fetching streak info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreakInfo();
  }, [user]);

  const claimDailyReward = async (): Promise<ClaimResult> => {
    if (!user || claiming) {
      return { success: false, message: 'Unable to claim reward' };
    }

    setClaiming(true);

    try {
      const tzOffset = new Date().getTimezoneOffset();
      console.debug('[DailyRewards] Claiming with timezone offset:', tzOffset);
      
      const { data, error } = await supabase.rpc('claim_daily_login_reward', {
        p_tz_offset_minutes: tzOffset
      });

      if (error) throw error;

      const result = data as unknown as ClaimResult;
      console.debug('[DailyRewards] Claim result:', result);

      if (result.success) {
        if (result.is_milestone) {
          toast.success(`🎉 ${result.milestone_type?.toUpperCase()} MILESTONE!`, {
            description: `You earned ${result.coins_awarded} coins and ${result.xp_awarded} XP! Streak: ${result.current_streak} days`,
            duration: 5000,
          });
        } else {
          toast.success(`Daily Reward Claimed!`, {
            description: `+${result.coins_awarded} coins, +${result.xp_awarded} XP (${result.current_streak} day streak)`,
            duration: 4000,
          });
        }
        
        await fetchStreakInfo();
      } else if (result.already_claimed) {
        toast.info('Already claimed today! Come back tomorrow.');
      }

      return result;
    } catch (error: any) {
      console.error('Error claiming reward:', error);
      toast.error('Failed to claim reward');
      return { success: false, message: error.message };
    } finally {
      setClaiming(false);
    }
  };

  return {
    streakInfo,
    loading,
    claiming,
    claimDailyReward,
    refreshStreakInfo: fetchStreakInfo,
  };
};
