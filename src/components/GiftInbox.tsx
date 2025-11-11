import { useState } from 'react';
import { Gift, Mail, MailOpen, Sparkles, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { Skeleton } from './ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import { GiftAnimation } from './GiftAnimation';

interface GiftTransaction {
  id: string;
  sender_id: string;
  gift_id: number;
  coin_cost: number;
  message: string | null;
  status: 'sent' | 'opened' | 'expired';
  created_at: string;
  opened_at: string | null;
  sender_profile: {
    display_name: string;
    avatar_url: string | null;
  };
  gift: {
    name: string;
    asset_url: string;
    description: string;
  };
}

export const GiftInbox = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { user } = useAuth();
  const { refreshBalance } = useCurrency();
  const [openingGiftId, setOpeningGiftId] = useState<string | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationGift, setAnimationGift] = useState<any>(null);

  const { data: gifts, isLoading, refetch } = useQuery({
    queryKey: ['gift-inbox', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_transactions')
        .select(`
          *,
          sender_profile:profiles!gift_transactions_sender_id_fkey(display_name, avatar_url),
          gift:gifts(name, asset_url, description)
        `)
        .eq('receiver_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any as GiftTransaction[];
    },
    enabled: !!user && open,
  });

  const unopenedGifts = gifts?.filter((g) => g.status === 'sent') || [];
  const openedGifts = gifts?.filter((g) => g.status === 'opened') || [];

  const handleOpenGift = async (giftTransaction: GiftTransaction) => {
    setOpeningGiftId(giftTransaction.id);

    try {
      const { data, error } = await supabase.rpc('open_gift', {
        p_transaction_id: giftTransaction.id,
      });

      if (error) throw error;

      const result = data as any;
      
      // Show animation
      setAnimationGift({
        ...giftTransaction,
        goldEarned: result.gold_earned,
      });
      setShowAnimation(true);

      await Promise.all([refetch(), refreshBalance()]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to open gift');
    } finally {
      setOpeningGiftId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              Gift Inbox
              {unopenedGifts.length > 0 && (
                <span className="ml-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full">
                  {unopenedGifts.length} new
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="unopened">
            <TabsList className="w-full">
              <TabsTrigger value="unopened" className="flex-1">
                <Mail className="h-4 w-4 mr-2" />
                Unopened ({unopenedGifts.length})
              </TabsTrigger>
              <TabsTrigger value="opened" className="flex-1">
                <MailOpen className="h-4 w-4 mr-2" />
                History ({openedGifts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="unopened" className="space-y-3 mt-4">
              {isLoading ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)
              ) : unopenedGifts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No new gifts</p>
                </div>
              ) : (
                unopenedGifts.map((gift) => (
                  <GiftCard
                    key={gift.id}
                    gift={gift}
                    onOpen={handleOpenGift}
                    isOpening={openingGiftId === gift.id}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="opened" className="space-y-3 mt-4">
              {isLoading ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)
              ) : openedGifts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MailOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No opened gifts yet</p>
                </div>
              ) : (
                openedGifts.map((gift) => (
                  <GiftCard key={gift.id} gift={gift} opened />
                ))
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {showAnimation && animationGift && (
        <GiftAnimation
          gift={animationGift}
          onComplete={() => {
            setShowAnimation(false);
            setAnimationGift(null);
          }}
        />
      )}
    </>
  );
};

const GiftCard = ({
  gift,
  onOpen,
  isOpening,
  opened,
}: {
  gift: GiftTransaction;
  onOpen?: (gift: GiftTransaction) => void;
  isOpening?: boolean;
  opened?: boolean;
}) => {
  return (
    <div className={`p-4 rounded-lg border ${opened ? 'bg-muted/30' : 'bg-card'}`}>
      <div className="flex items-start gap-3">
        <div className="text-4xl">{gift.gift.asset_url || '🎁'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold">{gift.sender_profile.display_name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(gift.created_at), { addSuffix: true })}
            </span>
          </div>
          <div className="text-sm font-semibold text-primary mb-1">
            {gift.gift.name} ({gift.coin_cost} coins)
          </div>
          {gift.message && (
            <div className="text-sm text-muted-foreground italic p-2 bg-muted/50 rounded mt-2">
              "{gift.message}"
            </div>
          )}
          {opened && gift.opened_at && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
              <Calendar className="h-3 w-3" />
              Opened {formatDistanceToNow(new Date(gift.opened_at), { addSuffix: true })}
            </div>
          )}
        </div>
        {!opened && onOpen && (
          <Button
            onClick={() => onOpen(gift)}
            disabled={isOpening}
            size="sm"
            className="gap-2"
          >
            {isOpening ? (
              <>Opening...</>
            ) : (
              <>
                <Gift className="h-4 w-4" />
                Open
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
