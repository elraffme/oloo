import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ShopBundle {
  id: string;
  name: string;
  description: string;
  icon: string;
  discount_percent: number;
  coin_price: number;
  active: boolean;
  limited_edition: boolean;
  available_until: string | null;
  display_order: number;
  created_at: string;
}

export interface BundleItem {
  id: string;
  bundle_id: string;
  item_id: string;
  shop_items: any;
}

export const useBundles = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch bundles
  const { data: bundles, isLoading: bundlesLoading } = useQuery({
    queryKey: ['shop-bundles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_bundles')
        .select('*')
        .eq('active', true)
        .order('display_order');

      if (error) throw error;
      return data as ShopBundle[];
    },
    enabled: !!user,
  });

  // Fetch bundle items
  const { data: bundleItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['shop-bundle-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_bundle_items')
        .select('*, shop_items(*)');

      if (error) throw error;
      return data as BundleItem[];
    },
    enabled: !!user,
  });

  // Purchase bundle mutation
  const purchaseBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      const { data, error } = await supabase.rpc('purchase_shop_bundle' as any, {
        p_bundle_id: bundleId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`${data.bundle_name} purchased! Received ${data.items_received} items! 🎁`);
      queryClient.invalidateQueries({ queryKey: ['user-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['currency-balance'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to purchase bundle');
    },
  });

  const getBundleItems = (bundleId: string) => {
    return bundleItems?.filter((item) => item.bundle_id === bundleId) || [];
  };

  return {
    bundles,
    bundleItems,
    loading: bundlesLoading || itemsLoading,
    purchaseBundle: purchaseBundleMutation.mutate,
    purchasing: purchaseBundleMutation.isPending,
    getBundleItems,
  };
};
