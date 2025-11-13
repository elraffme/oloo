import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useShop } from '@/hooks/useShop';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, MessageCircle, Palette, Star } from 'lucide-react';

interface EquippedItemsDisplayProps {
  userId: string;
  isOwnProfile?: boolean;
  variant?: 'compact' | 'full';
}

const rarityColors = {
  common: 'from-slate-400 to-slate-500',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-amber-400 via-orange-500 to-pink-600',
};

const rarityBorder = {
  common: 'border-slate-400',
  rare: 'border-blue-400',
  epic: 'border-purple-400',
  legendary: 'border-amber-400',
};

const categoryIcons = {
  badge: Star,
  theme: Palette,
  emoji: Sparkles,
  customization: MessageCircle,
};

export function EquippedItemsDisplay({ userId, isOwnProfile = false, variant = 'compact' }: EquippedItemsDisplayProps) {
  const { user } = useAuth();
  const { userPurchases, loading: shopLoading } = useShop();
  const [equippedItems, setEquippedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOwnProfile && userPurchases) {
      // For own profile, use the shop hook data
      const equipped = userPurchases.filter(p => p.is_equipped);
      setEquippedItems(equipped);
    } else if (!isOwnProfile && userId) {
      // For other profiles, fetch their equipped items
      fetchOtherUserEquippedItems();
    }
  }, [isOwnProfile, userPurchases, userId]);

  const fetchOtherUserEquippedItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_purchases')
        .select('*, shop_items(*)')
        .eq('user_id', userId)
        .eq('is_equipped', true);

      if (error) throw error;
      setEquippedItems(data || []);
    } catch (error) {
      console.error('Error fetching equipped items:', error);
      setEquippedItems([]);
    } finally {
      setLoading(false);
    }
  };

  const isLoading = isOwnProfile ? shopLoading : loading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse flex gap-2">
            <div className="w-12 h-12 bg-muted rounded-full" />
            <div className="w-12 h-12 bg-muted rounded-full" />
            <div className="w-12 h-12 bg-muted rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!equippedItems || equippedItems.length === 0) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap gap-2 items-center">
        <TooltipProvider>
          {equippedItems.map((purchase) => {
            const item = purchase.shop_items;
            const Icon = categoryIcons[item.category as keyof typeof categoryIcons];
            
            return (
              <Tooltip key={purchase.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      bg-gradient-to-br ${rarityColors[item.rarity as keyof typeof rarityColors]}
                      border-2 ${rarityBorder[item.rarity as keyof typeof rarityBorder]}
                      shadow-lg hover:scale-110 transition-transform cursor-pointer
                      relative
                    `}
                  >
                    <span className="text-lg drop-shadow-sm">{item.icon}</span>
                    {item.rarity === 'legendary' && (
                      <div className="absolute inset-0 rounded-full animate-pulse bg-white/20" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="text-center">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.rarity}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-5 h-5 text-primary" />
          Equipped Items
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {equippedItems.map((purchase) => {
            const item = purchase.shop_items;
            const Icon = categoryIcons[item.category as keyof typeof categoryIcons];
            
            return (
              <TooltipProvider key={purchase.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                      <div
                        className={`
                          w-14 h-14 rounded-full flex items-center justify-center
                          bg-gradient-to-br ${rarityColors[item.rarity as keyof typeof rarityColors]}
                          border-2 ${rarityBorder[item.rarity as keyof typeof rarityBorder]}
                          shadow-lg relative
                        `}
                      >
                        <span className="text-2xl drop-shadow-sm">{item.icon}</span>
                        {item.rarity === 'legendary' && (
                          <div className="absolute inset-0 rounded-full animate-pulse bg-white/20" />
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium truncate w-full">{item.name}</p>
                        <Badge 
                          variant="secondary" 
                          className="text-[10px] px-1.5 py-0 mt-1"
                        >
                          {item.category}
                        </Badge>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-xs">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {item.rarity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.coin_price} coins
                        </span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
