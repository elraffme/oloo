import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Flame, Coins, Trophy, Clock, MapPin, Zap, ArrowLeft } from 'lucide-react';
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
  const [timer, setTimer] = useState(5);
  const [animate, setAnimate] = useState<'yes' | 'skip' | null>(null);
  const [showReward, setShowReward] = useState<{
    coins: number;
    streak?: boolean;
    milestone?: boolean;
  } | null>(null);

  useEffect(() => {
    if (user) {
      loadProfiles();
      loadStats();
    }
  }, [user]);

  // Timer countdown
  useEffect(() => {
    if (profiles.length === 0 || responding) return;

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          // Auto-skip when timer runs out
          handleResponse('skip', true);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, profiles, responding]);

  const loadProfiles = async () => {
    try {
      setLoading(true);

      // Get profiles user hasn't interacted with yet
      const { data: interactedIds } = await supabase
        .from('meet_me_interactions')
        .select('target_user_id')
        .eq('user_id', user?.id);

      const excludeIds = interactedIds?.map(i => i.target_user_id) || [];

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('user_id', user?.id || '')
        .not('user_id', 'in', `(${excludeIds.join(',')})`)
        .limit(20);

      if (error) throw error;
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
    if (responding || profiles.length === 0) return;

    const currentProfile = profiles[currentIndex];
    setResponding(true);
    setAnimate(response);
    setTimer(5); // Reset timer

    try {
      // Record interaction
      const { error: interactionError } = await supabase
        .from('meet_me_interactions')
        .insert({
          user_id: user?.id,
          target_user_id: currentProfile.user_id,
          response,
        });

      if (interactionError) throw interactionError;

      // Update stats and get rewards
      const { data: statsData, error: statsError } = await supabase
        .rpc('update_meet_me_stats', {
          p_user_id: user?.id,
          p_response: response,
        });

      if (statsError) throw statsError;

      // Check for mutual match
      if (response === 'yes') {
        const { data: isMatch } = await supabase
          .rpc('check_meet_me_match', {
            p_user_id: user?.id,
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

      if (!autoSkip) {
        toast(response === 'yes' ? '👍 Liked!' : '⏭️ Skipped', {
          duration: 1000,
        });
      }

      // Move to next profile
      setTimeout(() => {
        setAnimate(null);
        setCurrentIndex(prev => prev + 1);
        setResponding(false);
      }, 500);
    } catch (error) {
      console.error('Error handling response:', error);
      toast.error('Something went wrong');
      setResponding(false);
      setAnimate(null);
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
            <span className="text-sm font-medium flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {timer}s
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
              
              {/* Timer circle */}
              <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <span className="text-white font-bold text-lg">{timer}</span>
              </div>

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
        <div className="flex gap-4 mt-6">
          <Button
            size="lg"
            variant="outline"
            className="flex-1 h-16 text-lg gap-2 border-2 hover:border-red-500 hover:bg-red-500/10 hover:text-red-500"
            onClick={() => handleResponse('skip')}
            disabled={responding}
          >
            <span className="text-2xl">⏭️</span>
            Skip
          </Button>
          
          <Button
            size="lg"
            className="flex-1 h-16 text-lg gap-2 bg-primary hover:bg-primary/90"
            onClick={() => handleResponse('yes')}
            disabled={responding}
          >
            <span className="text-2xl">👍</span>
            Yes!
          </Button>
        </div>

        {/* Tips */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Quick Tips</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Say Yes to 10 profiles = 5 coins! 🪙</li>
                <li>• 5-day streak = 15 coins bonus! 🔥</li>
                <li>• Both say Yes = Instant connection! 💫</li>
              </ul>
            </div>
          </div>
        </div>
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
