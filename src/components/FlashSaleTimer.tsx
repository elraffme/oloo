import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Zap, Flame } from 'lucide-react';

interface FlashSaleTimerProps {
  endsAt: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function FlashSaleTimer({ endsAt, size = 'md', showIcon = true }: FlashSaleTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endsAt).getTime();
      const difference = end - now;

      if (difference <= 0) {
        setTimeLeft('ENDED');
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      // Mark as urgent if less than 1 hour left
      setIsUrgent(hours < 1);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [endsAt]);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <Badge
      className={`${sizeClasses[size]} ${
        isUrgent
          ? 'bg-gradient-to-r from-red-500 to-orange-500 animate-pulse'
          : 'bg-gradient-to-r from-purple-500 to-pink-500'
      } text-white border-0 font-bold flex items-center gap-1`}
    >
      {showIcon && (isUrgent ? <Flame className={iconSizes[size]} /> : <Zap className={iconSizes[size]} />)}
      {timeLeft}
    </Badge>
  );
}
