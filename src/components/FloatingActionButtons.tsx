import React from 'react';
import { Heart, Gift, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingActionButtonsProps {
  isLiked: boolean;
  totalLikes: number;
  onLike: () => void;
  onGift: () => void;
  onChat: () => void;
  className?: string;
}

export const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
  isLiked,
  totalLikes,
  onLike,
  onGift,
  onChat,
  className
}) => {
  return (
    <div className={cn(
      "fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-40 md:hidden",
      className
    )}>
      {/* Like Button */}
      <div className="flex flex-col items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={onLike}
          className={cn(
            "h-12 w-12 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-all duration-300",
            isLiked && "text-red-500"
          )}
        >
          <Heart 
            className={cn(
              "h-6 w-6 transition-all duration-300",
              isLiked && "fill-current animate-pulse"
            )} 
          />
        </Button>
        {totalLikes > 0 && (
          <span className="text-xs font-bold text-white drop-shadow-lg">
            {totalLikes > 999 ? `${(totalLikes / 1000).toFixed(1)}K` : totalLikes}
          </span>
        )}
      </div>

      {/* Gift Button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={onGift}
        className="h-12 w-12 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 hover:scale-110 transition-all duration-300"
      >
        <Gift className="h-6 w-6 text-white" />
      </Button>

      {/* Chat Button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={onChat}
        className="h-12 w-12 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 hover:scale-110 transition-all duration-300"
      >
        <MessageSquare className="h-6 w-6 text-white" />
      </Button>
    </div>
  );
};
