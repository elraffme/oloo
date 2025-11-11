import { useState } from 'react';
import { Gift, Send, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { Skeleton } from './ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface Gift {
  id: number;
  name: string;
  cost_tokens: number;
  description: string;
  category: string;
  asset_url: string;
  rarity: string;
}

interface GiftSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiverId: string;
  receiverName: string;
}

const RARITY_COLORS = {
  common: 'border-gray-400',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-yellow-500',
};

export const GiftSelector = ({
  open,
  onOpenChange,
  receiverId,
  receiverName,
}: GiftSelectorProps) => {
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { balance, refreshBalance } = useCurrency();

  const { data: gifts, isLoading } = useQuery({
    queryKey: ['gifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gifts')
        .select('*')
        .order('cost_tokens');

      if (error) throw error;
      return data as Gift[];
    },
  });

  const categories = [...new Set(gifts?.map((g) => g.category) || [])];

  const handleSendGift = async () => {
    if (!selectedGift) return;

    setSending(true);
    try {
      const { error } = await supabase.rpc('send_gift', {
        p_receiver_id: receiverId,
        p_gift_id: selectedGift.id,
        p_message: message || null,
      });

      if (error) throw error;

      toast.success(`Sent ${selectedGift.name} to ${receiverName}!`, {
        icon: <Gift className="h-4 w-4" />,
      });

      await refreshBalance();
      setSelectedGift(null);
      setMessage('');
      onOpenChange(false);
    } catch (error: any) {
      if (error.message.includes('Insufficient coins')) {
        toast.error('Not enough coins. Visit the shop to buy more!');
      } else if (error.message.includes('Daily gift limit')) {
        toast.error('You have reached your daily gift limit');
      } else {
        toast.error(error.message || 'Failed to send gift');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" />
            Send Gift to {receiverName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your balance:</span>
            <span className="font-semibold text-lg">
              {balance?.coin_balance.toLocaleString() || 0} coins
            </span>
          </div>

          <Tabs defaultValue={categories[0] || 'all'}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat}>
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : (
                <GiftGrid
                  gifts={gifts || []}
                  selectedGift={selectedGift}
                  onSelectGift={setSelectedGift}
                  userBalance={balance?.coin_balance || 0}
                />
              )}
            </TabsContent>

            {categories.map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-4">
                <GiftGrid
                  gifts={gifts?.filter((g) => g.category === cat) || []}
                  selectedGift={selectedGift}
                  onSelectGift={setSelectedGift}
                  userBalance={balance?.coin_balance || 0}
                />
              </TabsContent>
            ))}
          </Tabs>

          {selectedGift && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{selectedGift.asset_url || '🎁'}</div>
                <div className="flex-1">
                  <h4 className="font-semibold">{selectedGift.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedGift.description}
                  </p>
                  <p className="text-sm font-semibold text-primary mt-1">
                    {selectedGift.cost_tokens} coins
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="message">Add a message (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Write something nice..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={200}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {message.length}/200 characters
                </p>
              </div>

              <Button
                onClick={handleSendGift}
                disabled={sending || (balance?.coin_balance || 0) < selectedGift.cost_tokens}
                className="w-full"
                size="lg"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Gift for {selectedGift.cost_tokens} coins
              </Button>

              {(balance?.coin_balance || 0) < selectedGift.cost_tokens && (
                <p className="text-sm text-destructive text-center">
                  Insufficient coins. You need {selectedGift.cost_tokens - (balance?.coin_balance || 0)} more coins.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const GiftGrid = ({
  gifts,
  selectedGift,
  onSelectGift,
  userBalance,
}: {
  gifts: Gift[];
  selectedGift: Gift | null;
  onSelectGift: (gift: Gift) => void;
  userBalance: number;
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {gifts.map((gift) => {
        const canAfford = userBalance >= gift.cost_tokens;
        const isSelected = selectedGift?.id === gift.id;

        return (
          <button
            key={gift.id}
            onClick={() => onSelectGift(gift)}
            disabled={!canAfford}
            className={`p-3 rounded-lg border-2 transition-all ${
              isSelected
                ? 'border-primary bg-primary/10'
                : canAfford
                ? 'border-border hover:border-primary/50'
                : 'border-border opacity-50 cursor-not-allowed'
            } ${RARITY_COLORS[gift.rarity as keyof typeof RARITY_COLORS]}`}
          >
            <div className="text-3xl mb-2">{gift.asset_url || '🎁'}</div>
            <div className="text-xs font-semibold truncate">{gift.name}</div>
            <div className="text-xs text-primary font-semibold mt-1">
              {gift.cost_tokens} coins
            </div>
          </button>
        );
      })}
    </div>
  );
};
