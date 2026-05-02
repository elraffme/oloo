import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumBadgeProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Visible badge for premium hosts/users.
 * Shown next to display names, in video tiles, chat, and discover lists.
 */
export const PremiumBadge = ({ className, showLabel = false, size = 'sm' }: PremiumBadgeProps) => {
  const dim = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-1.5 py-0.5 text-[10px] font-semibold shadow-sm',
        className,
      )}
      title="Premium member"
    >
      <Crown className={dim} />
      {showLabel && <span>Premium</span>}
    </span>
  );
};
