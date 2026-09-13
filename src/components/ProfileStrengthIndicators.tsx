import { Info, Sparkles, Heart, ShieldCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  calculateProfileIndicators,
  type ProfileIndicatorInput,
  type ProfileIndicatorKey,
} from '@/lib/profileIndicators';

interface ProfileStrengthIndicatorsProps {
  profile: ProfileIndicatorInput;
}

const indicatorIcon: Record<ProfileIndicatorKey, React.ReactNode> = {
  smart: <Sparkles className="h-3.5 w-3.5" />,
  attractive: <Heart className="h-3.5 w-3.5" />,
  trustworthy: <ShieldCheck className="h-3.5 w-3.5" />,
};

const indicatorColorClass: Record<
  ProfileIndicatorKey,
  { text: string; indicator: string; track: string }
> = {
  smart: {
    text: 'text-indicator-smart',
    indicator: 'bg-indicator-smart',
    track: 'bg-indicator-smart/15',
  },
  attractive: {
    text: 'text-indicator-attractive',
    indicator: 'bg-indicator-attractive',
    track: 'bg-indicator-attractive/15',
  },
  trustworthy: {
    text: 'text-indicator-trustworthy',
    indicator: 'bg-indicator-trustworthy',
    track: 'bg-indicator-trustworthy/15',
  },
};

export const ProfileStrengthIndicators = ({ profile }: ProfileStrengthIndicatorsProps) => {
  const indicators = calculateProfileIndicators(profile);

  return (
    <div className="space-y-1.5 border-y border-border/70 py-2 sm:space-y-3 sm:py-3" aria-label="Profile strengths">
      {indicators.map((indicator) => {
        const available = indicator.score !== null;
        const colors = indicatorColorClass[indicator.key];

        return (
          <div key={indicator.key} className="space-y-1 sm:space-y-1.5">
            <div className="flex min-w-0 items-center justify-between gap-2 text-[10px] sm:text-xs">
              <span className={cn('flex min-w-0 items-center gap-1 font-semibold sm:gap-1.5', colors.text)}>
                {indicatorIcon[indicator.key]}
                <span className="truncate">{indicator.label}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex cursor-help text-muted-foreground"
                      aria-label={`How ${indicator.label} is calculated`}
                      tabIndex={0}
                    >
                      <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-64">
                    {indicator.description}
                  </TooltipContent>
                </Tooltip>
              </span>
              <span className={cn('shrink-0 font-bold tabular-nums', colors.text)}>
                {available ? `${indicator.score}%` : 'Not enough data'}
              </span>
            </div>
            <Progress
              value={indicator.score ?? 0}
              aria-label={`${indicator.label}: ${available ? `${indicator.score} percent` : 'not enough data'}`}
              aria-valuetext={available ? `${indicator.score} percent` : 'Not enough data'}
              className={cn('h-2 rounded-full sm:h-3', colors.track)}
              indicatorClassName={colors.indicator}
            />
          </div>
        );
      })}
    </div>
  );
};
