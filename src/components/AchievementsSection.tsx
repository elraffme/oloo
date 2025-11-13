import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { BadgeDisplay } from './BadgeDisplay';
import { Lock, Trophy, Star, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'legendary';
  requirement_value: number;
  coin_reward: number;
}

interface UserAchievement {
  achievement_id: string;
  unlocked_at: string;
  progress: number;
  is_featured: boolean;
  achievement: Achievement;
}

interface AchievementsSectionProps {
  userId: string;
  isOwnProfile: boolean;
}

export function AchievementsSection({ userId, isOwnProfile }: AchievementsSectionProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    loadAchievements();
  }, [userId]);

  const loadAchievements = async () => {
    try {
      setLoading(true);

      // Load all achievements
      const { data: allAchievements, error: achError } = await supabase
        .from('achievements')
        .select('*')
        .order('display_order');

      if (achError) throw achError;

      // Load user's unlocked achievements
      const { data: unlocked, error: unlockedError } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', userId);

      if (unlockedError) throw unlockedError;

      setAchievements(allAchievements as Achievement[] || []);
      setUserAchievements(unlocked as UserAchievement[] || []);
    } catch (error) {
      console.error('Error loading achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAchievements = async () => {
    if (!isOwnProfile) return;

    setChecking(true);
    try {
      const { data, error } = await supabase.rpc('check_and_award_achievements', {
        p_user_id: userId,
      });

      if (error) throw error;

      const result = data as { new_achievements: any[] };
      if (result?.new_achievements?.length > 0) {
        result.new_achievements.forEach((ach: any) => {
          toast.success(`🎉 Achievement Unlocked: ${ach.name}!`, {
            description: ach.coin_reward > 0 ? `+${ach.coin_reward} coins earned!` : undefined,
            duration: 5000,
          });
        });
        loadAchievements();
      } else {
        toast.info('No new achievements yet. Keep going!');
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
      toast.error('Failed to check achievements');
    } finally {
      setChecking(false);
    }
  };

  const toggleFeatured = async (achievementId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('user_achievements')
        .update({ is_featured: !currentState })
        .eq('user_id', userId)
        .eq('achievement_id', achievementId);

      if (error) throw error;
      loadAchievements();
      toast.success(currentState ? 'Badge removed from featured' : 'Badge featured on profile!');
    } catch (error) {
      console.error('Error toggling featured:', error);
      toast.error('Failed to update badge');
    }
  };

  const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));
  const unlockedCount = userAchievements.length;
  const totalCount = achievements.length;
  const completionPercent = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  const categorizeAchievements = (category: string) => {
    return achievements.filter(a => a.category === category);
  };

  const renderAchievement = (achievement: Achievement) => {
    const userAch = userAchievements.find(ua => ua.achievement_id === achievement.id);
    const isUnlocked = unlockedIds.has(achievement.id);

    return (
      <Card
        key={achievement.id}
        className={`relative overflow-hidden ${
          isUnlocked ? 'border-primary' : 'opacity-60 grayscale'
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="relative">
              <BadgeDisplay
                icon={achievement.icon}
                name={achievement.name}
                tier={achievement.tier}
                size="md"
              />
              {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Lock className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold">{achievement.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {achievement.description}
                  </p>
                </div>
                <Badge variant={isUnlocked ? 'default' : 'outline'} className="text-xs shrink-0">
                  {achievement.tier}
                </Badge>
              </div>

              {achievement.coin_reward > 0 && (
                <p className="text-xs text-amber-500 mt-1">
                  🪙 {achievement.coin_reward} coins
                </p>
              )}

              {isUnlocked && userAch && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">
                    Unlocked {new Date(userAch.unlocked_at).toLocaleDateString()}
                  </p>
                  {isOwnProfile && (
                    <Button
                      size="sm"
                      variant={userAch.is_featured ? 'default' : 'outline'}
                      className="text-xs h-7"
                      onClick={() => toggleFeatured(achievement.id, userAch.is_featured)}
                    >
                      <Star className={`w-3 h-3 mr-1 ${userAch.is_featured ? 'fill-current' : ''}`} />
                      {userAch.is_featured ? 'Featured' : 'Feature'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading achievements...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Achievements Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {unlockedCount} / {totalCount} Unlocked
            </span>
            <span className="text-sm font-medium">{Math.round(completionPercent)}%</span>
          </div>
          <Progress value={completionPercent} className="h-3" />

          {isOwnProfile && (
            <Button
              onClick={checkAchievements}
              disabled={checking}
              className="w-full gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {checking ? 'Checking...' : 'Check for New Achievements'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Achievements by Category */}
      <Card>
        <CardHeader>
          <CardTitle>All Achievements</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
              <TabsTrigger value="streaming">Streaming</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
              <TabsTrigger value="special">Special</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3 mt-4">
              {achievements.map(renderAchievement)}
            </TabsContent>

            <TabsContent value="social" className="space-y-3 mt-4">
              {categorizeAchievements('social').map(renderAchievement)}
            </TabsContent>

            <TabsContent value="streaming" className="space-y-3 mt-4">
              {categorizeAchievements('streaming').map(renderAchievement)}
            </TabsContent>

            <TabsContent value="engagement" className="space-y-3 mt-4">
              {categorizeAchievements('engagement').map(renderAchievement)}
            </TabsContent>

            <TabsContent value="special" className="space-y-3 mt-4">
              {categorizeAchievements('special').concat(categorizeAchievements('coins')).map(renderAchievement)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
