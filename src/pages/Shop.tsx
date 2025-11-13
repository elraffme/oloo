import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useShop, ShopItem } from '@/hooks/useShop';
import { useCurrency } from '@/hooks/useCurrency';
import { useShopGifts } from '@/hooks/useShopGifts';
import { useWishlist } from '@/hooks/useWishlist';
import { useBundles } from '@/hooks/useBundles';
import { useFeaturedItems } from '@/hooks/useFeaturedItems';
import { SendShopGiftModal } from '@/components/SendShopGiftModal';
import { ShopGiftInbox } from '@/components/ShopGiftInbox';
import { SeasonalCountdown } from '@/components/SeasonalCountdown';
import { FlashSaleBanner } from '@/components/FlashSaleBanner';
import { FlashSaleTimer } from '@/components/FlashSaleTimer';
import { FeaturedItemsCarousel } from '@/components/FeaturedItemsCarousel';
import { BundleCard } from '@/components/BundleCard';
import { WishlistModal } from '@/components/WishlistModal';
import { ItemPreviewModal } from '@/components/ItemPreviewModal';
import { ShoppingBag, Sparkles, Check, Lock, Gift, Inbox, Snowflake, Heart, Eye, Zap, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

const rarityColors = {
  common: 'bg-slate-500',
  rare: 'bg-blue-500',
  epic: 'bg-purple-500',
  legendary: 'bg-amber-500',
};

const rarityBorderColors = {
  common: 'border-slate-500/20',
  rare: 'border-blue-500/20',
  epic: 'border-purple-500/20',
  legendary: 'border-amber-500/20',
};

const categoryLabels = {
  badge: 'Badges',
  theme: 'Chat Themes',
  emoji: 'Emojis',
  customization: 'Customizations',
};

export default function Shop() {
  const { shopItems, flashSaleItems, userPurchases, loading, purchaseItem, purchaseFlashSale, toggleEquipped, isPurchased, purchasing } = useShop();
  const { balance } = useCurrency();
  const { pendingCount } = useShopGifts();
  const { wishlistCount, toggleWishlist, isInWishlist } = useWishlist();
  const { bundles } = useBundles();
  const { featuredItems } = useFeaturedItems();
  const [selectedCategory, setSelectedCategory] = useState<string>('featured');
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [selectedGiftItem, setSelectedGiftItem] = useState<ShopItem | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<ShopItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const navigate = useNavigate();

  const filteredItems = selectedCategory === 'vip' 
    ? shopItems?.filter((item) => (item as any).vip_only === true) || []
    : selectedCategory === 'seasonal'
    ? shopItems?.filter((item) => (item as any).is_seasonal === true) || []
    : selectedCategory === 'flash'
    ? flashSaleItems || []
    : selectedCategory === 'bundles'
    ? []
    : selectedCategory === 'featured'
    ? []
    : shopItems?.filter((item) => item.category === selectedCategory) || [];

  const handlePurchase = (itemId: string, price: number, isFlashSale = false) => {
    if (!balance || balance.coin_balance < price) {
      return;
    }
    if (isFlashSale) {
      purchaseFlashSale(itemId);
    } else {
      purchaseItem(itemId);
    }
  };

  const handleGiftClick = (item: ShopItem) => {
    setSelectedGiftItem(item);
    setGiftModalOpen(true);
  };

  const handlePreview = (item: ShopItem) => {
    setPreviewItem(item);
    setPreviewOpen(true);
  };

  const ShopItemCard = ({ item }: { item: ShopItem }) => {
    const purchased = isPurchased(item.id);
    const isEquipped = userPurchases?.find((p) => p.item_id === item.id)?.is_equipped;
    const canAfford = balance && balance.coin_balance >= item.coin_price;
    const isVipOnly = (item as any).vip_only || false;
    const requiredTier = (item as any).required_tier;
    const isSeasonal = (item as any).is_seasonal || false;
    const availableUntil = (item as any).available_until;
    const season = (item as any).season;
    const isFlashSale = (item as any).flash_sale_active || false;
    const flashSaleEndsAt = (item as any).flash_sale_ends_at;
    const flashSaleDiscount = (item as any).flash_sale_discount_percent;
    const flashSaleStock = (item as any).flash_sale_stock_remaining;
    const inWishlist = isInWishlist(item.id);
    
    // Get user's membership tier from balance (which has vip_tier)
    const userTier = balance?.vip_tier || 'free';
    const hasRequiredTier = !isVipOnly || userTier !== 'free';
    const meetsSpecificTier = !requiredTier || 
      (requiredTier === 'premium' && userTier !== 'free') ||
      (requiredTier === 'gold' && userTier === 'gold');

    return (
      <Card className={`p-4 border-2 ${rarityBorderColors[item.rarity]} hover:shadow-lg transition-all ${!hasRequiredTier || !meetsSpecificTier ? 'opacity-75' : ''}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between mb-3">
            <div className="relative">
              <div className="text-4xl">{item.icon}</div>
              {isVipOnly && (
                <div className="absolute -top-2 -right-2">
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-xs px-1.5 py-0">
                    VIP
                  </Badge>
                </div>
              )}
              {isSeasonal && !isVipOnly && (
                <div className="absolute -top-2 -right-2">
                  <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 text-xs px-1.5 py-0">
                    <Snowflake className="w-3 h-3" />
                  </Badge>
                </div>
              )}
            </div>
            <Badge className={rarityColors[item.rarity]}>
              {item.rarity}
            </Badge>
          </div>

          <h3 className="font-bold text-lg mb-1">{item.name}</h3>
          <p className="text-sm text-muted-foreground mb-4 flex-grow">
            {item.description}
          </p>

          {isSeasonal && availableUntil && (
            <div className="mb-3">
              <SeasonalCountdown 
                availableUntil={availableUntil} 
                season={season}
                size="sm"
              />
            </div>
          )}

          {requiredTier && (
            <div className="mb-3">
              <Badge variant="outline" className="text-xs capitalize">
                Requires {requiredTier}
              </Badge>
            </div>
          )}

          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-1 text-amber-500 font-bold">
              <Sparkles className="w-4 h-4" />
              <span>{item.coin_price}</span>
            </div>

            {purchased ? (
              <Button
                size="sm"
                variant={isEquipped ? 'default' : 'outline'}
                onClick={() => toggleEquipped(item.id)}
                className="gap-1"
              >
                {isEquipped ? (
                  <>
                    <Check className="w-4 h-4" />
                    Equipped
                  </>
                ) : (
                  'Equip'
                )}
              </Button>
            ) : !hasRequiredTier || !meetsSpecificTier ? (
              <Button
                size="sm"
                disabled
                className="gap-1"
              >
                <Lock className="w-4 h-4" />
                {requiredTier ? requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1) : 'Premium'} Only
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handlePurchase(item.id, item.coin_price)}
                  disabled={!canAfford || purchasing}
                  className="gap-1"
                >
                  {canAfford ? (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      Buy
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      {item.coin_price}
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGiftClick(item)}
                  disabled={!canAfford}
                  className="gap-1 px-2"
                >
                  <Gift className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ShoppingBag className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold">Virtual Shop</h1>
            </div>
            <p className="text-muted-foreground">
              Spend your coins on exclusive items to customize your profile
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setInboxOpen(true)}
            className="gap-2 relative"
          >
            <Inbox className="w-5 h-5" />
            Gift Inbox
            {pendingCount > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 px-1.5 py-0 text-xs">
                {pendingCount}
              </Badge>
            )}
          </Button>
        </div>
        
        <div className="flex items-center justify-between">
          {balance && (
            <div className="flex items-center gap-2 text-xl font-semibold">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span className="text-amber-500">{balance.coin_balance}</span>
              <span className="text-muted-foreground">Coins Available</span>
            </div>
          )}
          
          {balance?.vip_tier === 'free' && (
            <Button
              variant="default"
              onClick={() => navigate('/app/premium')}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              <Lock className="w-4 h-4 mr-2" />
              Unlock VIP Items
            </Button>
          )}
        </div>
      </div>

      {/* Categories */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="grid w-full grid-cols-6 mb-8">
          <TabsTrigger value="badge">🏆 Badges</TabsTrigger>
          <TabsTrigger value="theme">🎨 Themes</TabsTrigger>
          <TabsTrigger value="emoji">😊 Emojis</TabsTrigger>
          <TabsTrigger value="customization">✨ Custom</TabsTrigger>
          <TabsTrigger value="vip" className="bg-gradient-to-r from-amber-500/10 to-orange-500/10">
            👑 VIP
          </TabsTrigger>
          <TabsTrigger value="seasonal" className="bg-gradient-to-r from-blue-500/10 to-purple-500/10">
            ❄️ Seasonal
          </TabsTrigger>
        </TabsList>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-40 w-full" />
                </Card>
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="badge" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map((item) => (
                    <ShopItemCard key={item.id} item={item} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="theme" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map((item) => (
                    <ShopItemCard key={item.id} item={item} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="emoji" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map((item) => (
                    <ShopItemCard key={item.id} item={item} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="customization" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map((item) => (
                    <ShopItemCard key={item.id} item={item} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="vip" className="mt-0">
                {balance?.vip_tier === 'free' ? (
                  <div className="text-center py-12">
                    <div className="inline-block p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl mb-6">
                      <Lock className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                      <h3 className="text-2xl font-bold mb-2">Premium Members Only</h3>
                      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                        Unlock exclusive VIP items including legendary badges, premium themes, and special customizations
                      </p>
                      <Button
                        size="lg"
                        onClick={() => navigate('/app/premium')}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Upgrade to Premium
                      </Button>
                    </div>
                    
                    {/* Preview locked items */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50 pointer-events-none">
                      {filteredItems.slice(0, 6).map((item) => (
                        <ShopItemCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <ShopItemCard key={item.id} item={item} />
                      ))
                    ) : (
                      <div className="col-span-3 text-center py-12 text-muted-foreground">
                        No VIP items available at the moment
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="seasonal" className="mt-0">
                <div className="mb-6 p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl">
                  <div className="flex items-center gap-3 mb-3">
                    <Snowflake className="w-8 h-8 text-blue-500" />
                    <div>
                      <h3 className="text-2xl font-bold">Seasonal Collection</h3>
                      <p className="text-muted-foreground">
                        Limited-time items available only during special events and holidays
                      </p>
                    </div>
                  </div>
                </div>

                {filteredItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map((item) => (
                      <ShopItemCard key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Snowflake className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">No Seasonal Items</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      There are no seasonal items available right now. Check back during holidays and special events for exclusive limited-time items!
                    </p>
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* My Items Section */}
        {userPurchases && userPurchases.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4">My Items</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userPurchases.map((purchase) => (
                <ShopItemCard key={purchase.id} item={purchase.shop_items} />
              ))}
            </div>
          </div>
        )}

      {/* Gift Modals */}
      <SendShopGiftModal
        isOpen={giftModalOpen}
        onClose={() => setGiftModalOpen(false)}
        item={selectedGiftItem}
      />
      <ShopGiftInbox
        isOpen={inboxOpen}
        onClose={() => setInboxOpen(false)}
      />
    </div>
  );
}
