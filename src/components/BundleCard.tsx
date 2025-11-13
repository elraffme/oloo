import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBundles, ShopBundle } from '@/hooks/useBundles';
import { useCurrency } from '@/hooks/useCurrency';
import { Package, Sparkles, Clock } from 'lucide-react';
import { SeasonalCountdown } from './SeasonalCountdown';

interface BundleCardProps {
  bundle: ShopBundle;
}

export function BundleCard({ bundle }: BundleCardProps) {
  const { getBundleItems, purchaseBundle, purchasing } = useBundles();
  const { balance } = useCurrency();
  
  const items = getBundleItems(bundle.id);
  const canAfford = balance && balance.coin_balance >= bundle.coin_price;
  
  // Calculate total value
  const totalValue = items.reduce((sum, item) => sum + (item.shop_items?.coin_price || 0), 0);
  const savings = totalValue - bundle.coin_price;
  const savingsPercent = Math.round((savings / totalValue) * 100);

  return (
    <Card className="p-6 border-2 border-primary/20 hover:shadow-xl transition-all hover:border-primary/40 bg-gradient-to-br from-card to-card/50">
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-5xl">{bundle.icon}</div>
            <div>
              <h3 className="text-xl font-bold mb-1">{bundle.name}</h3>
              <p className="text-sm text-muted-foreground">{bundle.description}</p>
            </div>
          </div>
          
          {bundle.limited_edition && (
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
              Limited
            </Badge>
          )}
        </div>

        {bundle.available_until && (
          <div className="mb-4">
            <SeasonalCountdown availableUntil={bundle.available_until} size="sm" />
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm font-semibold text-muted-foreground mb-2">Bundle includes:</p>
          <div className="grid grid-cols-4 gap-2">
            {items.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="flex flex-col items-center p-2 bg-secondary/50 rounded-lg"
                title={item.shop_items?.name}
              >
                <span className="text-2xl">{item.shop_items?.icon}</span>
                <span className="text-xs text-center line-clamp-1 mt-1">
                  {item.shop_items?.name}
                </span>
              </div>
            ))}
          </div>
          {items.length > 8 && (
            <p className="text-xs text-muted-foreground mt-2">
              + {items.length - 8} more items
            </p>
          )}
        </div>

        <div className="mt-auto">
          <div className="flex items-center justify-between mb-4 pb-4 border-t pt-4">
            <div>
              <p className="text-sm text-muted-foreground line-through">
                {totalValue} 🪙
              </p>
              <p className="text-2xl font-bold text-primary">
                {bundle.coin_price} 🪙
              </p>
            </div>
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
              Save {savingsPercent}%
            </Badge>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => purchaseBundle(bundle.id)}
            disabled={!canAfford || purchasing}
          >
            <Package className="w-4 h-4 mr-2" />
            {canAfford ? 'Purchase Bundle' : 'Not Enough Coins'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
