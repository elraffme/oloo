import React from 'react';
import { usePresenceContext } from '@/contexts/PresenceContext';
import { cn } from '@/lib/utils';

interface OnlineStatusBadgeProps {
  userId: string;
  className?: string;
  showDot?: boolean;
  showText?: boolean;
}

export const OnlineStatusBadge: React.FC<OnlineStatusBadgeProps> = ({ 
  userId, 
  className,
  showDot = true,
  showText = false
}) => {
  const { isUserOnline } = usePresenceContext();
  const isOnline = isUserOnline(userId);

  if (!showDot && !showText) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {showDot && (
        <span className={cn(
          "w-2.5 h-2.5 rounded-full border-2 border-background",
          isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"
        )} />
      )}
      {showText && (
        <span className={cn(
          "text-xs font-medium",
          isOnline ? "text-green-600 dark:text-green-400" : "text-gray-500"
        )}>
          {isOnline ? "Online" : "Offline"}
        </span>
      )}
    </div>
  );
};
