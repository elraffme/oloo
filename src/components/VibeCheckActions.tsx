import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VIBE_CONFIG, type VibeKey } from '@/lib/vibeCheck';

interface VibeCheckActionsProps {
  currentVibe?: VibeKey | null;
  pending?: VibeKey | null;
  onVibe: (vibe: VibeKey) => void;
  className?: string;
}

export const VibeCheckActions = ({ currentVibe, pending, onVibe, className }: VibeCheckActionsProps) => {
  const ignite = VIBE_CONFIG.ignite;
  const pass = VIBE_CONFIG.pass;
  const isIgnited = currentVibe === 'ignite';
  const isPassed = currentVibe === 'pass';
  const busy = Boolean(pending);

  return (
    <div className={cn('grid grid-cols-2 gap-2', className)} role="group" aria-label="Vibe Check">
      <button
        type="button"
        onClick={() => onVibe('ignite')}
        disabled={busy}
        aria-pressed={isIgnited}
        title={ignite.description}
        className={cn(
          'vibe-flame relative flex min-h-11 items-center justify-center gap-1.5 overflow-hidden rounded-xl border px-2 text-xs font-semibold transition-all duration-300 disabled:opacity-70 sm:text-sm',
          isIgnited
            ? 'vibe-flame-active border-transparent text-white shadow-lg'
            : 'border-[hsl(var(--vibe-flame))]/40 bg-[hsl(var(--vibe-flame))]/10 text-[hsl(var(--vibe-flame))] hover:bg-[hsl(var(--vibe-flame))]/20 hover:shadow-md',
        )}
      >
        {pending === 'ignite' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span className={cn('text-base leading-none sm:text-lg', isIgnited && 'vibe-flame-pulse')} aria-hidden="true">
            {ignite.emoji}
          </span>
        )}
        <span className="truncate">{isIgnited ? 'Vibing' : ignite.label}</span>
      </button>

      <button
        type="button"
        onClick={() => onVibe('pass')}
        disabled={busy}
        aria-pressed={isPassed}
        title={pass.description}
        className={cn(
          'flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition-all duration-300 disabled:opacity-70 sm:text-sm',
          isPassed
            ? 'border-transparent bg-muted-foreground/20 text-foreground'
            : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
        )}
      >
        {pending === 'pass' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span className="text-base leading-none sm:text-lg" aria-hidden="true">{pass.emoji}</span>
        )}
        <span className="truncate">{pass.label}</span>
      </button>
    </div>
  );
};
