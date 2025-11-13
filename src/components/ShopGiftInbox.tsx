import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useShopGifts, ShopGift } from '@/hooks/useShopGifts';
import { Gift, Check, X, Clock, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ShopGiftInboxProps {
  isOpen: boolean;
  onClose: () => void;
}

const rarityColors = {
  common: 'from-slate-400 to-slate-500',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-amber-400 via-orange-500 to-pink-600',
};

export function ShopGiftInbox({ isOpen, onClose }: ShopGiftInboxProps) {
  const { pendingGifts, sentGifts, acceptGift, declineGift, accepting, declining } = useShopGifts();
  const [selectedTab, setSelectedTab] = useState<'received' | 'sent'>('received');

  const GiftCard = ({ gift, type }: { gift: ShopGift; type: 'received' | 'sent' }) => {
    const item = gift.shop_items;
    const profile = type === 'received' ? gift.sender_profile : (gift as any).receiver_profile;

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex gap-4">
            {/* Item Display */}
            <div
              className={`
                w-20 h-20 rounded-lg flex items-center justify-center
                bg-gradient-to-br ${rarityColors[item.rarity as keyof typeof rarityColors]}
                flex-shrink-0 relative
              `}
            >
              <span className="text-3xl drop-shadow-sm">{item.icon}</span>
              {item.rarity === 'legendary' && (
                <div className="absolute inset-0 rounded-lg animate-pulse bg-white/20" />
              )}
            </div>

            {/* Gift Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h4 className="font-semibold truncate">{item.name}</h4>
                  <Badge variant="secondary" className="text-xs capitalize mt-1">
                    {item.rarity}
                  </Badge>
                </div>
                {gift.status === 'pending' && type === 'received' && (
                  <Badge variant="outline" className="flex-shrink-0">
                    <Clock className="w-3 h-3 mr-1" />
                    New
                  </Badge>
                )}
              </div>

              {/* From/To Profile */}
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {profile?.display_name?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {type === 'received' ? 'from' : 'to'} {profile?.display_name || 'Unknown'}
                </span>
              </div>

              {/* Message */}
              {gift.message && (
                <div className="text-sm bg-muted p-2 rounded mb-2">
                  <p className="italic">"{gift.message}"</p>
                </div>
              )}

              {/* Metadata */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{gift.coin_cost} coins</span>
                </div>
                <span>
                  {formatDistanceToNow(new Date(gift.created_at), { addSuffix: true })}
                </span>
              </div>

              {/* Actions for received pending gifts */}
              {type === 'received' && gift.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => acceptGift(gift.id)}
                    disabled={accepting || declining}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => declineGift(gift.id)}
                    disabled={accepting || declining}
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Decline
                  </Button>
                </div>
              )}

              {/* Status badges for sent gifts */}
              {type === 'sent' && (
                <div className="mt-3">
                  {gift.status === 'pending' && (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Waiting for response
                    </Badge>
                  )}
                  {gift.status === 'accepted' && (
                    <Badge className="text-xs bg-green-500">
                      <Check className="w-3 h-3 mr-1" />
                      Accepted
                    </Badge>
                  )}
                  {gift.status === 'declined' && (
                    <Badge variant="secondary" className="text-xs">
                      <X className="w-3 h-3 mr-1" />
                      Declined (Refunded)
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Gift Inbox
          </DialogTitle>
          <DialogDescription>
            Manage your shop item gifts
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received" className="gap-2">
              Received
              {pendingGifts && pendingGifts.length > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  {pendingGifts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="max-h-[500px] overflow-y-auto space-y-3 mt-4">
            {!pendingGifts || pendingGifts.length === 0 ? (
              <div className="text-center py-12">
                <Gift className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No pending gifts</p>
              </div>
            ) : (
              pendingGifts.map((gift) => (
                <GiftCard key={gift.id} gift={gift} type="received" />
              ))
            )}
          </TabsContent>

          <TabsContent value="sent" className="max-h-[500px] overflow-y-auto space-y-3 mt-4">
            {!sentGifts || sentGifts.length === 0 ? (
              <div className="text-center py-12">
                <Gift className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No sent gifts yet</p>
              </div>
            ) : (
              sentGifts.map((gift) => (
                <GiftCard key={gift.id} gift={gift} type="sent" />
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
