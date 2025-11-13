import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShopItem } from '@/hooks/useShop';
import { useCurrency } from '@/hooks/useCurrency';
import { ChevronLeft, ChevronRight, Play, ShoppingBag, Eye } from 'lucide-react';
import { useState } from 'react';

interface ItemPreviewModalProps {
  item: ShopItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchase: (itemId: string, price: number) => void;
  isPurchased: boolean;
  purchasing: boolean;
}

export function ItemPreviewModal({
  item,
  open,
  onOpenChange,
  onPurchase,
  isPurchased,
  purchasing,
}: ItemPreviewModalProps) {
  const { balance } = useCurrency();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!item) return null;

  const assetData = (item.asset_data || {}) as any;
  const previewImages = assetData.preview_images || [];
  const previewVideo = assetData.preview_video;
  const canAfford = balance && balance.coin_balance >= item.coin_price;

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + previewImages.length) % previewImages.length);
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % previewImages.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <span className="text-4xl">{item.icon}</span>
            {item.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Preview Area */}
          <div className="relative bg-secondary/20 rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
            {item.category === 'badge' && (
              <div className="flex items-center justify-center h-80 bg-gradient-to-br from-primary/10 to-accent/10">
                <div className="text-center">
                  <div className="text-9xl mb-4 animate-pulse">{item.icon}</div>
                  <p className="text-sm text-muted-foreground">Badge Preview</p>
                </div>
              </div>
            )}

            {item.category === 'theme' && (
              <div className="p-6">
                <div className="bg-card rounded-lg p-4 border-2 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      👤
                    </div>
                    <div className="flex-1 bg-primary/10 rounded-lg p-3">
                      <p className="text-sm">Hey! Check out this amazing theme! 💬</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 flex-row-reverse">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                      👤
                    </div>
                    <div className="flex-1 bg-accent/10 rounded-lg p-3">
                      <p className="text-sm">Wow, this looks great! 😍</p>
                    </div>
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground mt-4">
                  {item.name} Chat Theme Preview
                </p>
              </div>
            )}

            {item.category === 'emoji' && (
              <div className="flex items-center justify-center h-80 bg-gradient-to-br from-secondary/30 to-muted/30">
                <div className="space-y-6">
                  <div className="text-9xl text-center animate-bounce">{item.icon}</div>
                  <div className="flex gap-4 justify-center">
                    <span className="text-6xl opacity-75">{item.icon}</span>
                    <span className="text-4xl opacity-50">{item.icon}</span>
                    <span className="text-2xl opacity-25">{item.icon}</span>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Different sizes preview
                  </p>
                </div>
              </div>
            )}

            {item.category === 'customization' && (
              <div className="flex items-center justify-center h-80 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                <div className="text-center">
                  <div className="text-9xl mb-4">{item.icon}</div>
                  <Badge className="text-lg px-4 py-2">{item.name}</Badge>
                  <p className="text-sm text-muted-foreground mt-4">Customization Preview</p>
                </div>
              </div>
            )}

            {/* Image Gallery Navigation */}
            {previewImages.length > 0 && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handlePrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>

          {/* Item Details */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>

            <div className="flex items-center gap-4">
              <Badge variant="secondary">{item.category}</Badge>
              <Badge className={`bg-${item.rarity === 'legendary' ? 'amber' : item.rarity === 'epic' ? 'purple' : item.rarity === 'rare' ? 'blue' : 'slate'}-500`}>
                {item.rarity}
              </Badge>
              {item.limited_edition && (
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                  Limited Edition
                </Badge>
              )}
            </div>

            {/* Purchase Section */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Price</p>
                <p className="text-2xl font-bold">{item.coin_price} 🪙</p>
              </div>

              {isPurchased ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 px-4 py-2 text-base">
                  ✓ Owned
                </Badge>
              ) : (
                <Button
                  size="lg"
                  onClick={() => onPurchase(item.id, item.coin_price)}
                  disabled={!canAfford || purchasing}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  {canAfford ? 'Purchase Now' : 'Not Enough Coins'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
