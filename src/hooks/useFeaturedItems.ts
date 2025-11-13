import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FeaturedItem {
  id: string;
  item_id: string;
  feature_slot: number;
  title: string;
  description: string;
  background_color: string;
  starts_at: string;
  ends_at: string;
  display_order: number;
  item_data: any;
}

export const useFeaturedItems = () => {
  const { user } = useAuth();

  const { data: featuredItems, isLoading } = useQuery({
    queryKey: ['featured-items'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_active_featured_items' as any);

      if (error) throw error;
      return data as FeaturedItem[];
    },
    enabled: !!user,
    refetchInterval: 60000, // Refetch every minute to check for expired items
  });

  return {
    featuredItems: featuredItems || [],
    loading: isLoading,
  };
};
