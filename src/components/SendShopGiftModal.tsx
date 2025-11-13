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
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useShopGifts } from '@/hooks/useShopGifts';
import { useCurrency } from '@/hooks/useCurrency';
import { ShopItem } from '@/hooks/useShop';
import { Gift, Sparkles, Search } from 'lucide-react';
import { toast } from 'sonner';

interface SendShopGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ShopItem | null;
}

interface Friend {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export function SendShopGiftModal({ isOpen, onClose, item }: SendShopGiftModalProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { sendGift, sending } = useShopGifts();
  const { balance } = useCurrency();

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    } else {
      // Reset state when closing
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

      const friendsList = data
        .filter((conn: any) => conn.profiles)
        .map((conn: any) => ({
          id: conn.connected_user_id,
          user_id: conn.profiles.user_id,
          display_name: conn.profiles.display_name,
          avatar_url: conn.profiles.avatar_url,
        }));

      setFriends(friendsList);
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

  const handleSend = () => {
    if (!selectedFriend || !item) return;

    if (!balance || balance.coin_balance < item.coin_price) {
      toast.error('Insufficient coins');
      return;
    }

    sendGift(
      {
        receiverId: selectedFriend.user_id,
        itemId: item.id,
        message: message.trim() || undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const canAfford = balance && item && balance.coin_balance >= item.coin_price;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Send as Gift
          </DialogTitle>
          <DialogDescription>
            Choose a friend to send this item as a gift
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="p-4 bg-muted rounded-lg mb-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{item.icon}</div>
              <div className="flex-1">
                <h4 className="font-semibold">{item.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-500">
                    {item.coin_price} coins
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedFriend ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading friends...
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {friends.length === 0
                  ? 'No friends yet. Add friends to send gifts!'
                  : 'No friends found'}
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
                      <AvatarFallback>
                        {friend.display_name[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{friend.display_name}</span>
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
                  <AvatarFallback>
                    {selectedFriend.display_name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{selectedFriend.display_name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFriend(null)}
              >
                Change
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Personal Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal message to your gift..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {message.length}/200 characters
              </p>
            </div>

            {!canAfford && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  Insufficient coins. You need {item?.coin_price} coins.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || !canAfford}
                className="flex-1"
              >
                <Gift className="w-4 h-4 mr-2" />
                {sending ? 'Sending...' : 'Send Gift'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
