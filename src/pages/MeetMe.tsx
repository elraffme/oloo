import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Flame, Coins, Trophy, MapPin, Zap, ArrowLeft, SkipForward, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  age: number;
  location: string;
  bio: string;
  profile_photos: string[] | null;
  main_profile_photo_index: number;
  avatar_url: string | null;
  verified: boolean;
}

interface MeetMeStats {
  current_streak: number;
  longest_streak: number;
  total_plays: number;
  coins_earned: number;
}

const MeetMe = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [stats, setStats] = useState<MeetMeStats>({
    current_streak: 0,
    longest_streak: 0,
    total_plays: 0,
    coins_earned: 0,
  });
  const [animate, setAnimate] = useState<'yes' | 'skip' | null>(null);
  const [showReward, setShowReward] = useState<{
    coins: number;
    streak?: boolean;
    milestone?: boolean;
  } | null>(null);

  // Guards against overlapping / duplicate submissions
  const respondingRef = useRef(false);

  useEffect(() => {
    if (user) {
      loadProfiles();
      loadStats();
    }
  }, [user]);

  const loadProfiles = async () => {
    try {
      setLoading(true);

      // Get profiles user hasn't interacted with yet
      const { data: interactedIds } = await supabase
        .from('meet_me_interactions')
        .select('target_user_id')
        .eq('user_id', user?.id);

      const excludeIds = (interactedIds?.map(i => i.target_user_id) || []).filter(Boolean);

      let query = supabase
        .from('profiles')
        .select('*')
        .neq('user_id', user?.id || '');

      if (excludeIds.length > 0) {
        query = query.not('user_id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;
      setCurrentIndex(0);
      setProfiles(data || []);

    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('meet_me_stats')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setStats({
          current_streak: data.current_streak || 0,
          longest_streak: data.longest_streak || 0,
          total_plays: data.total_plays || 0,
          coins_earned: data.coins_earned || 0,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleResponse = async (response: 'yes' | 'skip', autoSkip = false) => {
    // Ref guard: reliable against rapid/double clicks
    if (respondingRef.current) return;

    const currentProfile = profiles[currentIndex];
    if (!currentProfile || !user?.id) return;

    respondingRef.current = true;
    setResponding(true);
    setAnimate(response);

    // Advance the UI immediately — never block the next profile on the network
    const advance = window.setTimeout(() => {
      setAnimate(null);
      setCurrentIndex(prev => prev + 1);
      setResponding(false);
      respondingRef.current = false;
    }, 350);

    if (!autoSkip) {
      toast(response === 'yes' ? '👍 Liked!' : '⏭️ Skipped', { duration: 1000 });
    }

    try {
      // Record interaction (duplicates are harmless — the profile is simply already seen)
      const { error: interactionError } = await supabase
        .from('meet_me_interactions')
        .insert({
          user_id: user.id,
          target_user_id: currentProfile.user_id,
          response,
        });

      if (interactionError && interactionError.code !== '23505') {
        throw interactionError;
      }

      // Update stats and get rewards
      const { data: statsData, error: statsError } = await supabase
        .rpc('update_meet_me_stats', {
          p_user_id: user.id,
          p_response: response,
        });

      if (statsError) throw statsError;

      // Check for mutual match
      if (response === 'yes') {
        const { data: isMatch } = await supabase
          .rpc('check_meet_me_match', {
            p_user_id: user.id,
            p_target_user_id: currentProfile.user_id,
          });

        if (isMatch) {
          toast.success(`🎉 It's a vibe! You and ${currentProfile.display_name} both said yes!`, {
            duration: 5000,
          });
        }
      }

      // Update local stats
      if (statsData && typeof statsData === 'object') {
        const result = statsData as {
          current_streak: number;
          total_plays: number;
          coins_awarded: number;
          streak_bonus: boolean;
          milestone_bonus: boolean;
        };

        setStats(prev => ({
          ...prev,
          current_streak: result.current_streak,
          total_plays: result.total_plays,
        }));

        // Show reward animation if coins awarded
        if (result.coins_awarded > 0) {
          setShowReward({
            coins: result.coins_awarded,
            streak: result.streak_bonus,
            milestone: result.milestone_bonus,
          });

          setTimeout(() => setShowReward(null), 3000);
        }
      }
    } catch (error) {
      // The card still advances; only surface a quiet notice
      console.error('Error handling response:', error);
      if (!autoSkip) toast.error('Could not save that response');
    } finally {
      // Safety: if the advance timeout was cleared by unmount, release the guard
      window.clearTimeout(advance);
      setAnimate(null);
      setCurrentIndex(prev => (prev === currentIndex ? prev + 1 : prev));
      setResponding(false);
      respondingRef.current = false;
      
    }
  };



  const getProfilePhoto = (profile: Profile) => {
    if (profile.profile_photos && profile.profile_photos.length > 0) {
      return profile.profile_photos[profile.main_profile_photo_index || 0];
    }
    return profile.avatar_url || '/placeholder.svg';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profiles...</p>
        </div>
      </div>
    );
  }

  if (currentIndex >= profiles.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold">All Done!</h2>
            <p className="text-muted-foreground">
              You've seen all available profiles. Come back later for more!
            </p>
            <div className="space-y-2 pt-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Total Plays
                </span>
                <span className="font-bold">{stats.total_plays}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  Current Streak
                </span>
                <span className="font-bold">{stats.current_streak}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  Coins Earned
                </span>
                <span className="font-bold">{stats.coins_earned}</span>
              </div>
            </div>
            <Button onClick={() => navigate('/app/discover')} className="w-full mt-4">
              Back to Discover
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentProfile = profiles[currentIndex];
  const progress = ((currentIndex + 1) / Math.min(profiles.length, 20)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/app/discover')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-1">
              <Flame className="w-4 h-4 text-orange-500" />
              {stats.current_streak} Streak
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Trophy className="w-4 h-4 text-amber-500" />
              {stats.total_plays} Plays
            </Badge>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Profile {currentIndex + 1} of {Math.min(profiles.length, 20)}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Profile Card */}
        <Card 
          className={`relative overflow-hidden transition-all duration-500 ${
            animate === 'yes' ? 'animate-swipe-right' : 
            animate === 'skip' ? 'animate-swipe-left' : ''
          }`}
        >
          <CardContent className="p-0">
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={getProfilePhoto(currentProfile)}
                alt={currentProfile.display_name}
                className="w-full h-full object-cover"
              />
              
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              

              {/* Profile Info */}
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-3xl font-bold">
                    {currentProfile.display_name}, {currentProfile.age}
                  </h2>
                  {currentProfile.verified && (
                    <Badge className="bg-primary">✓</Badge>
                  )}
                </div>
                
                <p className="flex items-center gap-2 text-sm opacity-90 mb-3">
                  <MapPin className="w-4 h-4" />
                  {currentProfile.location}
                </p>
                
                <p className="text-sm line-clamp-2 opacity-90">
                  {currentProfile.bio}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
          <Button
            variant="outline"
            className="flex-1 h-14 sm:h-16 min-h-14 sm:min-h-16 px-6 py-0 rounded-2xl border-2 border-border bg-card text-foreground text-base sm:text-lg font-semibold gap-2 shadow-sm transition-all duration-200 hover:bg-muted hover:border-foreground/30 hover:text-foreground hover:shadow-md active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70 disabled:cursor-not-allowed box-border"
            onClick={() => handleResponse('skip')}
            disabled={responding}
            aria-busy={responding}
          >
            {responding ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <SkipForward className="w-5 h-5" />
            )}
            Skip
          </Button>

          <Button
            className="flex-1 h-14 sm:h-16 min-h-14 sm:min-h-16 px-6 py-0 rounded-2xl border-2 border-transparent text-base sm:text-lg font-semibold gap-2 shadow-sm transition-all duration-200 bg-primary hover:bg-primary/90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70 disabled:cursor-not-allowed box-border"
            onClick={() => handleResponse('yes')}
            disabled={responding}
            aria-busy={responding}
          >
            {responding ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span className="text-2xl">👍</span>
            )}
            Yes!
          </Button>
        </div>

        {/* Quick Tips */}
        <Card className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <h3 className="font-afro-heading text-base font-semibold tracking-wide text-card-foreground">
                  Quick Tips
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm leading-relaxed text-card-foreground/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Say Yes to 10 profiles = 5 coins! 🪙
                  </li>
                  <li className="flex items-start gap-2 text-sm leading-relaxed text-card-foreground/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    5-day streak = 15 coins bonus! 🔥
                  </li>
                  <li className="flex items-start gap-2 text-sm leading-relaxed text-card-foreground/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Both say Yes = Instant connection! 💫
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reward Notification */}
      {showReward && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="animate-bounce bg-primary text-primary-foreground rounded-full px-8 py-4 shadow-2xl">
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-2xl font-bold">+{showReward.coins} Coins!</p>
              {showReward.streak && (
                <p className="text-sm">Streak Bonus!</p>
              )}
              {showReward.milestone && (
                <p className="text-sm">Milestone Bonus!</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetMe;
