import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface TokenTransaction {
  id: string;
  user_id: string;
  delta: number;
  balance: number;
  reason: string;
  metadata: any;
  created_at: string;
}

export interface SecureTokenOperation {
  user_id: string;
  token_amount: number;
  operation_reason: string;
  operation_type: 'reward' | 'purchase' | 'gift_send' | 'gift_receive' | 'subscription_bonus' | 'admin_adjustment';
}

export const useSecureTokens = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);

  // Get user's current token balance
  const getTokenBalance = useCallback(async () => {
    if (!user?.id) {
      console.error('No authenticated user found');
      return 0;
    }

    try {
      const { data, error } = await supabase.rpc('get_user_token_balance', {
        target_user_id: user.id
      });

      if (error) {
        console.error('Error fetching token balance:', error);
        toast.error('Failed to fetch token balance');
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('Error in getTokenBalance:', error);
      toast.error('Failed to fetch token balance');
      return 0;
    }
  }, [user?.id]);

  // Get user's transaction history
  const getTransactionHistory = useCallback(async () => {
    if (!user?.id) {
      console.error('No authenticated user found');
      return [];
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching transaction history:', error);
        toast.error('Failed to fetch transaction history');
        return [];
      }

      setTransactions(data || []);
      return data || [];
    } catch (error) {
      console.error('Error in getTransactionHistory:', error);
      toast.error('Failed to fetch transaction history');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Award tokens for legitimate user actions (limited scope)
  const awardUserTokens = useCallback(async (
    amount: number, 
    reason: 'gift_received' | 'daily_bonus' | 'profile_completion'
  ) => {
    if (!user?.id) {
      console.error('No authenticated user found');
      toast.error('Authentication required');
      return false;
    }

    // Client-side validation for safety
    if (amount <= 0 || amount > 100) {
      toast.error('Invalid token amount (1-100 allowed)');
      return false;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('token_transactions')
        .insert({
          user_id: user.id,
          delta: amount,
          balance: 0, // Will be calculated by trigger
          reason: reason,
          metadata: {
            client_operation: true,
            timestamp: new Date().toISOString()
          }
        });

      if (error) {
        console.error('Error awarding tokens:', error);
        toast.error('Failed to award tokens: ' + error.message);
        return false;
      }

      toast.success(`Awarded ${amount} tokens for ${reason.replace('_', ' ')}`);
      
      // Refresh transaction history
      await getTransactionHistory();
      return true;
    } catch (error) {
      console.error('Error in awardUserTokens:', error);
      toast.error('Failed to award tokens');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id, getTransactionHistory]);

  // Check if user can perform a token operation (client-side validation)
  const canPerformTokenOperation = useCallback(async (tokenAmount: number): Promise<boolean> => {
    try {
      const currentBalance = await getTokenBalance();
      
      // Check if user has sufficient balance for deduction
      if (tokenAmount < 0 && (currentBalance + tokenAmount) < 0) {
        toast.error(`Insufficient token balance. Current: ${currentBalance}, Required: ${Math.abs(tokenAmount)}`);
        return false;
      }

      // Check daily transaction limits (get recent transactions)
      const { data, error } = await supabase
        .from('token_transactions')
        .select('id')
        .eq('user_id', user?.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('Error checking transaction limits:', error);
        return false;
      }

      if (data && data.length >= 50) {
        toast.error('Daily transaction limit reached (50 transactions per day)');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in canPerformTokenOperation:', error);
      return false;
    }
  }, [user?.id, getTokenBalance]);

  return {
    loading,
    transactions,
    getTokenBalance,
    getTransactionHistory,
    awardUserTokens,
    canPerformTokenOperation
  };
};