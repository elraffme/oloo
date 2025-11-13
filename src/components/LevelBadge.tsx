import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Star, Sparkles, Crown, Zap } from 'lucide-react';

interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export function LevelBadge({ level, size = 'md', showTooltip = true, className = '' }: LevelBadgeProps) {
  const getLevelIcon = (level: number) => {
    if (level >= 50) return <Crown className="h-3 w-3" />;
    if (level >= 25) return <Sparkles className="h-3 w-3" />;
    if (level >= 10) return <Zap className="h-3 w-3" />;
    return <Star className="h-3 w-3" />;
  };

  const getLevelColor = (level: number) => {
    if (level >= 50) return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
    if (level >= 25) return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
    if (level >= 10) return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
    return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
  };

  const getLevelTitle = (level: number) => {
    if (level >= 50) return 'Legendary';
    if (level >= 25) return 'Master';
    if (level >= 10) return 'Expert';
    if (level >= 5) return 'Advanced';
    return 'Beginner';
  };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const badge = (
    <Badge 
      className={`
        ${getLevelColor(level)} 
        ${sizeClasses[size]}
        font-bold 
        border-2 
        border-white/20
        shadow-lg
        flex items-center gap-1
        ${className}
      `}
    >
      {getLevelIcon(level)}
      <span>LVL {level}</span>
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">{getLevelTitle(level)}</p>
          <p className="text-xs text-muted-foreground">Level {level}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
