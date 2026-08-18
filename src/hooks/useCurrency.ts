import { useState, useEffect, useCallback } from 'react';
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

const EMPTY_BALANCE: CurrencyBalance = {
  coin_balance: 0,
  gold_balance: 0,
  lifetime_coins_purchased: 0,
  lifetime_coins_spent: 0,
  lifetime_gifts_sent: 0,
  lifetime_gifts_received: 0,
  vip_tier: 'free',
};

const normalize = (row: any): CurrencyBalance => ({
  ...EMPTY_BALANCE,
  ...row,
  coin_balance: Number(row?.coin_balance ?? 0),
  gold_balance: Number(row?.gold_balance ?? 0),
  vip_tier: (row?.vip_tier ?? 'free') as CurrencyBalance['vip_tier'],
});

export const useCurrency = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<CurrencyBalance | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!user) {
      setBalance(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('currency_balances')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBalance(normalize(data));
      } else {
        // Create the row server-side (bypasses insert restrictions safely)
        const { data: created, error: rpcError } = await supabase.rpc(
          'get_or_create_currency_balance',
          { p_user_id: user.id },
        );
        if (rpcError) throw rpcError;
        const row = Array.isArray(created) ? created[0] : created;
        setBalance(row ? normalize(row) : EMPTY_BALANCE);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      setBalance(EMPTY_BALANCE);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchBalance();

    if (!user) return;

    const channel = supabase
      .channel(`currency_balance_changes_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'currency_balances',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) setBalance(normalize(payload.new));
        }
      )
      .subscribe();

    // Also re-check when the tab regains focus (e.g. after claiming on join.oloo)
    const onFocus = () => fetchBalance();
    window.addEventListener('focus', onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, fetchBalance]);

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
