import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BadgeDisplayProps {
  icon: string;
  name: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'legendary';
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

const tierColors = {
  bronze: 'bg-amber-700 border-amber-600',
  silver: 'bg-slate-400 border-slate-300',
  gold: 'bg-amber-500 border-amber-400',
  platinum: 'bg-purple-500 border-purple-400',
  legendary: 'bg-gradient-to-br from-amber-500 via-purple-500 to-pink-500 border-amber-400',
};

const tierGlow = {
  bronze: 'shadow-amber-700/50',
  silver: 'shadow-slate-400/50',
  gold: 'shadow-amber-500/50',
  platinum: 'shadow-purple-500/50',
  legendary: 'shadow-amber-500/70',
};

const sizeClasses = {
  sm: 'w-8 h-8 text-lg',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
};

export function BadgeDisplay({ icon, name, tier, size = 'md', showName = false }: BadgeDisplayProps) {
  const badge = (
    <div
      className={`
        ${sizeClasses[size]} 
        ${tierColors[tier]} 
        ${tierGlow[tier]}
        rounded-full flex items-center justify-center 
        border-2 shadow-lg 
        hover:scale-110 transition-transform cursor-pointer
        relative
      `}
    >
      <span className="drop-shadow-sm">{icon}</span>
      
      {/* Sparkle effect for legendary */}
      {tier === 'legendary' && (
        <div className="absolute inset-0 rounded-full animate-pulse bg-white/20"></div>
      )}
    </div>
  );

  if (showName) {
    return (
      <div className="flex flex-col items-center gap-1">
        {badge}
        <span className="text-xs font-medium text-center">{name}</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">{name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
