import { useEffect, useState } from 'react';

export interface GiftAnimation {
  id: string;
  giftEmoji: string;
  giftName: string;
  senderName: string;
  timestamp: number;
}

interface LivestreamGiftAnimationProps {
  animations: GiftAnimation[];
}

export default function LivestreamGiftAnimation({ animations }: LivestreamGiftAnimationProps) {
  const [visibleAnimations, setVisibleAnimations] = useState<GiftAnimation[]>([]);

  useEffect(() => {
    setVisibleAnimations(animations);

    // Auto-remove animations after 3 seconds
    const timers = animations.map(animation => {
      return setTimeout(() => {
        setVisibleAnimations(prev => prev.filter(a => a.id !== animation.id));
      }, 3000);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [animations]);

  if (visibleAnimations.length === 0) return null;

  return (
    <div className="fixed bottom-32 right-4 z-40 pointer-events-none flex flex-col gap-2 items-end">
      {visibleAnimations.map((animation, index) => (
        <div
          key={animation.id}
          className="animate-[slide-in-right_0.3s_ease-out,fade-out_0.5s_ease-in_2.5s] flex items-center gap-2 bg-background/90 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg"
          style={{
            animationDelay: `${index * 100}ms`
          }}
        >
          <span className="text-3xl animate-bounce">{animation.giftEmoji}</span>
          <div className="flex flex-col text-xs">
            <span className="font-semibold text-foreground">{animation.senderName}</span>
            <span className="text-muted-foreground">{animation.giftName}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
