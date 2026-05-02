import { Crown, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { cn } from '@/lib/utils';

interface UpgradePromptProps {
  title?: string;
  description?: string;
  variant?: 'inline' | 'card' | 'banner';
  className?: string;
  ctaLabel?: string;
}

/**
 * Reusable upgrade-to-premium CTA. Shown wherever a free user hits a limit
 * (duration, viewer cap, replay, HD quality, etc.).
 */
export const UpgradePrompt = ({
  title = 'Upgrade to Premium',
  description = 'Unlock unlimited livestreams, 100 viewers, HD quality and replays.',
  variant = 'card',
  className,
  ctaLabel = 'Upgrade',
}: UpgradePromptProps) => {
  const navigate = useNavigate();
  const { openCheckout } = useSubscription();

  const handleUpgrade = async () => {
    try {
      await openCheckout();
    } catch {
      navigate('/app/premium');
    }
  };

  if (variant === 'inline') {
    return (
      <Button
        size="sm"
        onClick={handleUpgrade}
        className={cn(
          'bg-gradient-to-r from-yellow-400 to-amber-500 text-white hover:from-yellow-500 hover:to-amber-600',
          className,
        )}
      >
        <Crown className="h-4 w-4 mr-1.5" />
        {ctaLabel}
      </Button>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border border-amber-300/30 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 px-4 py-3',
          className,
        )}
      >
        <div className="flex items-start gap-2">
          <Sparkles className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
        <Button size="sm" onClick={handleUpgrade} className="shrink-0">
          {ctaLabel}
        </Button>
      </div>
    );
  }

  return (
    <Card className={cn('p-4 border-amber-300/40 bg-gradient-to-br from-amber-500/10 to-yellow-500/5', className)}>
      <div className="flex items-center gap-2 mb-2">
        <Crown className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      <Button onClick={handleUpgrade} className="w-full">
        {ctaLabel}
      </Button>
    </Card>
  );
};
