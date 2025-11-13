import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlashSaleTimer } from './FlashSaleTimer';
import { Zap, Sparkles } from 'lucide-react';
import { ShopItem } from '@/hooks/useShop';

interface FlashSaleBannerProps {
  items: ShopItem[];
  onItemClick: (item: ShopItem) => void;
}

export function FlashSaleBanner({ items, onItemClick }: FlashSaleBannerProps) {
  if (!items || items.length === 0) return null;

  const featuredItem = items[0];
  const flashSaleData = featuredItem as any;

  return (
    <Card className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 border-0 mb-6">
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />
      
      <div className="relative p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-6 h-6 text-yellow-300 animate-pulse" />
              <h2 className="text-2xl md:text-3xl font-bold">⚡ FLASH SALE ⚡</h2>
            </div>
            <p className="text-lg mb-3 text-white/90">
              Save {flashSaleData.flash_sale_discount_percent}% on exclusive items!
            </p>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-white/80">Ends in:</span>
              <FlashSaleTimer endsAt={flashSaleData.flash_sale_ends_at} size="lg" />
            </div>
            {flashSaleData.flash_sale_stock_remaining && (
              <p className="text-sm text-yellow-300 font-semibold">
                🔥 Only {flashSaleData.flash_sale_stock_remaining} left!
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">{featuredItem.icon}</div>
            <div className="text-center">
              <p className="text-white font-semibold mb-1">{featuredItem.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-white/60 line-through text-lg">
                  {featuredItem.coin_price} 🪙
                </span>
                <span className="text-yellow-300 font-bold text-2xl">
                  {Math.floor(featuredItem.coin_price * (100 - flashSaleData.flash_sale_discount_percent) / 100)} 🪙
                </span>
              </div>
            </div>
            <Button
              onClick={() => onItemClick(featuredItem)}
              className="bg-white text-purple-600 hover:bg-yellow-300 hover:text-purple-700 font-bold shadow-lg"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Grab Deal Now!
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
