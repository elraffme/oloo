import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFeaturedItems } from '@/hooks/useFeaturedItems';
import { useShop } from '@/hooks/useShop';
import { useCurrency } from '@/hooks/useCurrency';
import { ChevronLeft, ChevronRight, Star, Sparkles } from 'lucide-react';

export function FeaturedItemsCarousel() {
  const { featuredItems, loading } = useFeaturedItems();
  const { purchaseItem, isPurchased, purchasing } = useShop();
  const { balance } = useCurrency();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!featuredItems || featuredItems.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
    }, 5000); // Auto-rotate every 5 seconds

    return () => clearInterval(interval);
  }, [featuredItems]);

  if (loading || !featuredItems || featuredItems.length === 0) return null;

  const currentItem = featuredItems[currentIndex];
  const item = currentItem.item_data;
  const purchased = isPurchased(item.id);
  const canAfford = balance && balance.coin_balance >= item.coin_price;

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + featuredItems.length) % featuredItems.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
  };

  const handlePurchase = () => {
    if (!canAfford) return;
    purchaseItem(item.id);
  };

  return (
    <Card 
      className="relative overflow-hidden border-0 mb-6"
      style={{ 
        background: currentItem.background_color,
        minHeight: '280px'
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMTAgNjAgTSAwIDEwIEwgNjAgMTAgTSAyMCAwIEwgMjAgNjAgTSAwIDIwIEwgNjAgMjAgTSAzMCAwIEwgMzAgNjAgTSAwIDMwIEwgNjAgMzAgTSA0MCAwIEwgNDAgNjAgTSAwIDQwIEwgNjAgNDAgTSA1MCAwIEwgNTAgNjAgTSAwIDUwIEwgNjAgNTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />
      
      <div className="relative p-8">
        <div className="flex items-center justify-between mb-6">
          <Badge className="bg-yellow-500/90 text-black border-0 flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            Featured
          </Badge>
          
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={handlePrevious}
              className="bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleNext}
              className="bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-9xl drop-shadow-2xl">{item.icon}</div>
          
          <div className="flex-1 text-white">
            <h2 className="text-3xl font-bold mb-2 drop-shadow-lg">
              {currentItem.title}
            </h2>
            <p className="text-lg mb-4 text-white/90 drop-shadow-md">
              {currentItem.description}
            </p>
            
            <div className="flex items-center gap-4 mb-6">
              <span className="text-3xl font-bold drop-shadow-lg">
                {item.coin_price} 🪙
              </span>
              {purchased && (
                <Badge className="bg-green-500 text-white">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Owned
                </Badge>
              )}
            </div>

            {!purchased && (
              <Button
                size="lg"
                onClick={handlePurchase}
                disabled={!canAfford || purchasing}
                className="bg-white text-black hover:bg-white/90 font-bold shadow-xl"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {canAfford ? 'Get This Item' : 'Not Enough Coins'}
              </Button>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-2 mt-6">
          {featuredItems.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-white w-8' 
                  : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
