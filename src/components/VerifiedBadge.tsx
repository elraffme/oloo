import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

interface VerifiedBadgeProps {
  verified?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ 
  verified = false, 
  size = 'md',
  showText = true 
}) => {
  if (!verified) return null;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <Badge 
      className={`
        bg-orange-500 hover:bg-orange-600 text-white border-none
        shadow-lg shadow-orange-500/25
        ${sizeClasses[size]}
        transition-all duration-300 hover:scale-105
      `}
    >
      <CheckCircle className={`${iconSizes[size]} ${showText ? 'mr-1' : ''}`} />
      {showText && 'Verified'}
    </Badge>
  );
};