import { useEffect, useState } from 'react';
import { useDailyLoginRewards } from '@/hooks/useDailyLoginRewards';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Gift, Flame, Trophy, Calendar, Coins, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export const DailyLoginRewards = () => {
  const { streakInfo, loading, claiming, claimDailyReward } = useDailyLoginRewards();
  const [showModal, setShowModal] = useState(false);
  const [showClaimAnimation, setShowClaimAnimation] = useState(false);

  useEffect(() => {
    // Auto-show modal if user hasn't claimed today
    if (streakInfo && !streakInfo.claimed_today && !loading) {
      const timer = setTimeout(() => {
        setShowModal(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [streakInfo, loading]);

  const handleClaim = async () => {
    const result = await claimDailyReward();
    if (result.success) {
      setShowClaimAnimation(true);
      setTimeout(() => {
        setShowClaimAnimation(false);
        setShowModal(false);
      }, 2000);
    }
  };

  const calculateRewards = (day: number) => {
    const coins = 10 + Math.min(day - 1, 6) * 5;
    const xp = 50 + Math.min(day - 1, 6) * 10;
    return { coins, xp };
  };

  const getMilestone = (day: number) => {
    if (day % 30 === 0) return { type: 'monthly', bonus: '+200 coins, +500 XP' };
    if (day % 7 === 0) return { type: 'weekly', bonus: '+50 coins, +100 XP' };
    return null;
  };

  if (loading) {
    return null;
  }

  if (!streakInfo) {
    return null;
  }

  const currentStreak = streakInfo.current_streak;
  const dayInMonth = streakInfo.day_in_month;
  
  // Prefer server-calculated values, fallback to client calculation
  const coins = streakInfo.coins_today ?? calculateRewards(currentStreak + 1).coins;
  const xp = streakInfo.xp_today ?? calculateRewards(currentStreak + 1).xp;
  const isMilestone = streakInfo.is_milestone_today ?? (getMilestone(currentStreak + 1) !== null);
  const milestoneType = streakInfo.milestone_type_today ?? getMilestone(currentStreak + 1)?.type;

  return (
    <>
      {/* Compact Streak Display */}
      {!streakInfo.claimed_today && (
        <Button
          onClick={() => setShowModal(true)}
          variant="outline"
          className="gap-2 border-primary/50 bg-primary/5 hover:bg-primary/10"
        >
          <Gift className="h-4 w-4 text-primary" />
          <span className="font-semibold">Daily Reward</span>
          {currentStreak > 0 && (
            <>
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-orange-500 font-bold">{currentStreak}</span>
            </>
          )}
        </Button>
      )}

      {/* Reward Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Gift className="h-6 w-6 text-primary" />
              Daily Login Reward
            </DialogTitle>
          </DialogHeader>

          {showClaimAnimation ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4 animate-in zoom-in">
              <Trophy className="h-24 w-24 text-yellow-500 animate-bounce" />
              <h3 className="text-2xl font-bold text-center">Reward Claimed!</h3>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Current Streak */}
              <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-orange-500/20">
                      <Flame className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Streak</p>
                      <p className="text-3xl font-bold">{currentStreak} Days</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Today's Reward */}
              <Card className="p-4 bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Today's Reward</h3>
                    {isMilestone && (
                      <span className="ml-auto px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500 text-xs font-bold">
                        {milestoneType?.toUpperCase()} MILESTONE!
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Coins className="h-5 w-5 text-yellow-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Coins</p>
                        <p className="text-xl font-bold text-yellow-500">+{coins}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">XP</p>
                        <p className="text-xl font-bold text-blue-500">+{xp}</p>
                      </div>
                    </div>
                  </div>
                  {isMilestone && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-sm text-center text-yellow-500 font-semibold">
                        🎉 {milestoneType === 'monthly' ? 'Monthly Bonus!' : 'Weekly Bonus!'}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Monthly Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Cycle Progress</span>
                  <span className="font-semibold">{dayInMonth}/30 days</span>
                </div>
                <Progress value={(dayInMonth / 30) * 100} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Day 7: Weekly Bonus</span>
                  <span>Day 30: Monthly Bonus</span>
                </div>
              </div>

              {/* Upcoming Milestones */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Upcoming Milestones</p>
                <div className="space-y-1 text-sm">
                  {currentStreak + 1 < 7 && (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span>Day 7: Weekly Bonus (+50 coins, +100 XP)</span>
                    </div>
                  )}
                  {dayInMonth < 30 && (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                      <span>Day 30: Monthly Bonus (+200 coins, +500 XP)</span>
                    </div>
                  )}
                  {currentStreak + 1 < 100 && (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      <span>Day 100: Century Bonus (+1000 coins, +2000 XP)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Claim Button */}
              <Button
                onClick={handleClaim}
                disabled={claiming || streakInfo.claimed_today}
                className="w-full h-12 text-lg font-bold"
                size="lg"
              >
                {claiming ? (
                  'Claiming...'
                ) : streakInfo.claimed_today ? (
                  '✓ Claimed Today'
                ) : (
                  <>
                    <Gift className="mr-2 h-5 w-5" />
                    Claim Reward
                  </>
                )}
              </Button>

              {streakInfo.claimed_today && (
                <p className="text-center text-sm text-muted-foreground">
                  Come back tomorrow for your next reward!
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
