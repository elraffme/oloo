// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: 'badge' | 'theme' | 'emoji' | 'customization';
  item_type: string;
  icon: string;
  coin_price: number;
  asset_data: any;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  limited_edition: boolean;
  available_until: string | null;
  display_order: number;
}

export interface UserPurchase {
  id: string;
  item_id: string;
  coin_price_paid: number;
  purchased_at: string;
  is_equipped: boolean;
  shop_items: ShopItem;
}

export const useShop = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch shop items
  const { data: shopItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['shop-items'],
    queryFn: async () => {
      // @ts-expect-error - Types will be updated after migration
      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .eq('active', true)
        .order('display_order');

      if (error) throw error;
      return (data as unknown) as ShopItem[];
    },
    enabled: !!user,
  });

  // Fetch user purchases
  const { data: userPurchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['user-purchases', user?.id],
    queryFn: async () => {
      // @ts-expect-error - Types will be updated after migration
      const { data, error } = await supabase
        .from('user_purchases')
        .select('*, shop_items(*)')
        .eq('user_id', user!.id);

      if (error) throw error;
      return (data as unknown) as UserPurchase[];
    },
    enabled: !!user,
  });

  // Purchase item mutation
  const purchaseItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc('purchase_shop_item' as any, {
        p_item_id: itemId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Purchased ${data.item_name} for ${data.coins_spent} coins! 🎉`);
      queryClient.invalidateQueries({ queryKey: ['user-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['currency-balance'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to purchase item');
    },
  });

  // Toggle equipped mutation
  const toggleEquippedMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc('toggle_item_equipped' as any, {
        p_item_id: itemId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (isEquipped: boolean) => {
      toast.success(isEquipped ? 'Item equipped!' : 'Item unequipped');
      queryClient.invalidateQueries({ queryKey: ['user-purchases'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update item');
    },
  });

  const isPurchased = (itemId: string) => {
    return userPurchases?.some((p) => p.item_id === itemId) || false;
  };

  const getEquippedItem = (category: string) => {
    return userPurchases?.find(
      (p) => p.shop_items.category === category && p.is_equipped
    );
  };

  return {
    shopItems,
    userPurchases,
    loading: itemsLoading || purchasesLoading,
    purchaseItem: purchaseItemMutation.mutate,
    toggleEquipped: toggleEquippedMutation.mutate,
    isPurchased,
    getEquippedItem,
    purchasing: purchaseItemMutation.isPending,
  };
};
