import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentData {
  customer_id?: string;
  amount_cents: number;
  currency?: string;
  tier: string;
  status?: string;
}

interface PaymentOperationResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const useSecurePayments = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const executePaymentOperation = async (
    operation: 'create' | 'update_status' | 'retrieve' | 'webhook_update',
    paymentIntentId?: string,
    paymentData?: PaymentData
  ): Promise<PaymentOperationResult> => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('secure-payment', {
        body: {
          operation,
          paymentIntentId,
          paymentData
        }
      });

      if (error) {
        throw new Error(error.message || 'Payment operation failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Payment operation failed');
      }

      // Show success toast for user-initiated operations
      if (operation === 'create') {
        toast({
          title: "Payment Created",
          description: "Payment intent created successfully",
        });
      }

      return { success: true, data: data.data };

    } catch (error: any) {
      console.error('Payment operation failed:', error);
      
      // Show user-friendly error message
      toast({
        title: "Payment Error",
        description: error.message || "Payment operation failed. Please try again.",
        variant: "destructive",
      });

      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const createPaymentIntent = async (paymentData: PaymentData) => {
    return executePaymentOperation('create', undefined, paymentData);
  };

  const updatePaymentStatus = async (paymentIntentId: string, status: string) => {
    return executePaymentOperation('update_status', paymentIntentId, { 
      status,
      amount_cents: 0, // Required field but not used for status updates
      tier: 'unknown' // Required field but not used for status updates
    });
  };

  const retrievePaymentIntent = async (paymentIntentId: string) => {
    return executePaymentOperation('retrieve', paymentIntentId);
  };

  const getUserPayments = async () => {
    try {
      setIsLoading(true);
      
      // Use direct query for user's own payments (allowed by RLS policy)
      const { data, error } = await supabase
        .from('payment_intents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return { success: true, data };
    } catch (error: any) {
      toast({
        title: "Error Loading Payments",
        description: "Failed to load payment history",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    createPaymentIntent,
    updatePaymentStatus,
    retrievePaymentIntent,
    getUserPayments,
    executePaymentOperation
  };
};