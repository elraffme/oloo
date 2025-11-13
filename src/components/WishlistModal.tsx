import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWishlist } from '@/hooks/useWishlist';
import { useShop } from '@/hooks/useShop';
import { useCurrency } from '@/hooks/useCurrency';
import { Heart, ShoppingBag, Trash2, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface WishlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WishlistModal({ open, onOpenChange }: WishlistModalProps) {
  const { wishlistItems, loading, toggleWishlist } = useWishlist();
  const { purchaseItem, isPurchased, purchasing } = useShop();
  const { balance } = useCurrency();

  const handlePurchase = (itemId: string, price: number) => {
    if (!balance || balance.coin_balance < price) {
      return;
    }
    purchaseItem(itemId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
            My Wishlist
            {wishlistItems && wishlistItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {wishlistItems.length}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="w-16 h-16 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </Card>
            ))
          ) : !wishlistItems || wishlistItems.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Your wishlist is empty
              </h3>
              <p className="text-sm text-muted-foreground">
                Add items to your wishlist to save them for later!
              </p>
            </div>
          ) : (
            wishlistItems.map((wishlistItem) => {
              const item = wishlistItem.shop_items;
              const purchased = isPurchased(item.id);
              const canAfford = balance && balance.coin_balance >= item.coin_price;
              const flashSale = (item as any).flash_sale_active;

              return (
                <Card key={wishlistItem.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="text-5xl">{item.icon}</div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {item.category}
                        </Badge>
                        {flashSale && (
                          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                            🔥 Flash Sale
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="text-lg font-bold">{item.coin_price} 🪙</span>
                      
                      {purchased ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Owned
                        </Badge>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handlePurchase(item.id, item.coin_price)}
                            disabled={!canAfford || purchasing}
                          >
                            <ShoppingBag className="w-4 h-4 mr-1" />
                            Buy
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleWishlist(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
