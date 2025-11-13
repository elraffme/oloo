import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LevelBadge } from './LevelBadge';
import { TrendingUp, Award } from 'lucide-react';
import { UserLevel } from '@/hooks/useUserLevel';

interface LevelProgressProps {
  level: UserLevel;
  compact?: boolean;
}

export function LevelProgress({ level, compact = false }: LevelProgressProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
        <LevelBadge level={level.current_level} size="md" showTooltip={false} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Level Progress</span>
            <span className="text-xs text-muted-foreground">
              {level.current_xp} / {level.xp_for_next_level} XP
            </span>
          </div>
          <Progress value={level.progress_percentage} className="h-2" />
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Level & XP
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level Badge */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Current Level</p>
            <LevelBadge level={level.current_level} size="lg" />
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground mb-1">Total XP</p>
            <p className="text-2xl font-bold text-primary flex items-center gap-1">
              <Award className="h-5 w-5" />
              {level.total_xp_earned.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progress to Level {level.current_level + 1}</span>
            <span className="text-muted-foreground">
              {level.current_xp} / {level.xp_for_next_level} XP
            </span>
          </div>
          <Progress value={level.progress_percentage} className="h-3" />
          <p className="text-xs text-muted-foreground text-center">
            {Math.ceil(level.xp_for_next_level - level.current_xp)} XP needed for next level
          </p>
        </div>

        {/* XP Sources */}
        <div className="pt-3 border-t space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Ways to earn XP</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-primary">•</span>
              <span>Daily Trivia: 20-50 XP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary">•</span>
              <span>Achievements: 30-100 XP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary">•</span>
              <span>Social Actions: 10 XP</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary">•</span>
              <span>Meet Me: 5-15 XP</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
