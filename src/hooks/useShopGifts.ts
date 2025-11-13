// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ShopGift {
  id: string;
  sender_id: string;
  receiver_id: string;
  item_id: string;
  message: string | null;
  coin_cost: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  accepted_at: string | null;
  shop_items: any;
  sender_profile?: any;
}

export const useShopGifts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch pending gifts (inbox)
  const { data: pendingGifts, isLoading: pendingLoading } = useQuery({
    queryKey: ['shop-gifts-pending', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('shop_item_gifts')
        .select(`
          *,
          shop_items(*),
          sender_profile:profiles!shop_item_gifts_sender_id_fkey(display_name, avatar_url)
        `)
        .eq('receiver_id', user!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ShopGift[];
    },
    enabled: !!user,
  });

  // Fetch sent gifts
  const { data: sentGifts, isLoading: sentLoading } = useQuery({
    queryKey: ['shop-gifts-sent', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('shop_item_gifts')
        .select(`
          *,
          shop_items(*),
          receiver_profile:profiles!shop_item_gifts_receiver_id_fkey(display_name, avatar_url)
        `)
        .eq('sender_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as ShopGift[];
    },
    enabled: !!user,
  });

  // Send gift mutation
  const sendGiftMutation = useMutation({
    mutationFn: async ({ receiverId, itemId, message }: { receiverId: string; itemId: string; message?: string }) => {
      const { data, error } = await supabase.rpc('send_shop_item_gift' as any, {
        p_receiver_id: receiverId,
        p_item_id: itemId,
        p_message: message || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Gift sent! ${data.item_name} for ${data.coins_spent} coins 🎁`);
      queryClient.invalidateQueries({ queryKey: ['shop-gifts-sent'] });
      queryClient.invalidateQueries({ queryKey: ['currency-balance'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send gift');
    },
  });

  // Accept gift mutation
  const acceptGiftMutation = useMutation({
    mutationFn: async (giftId: string) => {
      const { data, error } = await supabase.rpc('accept_shop_item_gift' as any, {
        p_gift_id: giftId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Gift accepted! Check your inventory 🎉');
      queryClient.invalidateQueries({ queryKey: ['shop-gifts-pending'] });
      queryClient.invalidateQueries({ queryKey: ['user-purchases'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to accept gift');
    },
  });

  // Decline gift mutation
  const declineGiftMutation = useMutation({
    mutationFn: async (giftId: string) => {
      const { data, error } = await supabase.rpc('decline_shop_item_gift' as any, {
        p_gift_id: giftId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Gift declined. Sender has been refunded.');
      queryClient.invalidateQueries({ queryKey: ['shop-gifts-pending'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to decline gift');
    },
  });

  return {
    pendingGifts,
    sentGifts,
    loading: pendingLoading || sentLoading,
    sendGift: sendGiftMutation.mutate,
    acceptGift: acceptGiftMutation.mutate,
    declineGift: declineGiftMutation.mutate,
    sending: sendGiftMutation.isPending,
    accepting: acceptGiftMutation.isPending,
    declining: declineGiftMutation.isPending,
    pendingCount: pendingGifts?.length || 0,
  };
};
