import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Coins } from 'lucide-react';

interface Gift {
  id: number;
  name: string;
  cost_tokens: number;
  description: string | null;
  category: string | null;
  asset_url: string | null;
  rarity: string | null;
}

interface LivestreamGiftSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostUserId: string;
  hostName: string;
  streamId: string;
  onGiftSent?: (gift: Gift) => void;
}

export default function LivestreamGiftSelector({
  open,
  onOpenChange,
  hostUserId,
  hostName,
  streamId,
  onGiftSent
}: LivestreamGiftSelectorProps) {
  const { user } = useAuth();
  const { balance } = useCurrency();
  const [freeGifts, setFreeGifts] = useState<Gift[]>([]);
  const [premiumGifts, setPremiumGifts] = useState<Gift[]>([]);
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [sending, setSending] = useState(false);
  const [lastFreeGiftTime, setLastFreeGiftTime] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const FREE_GIFT_COOLDOWN = 5000; // 5 seconds

  useEffect(() => {
    if (open) {
      loadGifts();
    }
  }, [open]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(() => {
        const elapsed = Date.now() - lastFreeGiftTime;
        const remaining = Math.max(0, FREE_GIFT_COOLDOWN - elapsed);
        setCooldownRemaining(remaining);
        if (remaining === 0) {
          clearInterval(timer);
        }
      }, 100);
      return () => clearInterval(timer);
    }
  }, [cooldownRemaining, lastFreeGiftTime]);

  const loadGifts = async () => {
    const { data, error } = await supabase
      .from('gifts')
      .select('*')
      .order('cost_tokens', { ascending: true });

    if (error) {
      console.error('Error loading gifts:', error);
      return;
    }

    const free = data.filter(g => g.cost_tokens === 0 && g.category === 'free_livestream');
    const premium = data.filter(g => g.cost_tokens > 0);
    
    setFreeGifts(free);
    setPremiumGifts(premium.slice(0, 6)); // Show top 6 premium gifts
  };

  const handleSendGift = async () => {
    if (!selectedGift || !user) return;

    // Check free gift cooldown
    if (selectedGift.cost_tokens === 0) {
      const timeSinceLastFree = Date.now() - lastFreeGiftTime;
      if (timeSinceLastFree < FREE_GIFT_COOLDOWN) {
        toast.error(`Please wait ${Math.ceil((FREE_GIFT_COOLDOWN - timeSinceLastFree) / 1000)}s before sending another free gift`);
        return;
      }
    }

    // Check balance for premium gifts
    if (selectedGift.cost_tokens > 0 && balance && balance.coin_balance < selectedGift.cost_tokens) {
      toast.error('Not enough coins');
      return;
    }

    setSending(true);

    try {
      const { data: transaction, error } = await supabase.rpc('send_gift', {
        p_receiver_id: hostUserId,
        p_gift_id: selectedGift.id,
        p_message: null
      });

      if (error) throw error;

      // Update transaction with stream context
      if (transaction) {
        await supabase
          .from('gift_transactions')
          .update({ 
            metadata: { 
              stream_id: streamId,
              is_livestream: true 
            } 
          })
          .eq('receiver_id', hostUserId)
          .eq('gift_id', selectedGift.id)
          .order('created_at', { ascending: false })
          .limit(1);
      }

      if (selectedGift.cost_tokens === 0) {
        setLastFreeGiftTime(Date.now());
        setCooldownRemaining(FREE_GIFT_COOLDOWN);
      }

      toast.success(`Sent ${selectedGift.name} to ${hostName}!`);
      onGiftSent?.(selectedGift);
      setSelectedGift(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending gift:', error);
      toast.error('Failed to send gift');
    } finally {
      setSending(false);
    }
  };

  const canSendFreeGift = cooldownRemaining === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl border-border/50">
        <SheetHeader>
          <SheetTitle className="text-center">Send Gift to {hostName}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6 overflow-y-auto max-h-[calc(70vh-140px)] pb-4">
          {/* Free Gifts Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Free Gifts</h3>
              {!canSendFreeGift && (
                <span className="text-xs text-muted-foreground">
                  Cooldown: {(cooldownRemaining / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {freeGifts.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => setSelectedGift(gift)}
                  disabled={!canSendFreeGift}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    selectedGift?.id === gift.id
                      ? 'border-primary bg-primary/10 scale-105'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  } ${!canSendFreeGift ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="text-4xl">{gift.asset_url}</span>
                  <span className="text-xs font-medium text-foreground">{gift.name}</span>
                  <span className="text-xs text-primary font-semibold">FREE</span>
                </button>
              ))}
            </div>
          </div>

          {/* Premium Gifts Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Premium Gifts</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Coins className="w-3 h-3" />
                <span>{balance?.coin_balance || 0}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {premiumGifts.map((gift) => {
                const canAfford = balance && balance.coin_balance >= gift.cost_tokens;
                return (
                  <button
                    key={gift.id}
                    onClick={() => setSelectedGift(gift)}
                    disabled={!canAfford}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      selectedGift?.id === gift.id
                        ? 'border-primary bg-primary/10 scale-105'
                        : 'border-border hover:border-primary/50 hover:bg-accent'
                    } ${!canAfford ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-4xl">{gift.asset_url}</span>
                    <span className="text-xs font-medium text-foreground">{gift.name}</span>
                    <div className="flex items-center gap-1">
                      <Coins className="w-3 h-3 text-primary" />
                      <span className="text-xs font-semibold text-primary">{gift.cost_tokens}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Send Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-background">
          <Button
            onClick={handleSendGift}
            disabled={!selectedGift || sending || (selectedGift?.cost_tokens === 0 && !canSendFreeGift)}
            className="w-full"
            size="lg"
          >
            {sending ? 'Sending...' : selectedGift ? `Send ${selectedGift.name}` : 'Select a gift'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
