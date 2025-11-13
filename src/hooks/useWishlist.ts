import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface WishlistItem {
  id: string;
  user_id: string;
  item_id: string;
  added_at: string;
  priority: number;
  notes: string | null;
  shop_items: any;
}

export const useWishlist = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch wishlist
  const { data: wishlistItems, isLoading } = useQuery({
    queryKey: ['wishlist', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_wishlists')
        .select('*, shop_items(*)')
        .eq('user_id', user!.id)
        .order('added_at', { ascending: false });

      if (error) throw error;
      return data as WishlistItem[];
    },
    enabled: !!user,
  });

  // Toggle wishlist mutation
  const toggleWishlistMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc('toggle_wishlist_item' as any, {
        p_item_id: itemId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.action === 'added') {
        toast.success('Added to wishlist! 💝');
      } else {
        toast.success('Removed from wishlist');
      }
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update wishlist');
    },
  });

  const isInWishlist = (itemId: string) => {
    return wishlistItems?.some((item) => item.item_id === itemId) || false;
  };

  const wishlistCount = wishlistItems?.length || 0;

  return {
    wishlistItems,
    wishlistCount,
    loading: isLoading,
    toggleWishlist: toggleWishlistMutation.mutate,
    toggling: toggleWishlistMutation.isPending,
    isInWishlist,
  };
};
