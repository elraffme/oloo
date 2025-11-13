import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Snowflake, Heart, Sparkles, Flame } from 'lucide-react';
import { formatDistanceToNow, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';

interface SeasonalCountdownProps {
  availableUntil: string;
  season?: string;
  size?: 'sm' | 'md' | 'lg';
}

const seasonIcons = {
  winter: Snowflake,
  christmas: Snowflake,
  valentine: Heart,
  halloween: Flame,
  summer: Sparkles,
  spring: Sparkles,
  fall: Flame,
};

const seasonColors = {
  winter: 'from-blue-400 to-cyan-400',
  christmas: 'from-red-500 to-green-500',
  valentine: 'from-pink-400 to-red-400',
  halloween: 'from-orange-500 to-purple-600',
  summer: 'from-yellow-400 to-orange-400',
  spring: 'from-green-400 to-pink-400',
  fall: 'from-orange-400 to-red-500',
};

export function SeasonalCountdown({ availableUntil, season, size = 'md' }: SeasonalCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const endDate = new Date(availableUntil);
      const now = new Date();
      
      if (endDate <= now) {
        setTimeLeft('Expired');
        return;
      }

      const days = differenceInDays(endDate, now);
      const hours = differenceInHours(endDate, now) % 24;
      const minutes = differenceInMinutes(endDate, now) % 60;

      // Mark as urgent if less than 24 hours left
      setIsUrgent(days === 0 && hours < 24);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h left`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m left`);
      } else {
        setTimeLeft(`${minutes}m left`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [availableUntil]);

  const SeasonIcon = season && seasonIcons[season as keyof typeof seasonIcons] 
    ? seasonIcons[season as keyof typeof seasonIcons] 
    : Clock;
  
  const gradient = season && seasonColors[season as keyof typeof seasonColors]
    ? seasonColors[season as keyof typeof seasonColors]
    : 'from-primary to-primary';

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
      className={`
        ${sizeClasses[size]}
        ${isUrgent ? 'animate-pulse' : ''}
        bg-gradient-to-r ${gradient} text-white border-0
        shadow-lg flex items-center gap-1
      `}
    >
      <SeasonIcon className={iconSizes[size]} />
      <span className="font-semibold">{timeLeft}</span>
    </Badge>
  );
}
