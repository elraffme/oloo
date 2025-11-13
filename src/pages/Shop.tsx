import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useShop, ShopItem } from '@/hooks/useShop';
import { useCurrency } from '@/hooks/useCurrency';
import { ShoppingBag, Sparkles, Check, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
  const { shopItems, userPurchases, loading, purchaseItem, toggleEquipped, isPurchased, purchasing } = useShop();
  const { balance } = useCurrency();
  const [selectedCategory, setSelectedCategory] = useState<string>('badge');

  const filteredItems = shopItems?.filter((item) => item.category === selectedCategory) || [];

  const handlePurchase = (itemId: string, price: number) => {
    if (!balance || balance.coin_balance < price) {
      return;
    }
    purchaseItem(itemId);
  };

  const ShopItemCard = ({ item }: { item: ShopItem }) => {
    const purchased = isPurchased(item.id);
    const isEquipped = userPurchases?.find((p) => p.item_id === item.id)?.is_equipped;
    const canAfford = balance && balance.coin_balance >= item.coin_price;

    return (
      <Card className={`p-4 border-2 ${rarityBorderColors[item.rarity]} hover:shadow-lg transition-all`}>
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between mb-3">
            <div className="text-4xl">{item.icon}</div>
            <Badge className={rarityColors[item.rarity]}>
              {item.rarity}
            </Badge>
          </div>

          <h3 className="font-bold text-lg mb-1">{item.name}</h3>
          <p className="text-sm text-muted-foreground mb-4 flex-grow">
            {item.description}
          </p>

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
            ) : (
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
                    Locked
                  </>
                )}
              </Button>
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
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Virtual Shop</h1>
          </div>
          <p className="text-muted-foreground">
            Spend your coins on exclusive items to customize your profile
          </p>
          {balance && (
            <div className="flex items-center gap-2 mt-4 text-xl font-semibold">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span className="text-amber-500">{balance.coin_balance}</span>
              <span className="text-muted-foreground">Coins Available</span>
            </div>
          )}
        </div>

        {/* Categories */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="badge">🏆 Badges</TabsTrigger>
            <TabsTrigger value="theme">🎨 Themes</TabsTrigger>
            <TabsTrigger value="emoji">😊 Emojis</TabsTrigger>
            <TabsTrigger value="customization">✨ Custom</TabsTrigger>
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
    </div>
  );
}
