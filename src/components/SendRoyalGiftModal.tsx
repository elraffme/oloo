import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { GiftVisual } from '@/components/GiftVisual';
import { Gift, Sparkles, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface RoyalGift {
  id: number;
  name: string;
  description: string | null;
  cost_tokens: number;
  asset_url: string | null;
  rarity: string | null;
  category: string | null;
}

interface SendRoyalGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  gift: RoyalGift | null;
}

interface Friend {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export function SendRoyalGiftModal({ isOpen, onClose, gift }: SendRoyalGiftModalProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { balance, refreshBalance } = useCurrency();

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    } else {
      setSelectedFriend(null);
      setMessage('');
      setSearchQuery('');
    }
  }, [isOpen]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_connections')
        .select(`
          connected_user_id,
          profiles:profiles!user_connections_connected_user_id_fkey(
            user_id,
            display_name,
            avatar_url
          )
        `)
        .eq('connection_type', 'friend');

      if (error) throw error;

      setFriends(
        (data || [])
          .filter((conn: any) => conn.profiles)
          .map((conn: any) => ({
            id: conn.connected_user_id,
            user_id: conn.profiles.user_id,
            display_name: conn.profiles.display_name,
            avatar_url: conn.profiles.avatar_url,
          }))
      );
    } catch (error) {
      console.error('Error loading friends:', error);
      toast.error('Failed to load friends list');
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friends.filter((friend) =>
    friend.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canAfford = !!balance && !!gift && balance.coin_balance >= gift.cost_tokens;

  const handleSend = async () => {
    if (!selectedFriend || !gift) return;
    if (!canAfford) {
      toast.error('Insufficient coins');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.rpc('send_gift' as any, {
        p_receiver_id: selectedFriend.user_id,
        p_gift_id: gift.id,
        p_message: message.trim() || null,
      });

      if (error) throw error;

      toast.success(`Sent ${gift.name} to ${selectedFriend.display_name}!`);
      await refreshBalance();
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send gift');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Send Gift
          </DialogTitle>
          <DialogDescription>Choose a friend to send this gift to</DialogDescription>
        </DialogHeader>

        {gift && (
          <div className="p-4 bg-muted rounded-lg mb-2 flex items-center gap-3">
            <GiftVisual asset={gift.asset_url} name={gift.name} className="h-16 w-16 shrink-0" animated />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground break-words">{gift.name}</h4>
              <div className="flex items-center gap-2 mt-1">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {gift.cost_tokens} coins
                </span>
              </div>
            </div>
          </div>
        )}

        {!selectedFriend ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading friends...</div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {friends.length === 0 ? 'No friends yet. Add friends to send gifts!' : 'No friends found'}
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredFriends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriend(friend)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <Avatar>
                      <AvatarImage src={friend.avatar_url || undefined} />
                      <AvatarFallback>{friend.display_name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{friend.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={selectedFriend.avatar_url || undefined} />
                  <AvatarFallback>{selectedFriend.display_name[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{selectedFriend.display_name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFriend(null)}>
                Change
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="royal-gift-message">Personal Message (Optional)</Label>
              <Textarea
                id="royal-gift-message"
                placeholder="Add a personal message to your gift..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">{message.length}/200 characters</p>
            </div>

            {!canAfford && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  Insufficient coins. You need {gift?.cost_tokens} coins.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending || !canAfford} className="flex-1">
                {sending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Gift className="w-4 h-4 mr-2" />
                )}
                {sending ? 'Sending...' : 'Send Gift'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
