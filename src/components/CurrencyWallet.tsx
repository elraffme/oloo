import { Coins, Sparkles, Crown } from 'lucide-react';
import { Button } from './ui/button';
import { useCurrency } from '@/hooks/useCurrency';
import { Skeleton } from './ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';

const VIP_TIER_CONFIG = {
  free: { icon: null, color: 'text-muted-foreground', label: 'Free' },
  bronze: { icon: Crown, color: 'text-amber-700', label: 'Bronze VIP' },
  silver: { icon: Crown, color: 'text-gray-400', label: 'Silver VIP' },
  gold: { icon: Crown, color: 'text-yellow-500', label: 'Gold VIP' },
  platinum: { icon: Crown, color: 'text-purple-500', label: 'Platinum VIP' },
};

export const CurrencyWallet = ({ onBuyCoins }: { onBuyCoins: () => void }) => {
  const { balance, loading } = useCurrency();

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    );
  }

  if (!balance) return null;

  const vipConfig = VIP_TIER_CONFIG[balance.vip_tier];
  const VipIcon = vipConfig.icon;

  return (
    <div className="flex items-center gap-2">
      {/* Coins */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Coins className="h-4 w-4 text-yellow-500" />
            <span className="font-semibold">{balance.coin_balance.toLocaleString()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold mb-2">Coin Balance</h4>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Available:</span>
                <span className="font-semibold text-lg">{balance.coin_balance.toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Lifetime purchased:</span>
                <span>{balance.lifetime_coins_purchased.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Lifetime spent:</span>
                <span>{balance.lifetime_coins_spent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Gifts sent:</span>
                <span>{balance.lifetime_gifts_sent}</span>
              </div>
            </div>
            <Button onClick={onBuyCoins} className="w-full" size="sm">
              Buy More Coins
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Gold */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="font-semibold">{balance.gold_balance.toLocaleString()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold mb-2">Gold Balance</h4>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Available:</span>
                <span className="font-semibold text-lg">{balance.gold_balance.toLocaleString()}</span>
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="text-muted-foreground mb-2">
                Gold can be earned through:
              </p>
              <ul className="space-y-1 text-xs">
                <li>• Daily login streaks</li>
                <li>• Receiving gifts from others</li>
                <li>• Completing profile milestones</li>
                <li>• Streaming sessions</li>
              </ul>
            </div>
            <div className="text-xs text-center text-muted-foreground">
              Convert gold to coins at 10:1 ratio in the shop
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* VIP Badge */}
      {VipIcon && (
        <div className={`flex items-center gap-1 ${vipConfig.color}`}>
          <VipIcon className="h-4 w-4" />
          <span className="text-xs font-semibold hidden md:inline">
            {vipConfig.label}
          </span>
        </div>
      )}
    </div>
  );
};
