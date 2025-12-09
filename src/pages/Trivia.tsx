import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Brain, Coins, Flame, Trophy, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAchievements } from '@/hooks/useAchievements';
import { useUserLevel } from '@/hooks/useUserLevel';
import CoinRewardAnimation from '@/components/CoinRewardAnimation';

interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  category: string;
  difficulty: string;
  coin_reward: number;
  already_answered: boolean;
}

interface TriviaResult {
  success: boolean;
  is_correct: boolean;
  correct_answer: string;
  coins_earned: number;
  current_streak: number;
  error?: string;
  xp_result?: {
    xp_awarded: number;
    old_level: number;
    new_level: number;
    level_up: boolean;
  };
}

interface TriviaStats {
  total_questions_answered: number;
  correct_answers: number;
  total_coins_earned: number;
  current_streak: number;
  longest_streak: number;
}

const categoryColors: Record<string, string> = {
  music: 'bg-purple-500',
  food: 'bg-orange-500',
  history: 'bg-blue-500',
  culture: 'bg-green-500',
  language: 'bg-pink-500',
};

const categoryIcons: Record<string, string> = {
  music: '🎵',
  food: '🍲',
  history: '📚',
  culture: '🎭',
  language: '💬',
};

export default function Trivia() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { checkAchievements } = useAchievements();
  const { level: userLevel } = useUserLevel();
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<TriviaResult | null>(null);
  const [stats, setStats] = useState<TriviaStats | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [showCoinAnimation, setShowCoinAnimation] = useState(false);
  const [coinsToAnimate, setCoinsToAnimate] = useState(0);

  useEffect(() => {
    if (user) {
      loadTriviaData();
    }
  }, [user]);

  const loadTriviaData = async () => {
    try {
      setLoading(true);
      
      // Load daily question
      const { data: questionData, error: questionError } = await supabase
        .rpc('get_daily_trivia_question', { p_user_id: user?.id });

      if (questionError) throw questionError;

      if (questionData && questionData.length > 0) {
        const rawQuestion = questionData[0];
        const parsedQuestion: TriviaQuestion = {
          ...rawQuestion,
          options: typeof rawQuestion.options === 'string' 
            ? JSON.parse(rawQuestion.options) 
            : rawQuestion.options,
        };
        setQuestion(parsedQuestion);
        setSubmitted(parsedQuestion.already_answered);
        setStartTime(Date.now());
      }

      // Load user stats
      const { data: statsData, error: statsError } = await supabase
        .from('trivia_stats')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        console.error('Stats error:', statsError);
      } else if (statsData) {
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading trivia:', error);
      toast.error('Failed to load trivia question');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !question || !user) return;

    try {
      setLoading(true);
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);

      const { data, error } = await supabase.rpc('submit_trivia_answer', {
        p_user_id: user.id,
        p_question_id: question.id,
        p_user_answer: selectedAnswer,
        p_time_taken_seconds: timeTaken,
      });

      if (error) throw error;

      // Type guard for result
      const typedResult = data as unknown as TriviaResult;
      setResult(typedResult);
      setSubmitted(true);

      if (typedResult.is_correct) {
        const xpResult = typedResult.xp_result as any;
        const xpAwarded = xpResult?.xp_awarded || 0;
        
        // Trigger coin animation
        setCoinsToAnimate(typedResult.coins_earned);
        setShowCoinAnimation(true);
        
        toast.success(`Correct! +${typedResult.coins_earned} coins & +${xpAwarded} XP! 🎉`, {
          description: typedResult.current_streak > 1 ? `${typedResult.current_streak} day streak! 🔥` : undefined,
          duration: 5000,
        });
        checkAchievements();
      } else {
        toast.error('Incorrect answer', {
          description: `The correct answer is: ${typedResult.correct_answer}`,
        });
      }

      // Reload stats
      await loadTriviaData();
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast.error('Failed to submit answer');
    } finally {
      setLoading(false);
    }
  };

  const getAccuracy = () => {
    if (!stats || stats.total_questions_answered === 0) return 0;
    return Math.round((stats.correct_answers / stats.total_questions_answered) * 100);
  };

  const handleCoinAnimationComplete = useCallback(() => {
    setShowCoinAnimation(false);
    setCoinsToAnimate(0);
  }, []);

  if (loading && !question) {
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
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/trivia/leaderboard')}
            className="gap-2"
          >
            <Trophy className="h-4 w-4" />
            Leaderboard
          </Button>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <Brain className="h-10 w-10 text-primary" />
            Daily African Trivia
          </h1>
          <p className="text-muted-foreground">
            Test your knowledge and earn coins!
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-primary">{stats.total_questions_answered}</div>
                <div className="text-xs text-muted-foreground mt-1">Questions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-green-500">{getAccuracy()}%</div>
                <div className="text-xs text-muted-foreground mt-1">Accuracy</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">
                  <Flame className="h-5 w-5" />
                  {stats.current_streak}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Day Streak</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-yellow-500 flex items-center justify-center gap-1">
                  <Coins className="h-5 w-5" />
                  {stats.total_coins_earned}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Coins Earned</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Question Card */}
        {question ? (
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge className={categoryColors[question.category] || 'bg-primary'}>
                  {categoryIcons[question.category]} {question.category.toUpperCase()}
                </Badge>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{question.difficulty}</Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Coins className="h-3 w-3" />
                    {question.coin_reward}
                  </Badge>
                </div>
              </div>
              <CardTitle className="text-xl mt-4">{question.question}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Coin Reward Animation */}
              {showCoinAnimation && coinsToAnimate > 0 && (
                <CoinRewardAnimation 
                  coinsEarned={coinsToAnimate} 
                  onComplete={handleCoinAnimationComplete} 
                />
              )}
              {/* Options */}
              <div className="space-y-3">
                {question.options.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  const showResult = submitted && result;
                  const isCorrect = showResult && option === result.correct_answer;
                  const isWrong = showResult && isSelected && !result.is_correct;

                  return (
                    <button
                      key={index}
                      onClick={() => !submitted && setSelectedAnswer(option)}
                      disabled={submitted}
                      className={`
                        w-full p-4 rounded-lg border-2 text-left transition-all
                        ${!submitted && 'hover:border-primary hover:bg-accent'}
                        ${isSelected && !submitted && 'border-primary bg-accent'}
                        ${isCorrect && 'border-green-500 bg-green-500/10'}
                        ${isWrong && 'border-destructive bg-destructive/10'}
                        ${submitted && !isCorrect && !isWrong && 'opacity-50'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{option}</span>
                        {showResult && isCorrect && (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        {showResult && isWrong && (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Submit Button */}
              {!submitted && (
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={!selectedAnswer || loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Answer'
                  )}
                </Button>
              )}

              {/* Result Message */}
              {submitted && question.already_answered && !result && (
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-muted-foreground">
                    You've already answered today's question. Come back tomorrow for a new one! 🎉
                  </p>
                </div>
              )}

              {/* Come Back Tomorrow */}
              {submitted && result && (
                <div className="text-center p-4 bg-muted rounded-lg space-y-2">
                  <p className="font-medium">
                    {result.is_correct ? '🎉 Great job!' : '📚 Keep learning!'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Come back tomorrow for a new question!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No trivia question available right now. Check back soon!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
