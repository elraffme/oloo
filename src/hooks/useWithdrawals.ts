import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface Withdrawal {
  id: string;
  user_id: string;
  token_amount: number;
  cash_amount_cents: number;
  conversion_rate: number;
  status: 'pending' | 'completed' | 'rejected';
  payment_method?: string;
  payment_details?: Record<string, unknown>;
  admin_notes?: string;
  processed_at?: string;
  created_at: string;
}

const CONVERSION_RATE = 0.01; // $0.01 per token
const MIN_WITHDRAWAL_TOKENS = 100; // Minimum 100 tokens = $1.00

export const useWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchWithdrawals = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals((data as Withdrawal[]) || []);
    } catch (error: unknown) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestWithdrawal = async (tokenAmount: number): Promise<boolean> => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to request a withdrawal",
        variant: "destructive",
      });
      return false;
    }

    if (tokenAmount < MIN_WITHDRAWAL_TOKENS) {
      toast({
        title: "Minimum Not Met",
        description: `Minimum withdrawal is ${MIN_WITHDRAWAL_TOKENS} tokens ($${(MIN_WITHDRAWAL_TOKENS * CONVERSION_RATE).toFixed(2)})`,
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('process_withdrawal_request', {
        p_token_amount: tokenAmount,
        p_conversion_rate: CONVERSION_RATE
      });

      if (error) throw error;

      const cashAmount = (tokenAmount * CONVERSION_RATE).toFixed(2);
      toast({
        title: "Withdrawal Requested",
        description: `Your withdrawal of ${tokenAmount} tokens ($${cashAmount}) is being processed`,
      });

      await fetchWithdrawals();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to process withdrawal';
      toast({
        title: "Withdrawal Failed",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCashAmount = (tokens: number): number => {
    return tokens * CONVERSION_RATE;
  };

  useEffect(() => {
    if (user) {
      fetchWithdrawals();
    }
  }, [user]);

  return {
    withdrawals,
    isLoading,
    requestWithdrawal,
    fetchWithdrawals,
    calculateCashAmount,
    conversionRate: CONVERSION_RATE,
    minWithdrawalTokens: MIN_WITHDRAWAL_TOKENS,
  };
};
