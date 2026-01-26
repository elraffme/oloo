import { useState, useEffect } from 'react';
import { Coins, Sparkles, Check, Loader2, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { Skeleton } from './ui/skeleton';
import { useSearchParams } from 'react-router-dom';

interface CoinPackage {
  id: number;
  name: string;
  coin_amount: number;
  bonus_coins: number;
  price_cents: number;
  popular: boolean;
  best_value: boolean;
}

export const CoinShop = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const { refreshBalance, balance, convertGoldToCoins } = useCurrency();
  const [goldAmount, setGoldAmount] = useState('');
  const [converting, setConverting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: packages, isLoading } = useQuery({
    queryKey: ['coin-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coin_packages')
        .select('*')
        .eq('active', true)
        .order('display_order');

      if (error) throw error;
      return data as CoinPackage[];
    },
  });

  // Handle payment return
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');

    if (paymentStatus === 'success' && sessionId) {
      verifyPayment(sessionId);
      // Clear URL params
      setSearchParams({});
    } else if (paymentStatus === 'canceled') {
      toast.error('Payment was canceled');
      setSearchParams({});
    }
  }, [searchParams]);

  const verifyPayment = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-coin-payment', {
        body: { session_id: sessionId }
      });

      if (error) throw error;

      if (data.success) {
        if (data.already_processed) {
          toast.info('This payment was already processed');
        } else {
          toast.success(
            `Successfully added ${data.coins_added} coins to your wallet!`,
            { icon: <Coins className="h-4 w-4 text-yellow-500" /> }
          );
        }
        await refreshBalance();
      } else {
        toast.error(data.error || 'Payment verification failed');
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      toast.error('Failed to verify payment. Please contact support.');
    }
  };

  const handlePurchase = async (pkg: CoinPackage) => {
    setPurchasing(true);
    setSelectedPackage(pkg);

    try {
      const { data, error } = await supabase.functions.invoke('create-coin-checkout', {
        body: { package_id: pkg.id }
      });

      if (error) throw error;

      if (data.url) {
        // Open Stripe Checkout in new tab
        window.open(data.url, '_blank');
        toast.info('Stripe checkout opened in new tab. Complete your payment there.');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setPurchasing(false);
      setSelectedPackage(null);
    }
  };

  const handleConvertGold = async () => {
    const amount = parseInt(goldAmount);
    if (isNaN(amount) || amount <= 0 || amount % 10 !== 0) {
      toast.error('Please enter a valid amount (must be divisible by 10)');
      return;
    }

    if (!balance || balance.gold_balance < amount) {
      toast.error('Insufficient gold balance');
      return;
    }

    setConverting(true);
    try {
      await convertGoldToCoins(amount);
      setGoldAmount('');
    } catch (error) {
      // Error handled in hook
    } finally {
      setConverting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Coins className="h-6 w-6 text-yellow-500" />
            Coin Shop
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Gold to Coins Conversion */}
          {balance && balance.gold_balance > 0 && (
            <Card className="p-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold">Convert Gold to Coins</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                You have {balance.gold_balance} gold. Convert at 10:1 ratio (10 gold = 100 coins)
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="gold-amount">Gold Amount</Label>
                  <Input
                    id="gold-amount"
                    type="number"
                    placeholder="Enter amount (e.g., 100)"
                    value={goldAmount}
                    onChange={(e) => setGoldAmount(e.target.value)}
                    step={10}
                    min={10}
                    max={balance.gold_balance}
                  />
                </div>
                <Button
                  onClick={handleConvertGold}
                  disabled={converting || !goldAmount}
                  className="mt-6"
                >
                  {converting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Convert'
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* Coin Packages */}
          <div>
            <h3 className="font-semibold mb-4">Buy Coin Packages</h3>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages?.map((pkg) => (
                  <Card
                    key={pkg.id}
                    className={`p-4 relative ${
                      pkg.popular || pkg.best_value
                        ? 'border-primary shadow-lg'
                        : ''
                    }`}
                  >
                    {(pkg.popular || pkg.best_value) && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
                          {pkg.popular ? '🔥 Popular' : '⭐ Best Value'}
                        </div>
                      </div>
                    )}

                    <div className="text-center space-y-3 mt-2">
                      <div className="flex items-center justify-center gap-2">
                        <Coins className="h-8 w-8 text-yellow-500" />
                      </div>

                      <div>
                        <h4 className="font-semibold text-lg">{pkg.name}</h4>
                        <div className="text-2xl font-bold text-primary mt-1">
                          {(pkg.coin_amount + pkg.bonus_coins).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          coins
                        </div>
                        {pkg.bonus_coins > 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1">
                            +{pkg.bonus_coins} bonus!
                          </div>
                        )}
                      </div>

                      <div className="text-xl font-bold">
                        ${(pkg.price_cents / 100).toFixed(2)}
                      </div>

                      <Button
                        onClick={() => handlePurchase(pkg)}
                        disabled={purchasing}
                        className="w-full"
                        variant={pkg.popular || pkg.best_value ? 'default' : 'outline'}
                      >
                        {purchasing && selectedPackage?.id === pkg.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Purchase
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Benefits */}
          <Card className="p-4 bg-muted/50">
            <h3 className="font-semibold mb-3">Why Buy Coins?</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Send virtual gifts to show appreciation</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Unlock premium features and profile boosts</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Support your favorite streamers during live sessions</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Climb VIP tiers for exclusive perks</span>
              </li>
            </ul>
          </Card>

          {/* Payment Info */}
          <p className="text-xs text-muted-foreground text-center">
            Payments are processed securely via Stripe. All transactions are encrypted.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
