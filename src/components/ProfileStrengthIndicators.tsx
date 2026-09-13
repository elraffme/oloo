import { Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  calculateProfileIndicators,
  type ProfileIndicatorInput,
} from '@/lib/profileIndicators';

interface ProfileStrengthIndicatorsProps {
  profile: ProfileIndicatorInput;
}

const indicatorColorClass: Record<
  import('@/lib/profileIndicators').ProfileIndicatorKey,
  { text: string; indicator: string }
> = {
  smart: { text: 'text-primary', indicator: 'bg-primary' },
  attractive: { text: 'text-gold', indicator: 'bg-gold' },
  trustworthy: { text: 'text-accent', indicator: 'bg-accent' },
};

export const ProfileStrengthIndicators = ({ profile }: ProfileStrengthIndicatorsProps) => {
  const indicators = calculateProfileIndicators(profile);

  return (
    <div className="space-y-2.5 border-y border-border/70 py-3" aria-label="Profile strengths">
      {indicators.map((indicator) => {
        const available = indicator.score !== null;
        const colors = indicatorColorClass[indicator.key];

        return (
          <div key={indicator.key} className="space-y-1">
            <div className="flex min-w-0 items-center justify-between gap-2 text-[11px] sm:text-xs">
              <span className={cn("flex min-w-0 items-center gap-1 font-semibold", colors.text)}>
                {indicator.label}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex cursor-help text-muted-foreground"
                      aria-label={`How ${indicator.label} is calculated`}
                      tabIndex={0}
                    >
                      <Info className="h-3 w-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-64">
                    {indicator.description}
                  </TooltipContent>
                </Tooltip>
              </span>
              <span className={cn("shrink-0 font-semibold tabular-nums", colors.text)}>
                {available ? `${indicator.score}%` : 'Not enough data'}
              </span>
            </div>
            <Progress
              value={indicator.score ?? 0}
              aria-label={`${indicator.label}: ${available ? `${indicator.score} percent` : 'not enough data'}`}
              aria-valuetext={available ? `${indicator.score} percent` : 'Not enough data'}
              className="h-1.5 bg-muted"
              indicatorClassName={colors.indicator}
            />
          </div>
        );
      })}
    </div>
  );
};