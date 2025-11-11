import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from './ui/button';

interface GiftAnimationProps {
  gift: {
    gift: {
      name: string;
      asset_url: string;
    };
    sender_profile: {
      display_name: string;
    };
    message: string | null;
    goldEarned: number;
  };
  onComplete: () => void;
}

export const GiftAnimation = ({ gift, onComplete }: GiftAnimationProps) => {
  const [stage, setStage] = useState<'appear' | 'show' | 'complete'>('appear');

  useEffect(() => {
    const appearTimer = setTimeout(() => setStage('show'), 100);
    return () => clearTimeout(appearTimer);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm transition-opacity duration-300 ${
        stage === 'appear' ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={onComplete}
    >
      <div
        className={`max-w-md w-full mx-4 space-y-6 transform transition-all duration-500 ${
          stage === 'appear'
            ? 'scale-50 opacity-0'
            : stage === 'show'
            ? 'scale-100 opacity-100'
            : 'scale-110 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated gift */}
        <div className="text-center relative">
          <div className="inline-block relative animate-bounce">
            <div className="text-9xl mb-4">{gift.gift.asset_url || '🎁'}</div>
            {/* Sparkle effects */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="absolute -top-4 -left-4 h-8 w-8 text-yellow-500 animate-pulse" />
              <Sparkles className="absolute -top-4 -right-4 h-6 w-6 text-amber-500 animate-pulse delay-100" />
              <Sparkles className="absolute -bottom-4 -left-4 h-6 w-6 text-yellow-400 animate-pulse delay-200" />
              <Sparkles className="absolute -bottom-4 -right-4 h-8 w-8 text-amber-400 animate-pulse delay-300" />
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-2">{gift.gift.name}</h2>
          <p className="text-xl text-muted-foreground mb-4">
            From {gift.sender_profile.display_name}
          </p>

          {gift.message && (
            <div className="bg-muted/50 p-4 rounded-lg mb-4 max-w-sm mx-auto">
              <p className="text-sm italic">"{gift.message}"</p>
            </div>
          )}

          <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-amber-500">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">
                You earned {gift.goldEarned} gold!
              </span>
            </div>
          </div>

          <Button onClick={onComplete} size="lg" className="w-full">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};
