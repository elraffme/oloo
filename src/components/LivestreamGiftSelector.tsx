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
  const { balance, refreshBalance } = useCurrency();
  const [freeGifts, setFreeGifts] = useState<Gift[]>([]);
  const [pointGifts, setPointGifts] = useState<Gift[]>([]);
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [sending, setSending] = useState(false);
  const [lastFreeGiftTime, setLastFreeGiftTime] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const FREE_GIFT_COOLDOWN = 5000; // 5 seconds
  const points = balance?.coin_balance ?? 0;

  useEffect(() => {
    if (open) {
      loadGifts();
      refreshBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    setFreeGifts(data.filter((g) => g.cost_tokens === 0 && g.category === 'free_livestream'));
    setPointGifts(data.filter((g) => g.cost_tokens > 0 && g.category === 'stream'));
  };

  const handleSendGift = async () => {
    if (!selectedGift || !user) return;

    // Free gift cooldown
    if (selectedGift.cost_tokens === 0) {
      const timeSinceLastFree = Date.now() - lastFreeGiftTime;
      if (timeSinceLastFree < FREE_GIFT_COOLDOWN) {
        toast.error(`Please wait ${Math.ceil((FREE_GIFT_COOLDOWN - timeSinceLastFree) / 1000)}s before sending another free gift`);
        return;
      }
    }

    if (selectedGift.cost_tokens > 0 && points < selectedGift.cost_tokens) {
      toast.error('Not enough Oloo Points.');
      return;
    }

    setSending(true);

    try {
      const { error } = await supabase.rpc('send_stream_gift' as any, {
        p_receiver_id: hostUserId,
        p_gift_id: selectedGift.id,
        p_stream_id: streamId,
        p_message: null,
      });

      if (error) throw error;

      if (selectedGift.cost_tokens === 0) {
        setLastFreeGiftTime(Date.now());
        setCooldownRemaining(FREE_GIFT_COOLDOWN);
      }

      await refreshBalance();

      toast.success(
        selectedGift.cost_tokens > 0
          ? `Sent ${selectedGift.name} to ${hostName} for ${selectedGift.cost_tokens} Oloo Points!`
          : `Sent ${selectedGift.name} to ${hostName}!`
      );
      onGiftSent?.(selectedGift);
      setSelectedGift(null);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending gift:', error);
      if (String(error?.message || '').includes('Insufficient coins')) {
        toast.error('Not enough Oloo Points.');
      } else if (String(error?.message || '').includes('Daily gift limit')) {
        toast.error('You have reached your daily gift limit');
      } else {
        toast.error(error?.message || 'Failed to send gift');
      }
    } finally {
      setSending(false);
    }
  };

  const canSendFreeGift = cooldownRemaining === 0;
  const insufficient = !!selectedGift && selectedGift.cost_tokens > points;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl border-border/50">
        <SheetHeader>
          <SheetTitle className="text-center">Send Gift to {hostName}</SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <Coins className="w-4 h-4 text-yellow-500" />
          <span className="text-muted-foreground">Your balance:</span>
          <span className="font-semibold text-foreground">{points.toLocaleString()} Oloo Points</span>
        </div>

        <div className="mt-4 space-y-6 overflow-y-auto max-h-[calc(70vh-190px)] pb-4">
          {/* Free Gifts */}
          {freeGifts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Free Reactions</h3>
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
          )}

          {/* Point Gifts */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Oloo Points Gifts</h3>
            <div className="grid grid-cols-3 gap-3">
              {pointGifts.map((gift) => {
                const canAfford = points >= gift.cost_tokens;
                return (
                  <button
                    key={gift.id}
                    onClick={() => setSelectedGift(gift)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      selectedGift?.id === gift.id
                        ? 'border-primary bg-primary/10 scale-105'
                        : 'border-border hover:border-primary/50 hover:bg-accent'
                    } ${!canAfford ? 'opacity-60' : ''}`}
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
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-background space-y-2">
          {insufficient && (
            <p className="text-sm text-destructive text-center">Not enough Oloo Points.</p>
          )}
          <Button
            onClick={handleSendGift}
            disabled={
              !selectedGift ||
              sending ||
              insufficient ||
              (selectedGift?.cost_tokens === 0 && !canSendFreeGift)
            }
            className="w-full"
            size="lg"
          >
            {sending
              ? 'Sending...'
              : selectedGift
              ? selectedGift.cost_tokens > 0
                ? `Send ${selectedGift.name} — ${selectedGift.cost_tokens} Oloo Points`
                : `Send ${selectedGift.name}`
              : 'Select a gift'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
