import React from 'react';
import { Heart, Gift, MessageSquare, LogOut, Mic, MicOff, Video, VideoOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingActionButtonsProps {
  isLiked: boolean;
  totalLikes: number;
  onLike: () => void;
  onGift: () => void;
  onChat: () => void;
  onLeave?: () => void;
  onMic?: () => void;
  onCamera?: () => void;
  micEnabled?: boolean;
  cameraEnabled?: boolean;
  isMicRequesting?: boolean;
  isCameraRequesting?: boolean;
  unreadMessages?: number;
  className?: string;
}

export const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
  isLiked,
  totalLikes,
  onLike,
  onGift,
  onChat,
  onLeave,
  onMic,
  onCamera,
  micEnabled = false,
  cameraEnabled = false,
  isMicRequesting = false,
  isCameraRequesting = false,
  unreadMessages = 0,
  className
}) => {
  return (
    <div className={cn(
      "fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-row items-center gap-3 z-40 md:hidden",
      "bg-black/60 backdrop-blur-md rounded-full px-4 py-2",
      className
    )}>
      {/* Gift Button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={onGift}
        className="h-11 w-11 rounded-full hover:bg-white/20 transition-all duration-300"
      >
        <Gift className="h-5 w-5 text-white" />
      </Button>

      {/* Chat Button */}
      <div className="relative">
        <Button
          size="icon"
          variant="ghost"
          onClick={onChat}
          className="h-11 w-11 rounded-full hover:bg-white/20 transition-all duration-300"
        >
          <MessageSquare className="h-5 w-5 text-white" />
        </Button>
        {unreadMessages > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1 animate-pulse">
            {unreadMessages > 99 ? '99+' : unreadMessages}
          </span>
        )}
      </div>

      {/* Like Button */}
      <div className="flex flex-col items-center">
        <Button
          size="icon"
          variant="ghost"
          onClick={onLike}
          className={cn(
            "h-11 w-11 rounded-full hover:bg-white/20 transition-all duration-300",
            isLiked && "text-red-500"
          )}
        >
          <Heart 
            className={cn(
              "h-5 w-5 transition-all duration-300",
              isLiked ? "fill-current text-red-500" : "text-white"
            )} 
          />
        </Button>
        {totalLikes > 0 && (
          <span className="text-[10px] font-bold text-white -mt-1">
            {totalLikes > 999 ? `${(totalLikes / 1000).toFixed(1)}K` : totalLikes}
          </span>
        )}
      </div>

      {/* Camera Button */}
      {onCamera && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onCamera}
          disabled={isCameraRequesting}
          className={cn(
            "h-11 w-11 rounded-full transition-all duration-300",
            cameraEnabled ? "bg-primary hover:bg-primary/80" : "hover:bg-white/20"
          )}
        >
          {isCameraRequesting ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : cameraEnabled ? (
            <Video className="h-5 w-5 text-white" />
          ) : (
            <VideoOff className="h-5 w-5 text-white" />
          )}
        </Button>
      )}

      {/* Mic Button */}
      {onMic && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onMic}
          disabled={isMicRequesting}
          className={cn(
            "h-11 w-11 rounded-full transition-all duration-300",
            micEnabled ? "bg-primary hover:bg-primary/80" : "hover:bg-white/20"
          )}
        >
          {isMicRequesting ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : micEnabled ? (
            <Mic className="h-5 w-5 text-white" />
          ) : (
            <MicOff className="h-5 w-5 text-white" />
          )}
        </Button>
      )}

      {/* Leave Button */}
      {onLeave && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onLeave}
          className="h-11 w-11 rounded-full bg-destructive/80 hover:bg-destructive transition-all duration-300"
        >
          <LogOut className="h-5 w-5 text-white" />
        </Button>
      )}
    </div>
  );
};
