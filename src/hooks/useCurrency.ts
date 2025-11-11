import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CurrencyBalance {
  coin_balance: number;
  gold_balance: number;
  lifetime_coins_purchased: number;
  lifetime_coins_spent: number;
  lifetime_gifts_sent: number;
  lifetime_gifts_received: number;
  vip_tier: 'free' | 'bronze' | 'silver' | 'gold' | 'platinum';
}

export const useCurrency = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<CurrencyBalance | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('currency_balances')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        // Create initial balance
        const { data: newBalance, error: createError } = await supabase
          .from('currency_balances')
          .insert({ user_id: user.id })
          .select()
          .single();

        if (createError) throw createError;
        setBalance(newBalance as CurrencyBalance);
      } else {
        setBalance(data as CurrencyBalance);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      toast.error('Failed to load currency balance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();

    // Subscribe to balance changes
    const channel = supabase
      .channel('currency_balance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'currency_balances',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          if (payload.new) {
            setBalance(payload.new as CurrencyBalance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const convertGoldToCoins = async (goldAmount: number) => {
    try {
      const { data, error } = await supabase.rpc('convert_gold_to_coins', {
        p_gold_amount: goldAmount,
      });

      if (error) throw error;

      const result = data as any;
      toast.success(`Converted ${goldAmount} gold to ${result.coins_received} coins!`);
      await fetchBalance();
      return data;
    } catch (error: any) {
      toast.error(error.message || 'Failed to convert gold');
      throw error;
    }
  };

  return {
    balance,
    loading,
    refreshBalance: fetchBalance,
    convertGoldToCoins,
  };
};
