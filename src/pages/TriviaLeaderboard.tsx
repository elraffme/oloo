import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Medal, ArrowLeft, Coins, Flame, Target } from 'lucide-react';
import { toast } from 'sonner';

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_coins_earned: number;
  correct_answers: number;
  accuracy_percentage: number;
  current_streak: number;
  longest_streak: number;
  rank: number;
}

export default function TriviaLeaderboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_trivia_leaderboard', {
        p_limit: 100,
      });

      if (error) throw error;

      setLeaderboard(data || []);

      // Find current user's rank
      if (user && data) {
        const userEntry = data.find((entry: LeaderboardEntry) => entry.user_id === user.id);
        if (userEntry) {
          setUserRank(userEntry);
        }
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-semibold text-muted-foreground">#{rank}</span>;
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-500';
    if (rank === 3) return 'bg-gradient-to-r from-amber-400 to-amber-600';
    return 'bg-muted';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/trivia')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trivia
          </Button>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <Trophy className="h-10 w-10 text-yellow-500" />
            Trivia Leaderboard
          </h1>
          <p className="text-muted-foreground">
            Top performers in African trivia
          </p>
        </div>

        {/* User's Rank Card */}
        {userRank && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="text-lg">Your Ranking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                    {getRankIcon(userRank.rank)}
                  </div>
                  <div>
                    <div className="font-semibold">Rank #{userRank.rank}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Coins className="h-3 w-3" />
                      {userRank.total_coins_earned} coins earned
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm font-medium">{userRank.accuracy_percentage}% accuracy</div>
                  <div className="text-xs text-muted-foreground">{userRank.correct_answers} correct</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle>Top Players</CardTitle>
            <CardDescription>Ranked by total coins earned from trivia</CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No players on the leaderboard yet. Be the first!
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.user_id}
                    className={`
                      flex items-center gap-4 p-4 rounded-lg transition-colors
                      ${entry.user_id === user?.id ? 'bg-primary/10 border-2 border-primary' : 'bg-muted/50 hover:bg-muted'}
                    `}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center w-12 h-12">
                      {getRankIcon(entry.rank)}
                    </div>

                    {/* Avatar and Name */}
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={entry.avatar_url || undefined} />
                      <AvatarFallback>
                        {entry.display_name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate flex items-center gap-2">
                        {entry.display_name}
                        {entry.user_id === user?.id && (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {entry.correct_answers} correct
                        </span>
                        <span className="flex items-center gap-1">
                          <Flame className="h-3 w-3" />
                          {entry.current_streak} streak
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right space-y-1">
                      <div className="font-bold text-yellow-500 flex items-center gap-1 justify-end">
                        <Coins className="h-4 w-4" />
                        {entry.total_coins_earned}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.accuracy_percentage}% accuracy
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
