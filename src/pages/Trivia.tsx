import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Brain, Coins, Flame, Trophy, ArrowLeft, CheckCircle2, XCircle, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { useAchievements } from '@/hooks/useAchievements';
import { useCurrency } from '@/hooks/useCurrency';
import CoinRewardAnimation from '@/components/CoinRewardAnimation';

interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  category: string;
  difficulty: string;
  coin_reward: number;
}

interface QuizState {
  success: boolean;
  error?: string;
  questions: TriviaQuestion[];
  total_questions: number;
  answered_count: number;
  correct_count: number;
  pending_coins: number;
  completed: boolean;
  collected: boolean;
  collected_coins: number;
  daily_limit: number;
}

interface AnswerResult {
  success: boolean;
  error?: string;
  is_correct: boolean;
  correct_answer: string;
  coins_earned: number;
  pending_coins: number;
  answered_count: number;
  correct_count: number;
  total_questions: number;
  completed: boolean;
  current_streak: number;
  daily_limit: number;
  daily_limit_reached: boolean;
  xp_result?: { xp_awarded: number };
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
  const { refreshBalance } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [stats, setStats] = useState<TriviaStats | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [showCoinAnimation, setShowCoinAnimation] = useState(false);
  const [coinsToAnimate, setCoinsToAnimate] = useState(0);

  const loadQuiz = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      const { data, error } = await (supabase.rpc as any)('get_daily_trivia_quiz', {
        p_user_id: user.id,
      });
      if (error) throw error;

      const quizData = data as QuizState;
      if (!quizData?.success) {
        setQuiz(null);
        if (quizData?.error) toast.error(quizData.error);
      } else {
        setQuiz(quizData);
        setStartTime(Date.now());
      }

      const { data: statsData, error: statsError } = await supabase
        .from('trivia_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        console.error('Stats error:', statsError);
      } else if (statsData) {
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading trivia:', error);
      toast.error('Failed to load trivia quiz');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) loadQuiz();
  }, [user, loadQuiz]);

  // While showing feedback, keep the question the user just answered on screen
  const currentQuestion = quiz
    ? quiz.questions[result ? Math.max(quiz.answered_count - 1, 0) : quiz.answered_count]
    : null;

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion || !user) return;

    try {
      setSubmitting(true);
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);

      const { data, error } = await supabase.rpc('submit_trivia_answer', {
        p_user_id: user.id,
        p_question_id: currentQuestion.id,
        p_user_answer: selectedAnswer,
        p_time_taken_seconds: timeTaken,
      });

      if (error) throw error;

      const typed = data as unknown as AnswerResult;

      if (!typed?.success) {
        toast.error(typed?.error || 'Failed to submit answer');
        await loadQuiz();
        return;
      }

      setResult(typed);
      setQuiz((prev) =>
        prev
          ? {
              ...prev,
              answered_count: typed.answered_count,
              correct_count: typed.correct_count,
              pending_coins: typed.pending_coins,
              completed: typed.completed,
            }
          : prev,
      );

      if (typed.is_correct) {
        const xpAwarded = typed.xp_result?.xp_awarded || 0;
        if (typed.coins_earned > 0) {
          setCoinsToAnimate(typed.coins_earned);
          setShowCoinAnimation(true);
          toast.success(`Correct! +${typed.coins_earned} pending points & +${xpAwarded} XP! 🎉`, {
            description: 'Collect your points after the 5th question.',
            duration: 4000,
          });
        } else {
          toast.success(`Correct! +${xpAwarded} XP 🎉`, {
            description: "You've reached today's trivia points limit.",
            duration: 4000,
          });
        }
        checkAchievements();
      } else {
        toast.error('Incorrect answer', {
          description: `The correct answer is: ${typed.correct_answer}`,
        });
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast.error('Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    setResult(null);
    setSelectedAnswer(null);
    setStartTime(Date.now());
  };

  const handleCollect = async () => {
    if (!user?.id || collecting) return;
    try {
      setCollecting(true);
      const { data, error } = await (supabase.rpc as any)('collect_trivia_rewards', {
        p_user_id: user.id,
      });
      if (error) throw error;

      const res = data as { success: boolean; error?: string; coins_collected?: number };

      if (!res?.success) {
        toast.error(res?.error || 'Could not collect rewards');
      } else {
        const amount = res.coins_collected ?? 0;
        if (amount > 0) {
          setCoinsToAnimate(amount);
          setShowCoinAnimation(true);
        }
        toast.success(`Collected ${amount} Òloo Points! 🎉`);
        await refreshBalance();
      }
      await loadQuiz();
    } catch (error) {
      console.error('Error collecting rewards:', error);
      toast.error('Failed to collect rewards');
    } finally {
      setCollecting(false);
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

  if (loading && !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const total = quiz?.total_questions || 0;
  const answered = quiz?.answered_count || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-2 text-foreground border-foreground/20 bg-background hover:bg-accent hover:text-foreground hover:border-foreground/40 active:bg-muted active:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/trivia/leaderboard')}
            className="gap-2 text-foreground border-foreground/20 bg-background hover:bg-accent hover:text-foreground hover:border-foreground/40 active:bg-muted active:text-foreground"
          >
            <Trophy className="h-4 w-4" />
            Leaderboard
          </Button>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3 text-foreground">
            <Brain className="h-10 w-10 text-primary" />
            Daily African Trivia
          </h1>
          <p className="text-foreground/90 font-medium">
            Test your knowledge and earn coins!
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-bold text-green-500">{stats.total_questions_answered}</div>
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
                <div className="text-2xl font-bold flex items-center justify-center gap-1">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <span className="text-green-500">{stats.current_streak}</span>
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

        {/* Coin animation */}
        {showCoinAnimation && coinsToAnimate > 0 && (
          <CoinRewardAnimation coinsEarned={coinsToAnimate} onComplete={handleCoinAnimationComplete} />
        )}

        {/* Quiz progress */}
        {quiz && !quiz.completed && total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium text-foreground">
              <span>Question {Math.min(answered + 1, total)} of {total}</span>
              <span className="flex items-center gap-1 text-yellow-600">
                <Coins className="h-4 w-4" />
                {quiz.pending_coins} pending
              </span>
            </div>
            <Progress value={(answered / total) * 100} />
          </div>
        )}

        {/* Completed quiz — results */}
        {quiz?.completed && !result ? (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-xl text-center text-card-foreground">
                Today's Quiz Complete 🎉
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border-2 p-4">
                  <div className="text-2xl font-bold text-foreground">{quiz.total_questions}</div>
                  <div className="text-xs text-muted-foreground mt-1">Questions answered</div>
                </div>
                <div className="rounded-xl border-2 p-4">
                  <div className="text-2xl font-bold text-green-500">{quiz.correct_count}</div>
                  <div className="text-xs text-muted-foreground mt-1">Correct answers</div>
                </div>
                <div className="rounded-xl border-2 p-4">
                  <div className="text-2xl font-bold text-yellow-500 flex items-center justify-center gap-1">
                    <Coins className="h-5 w-5" />
                    {quiz.collected ? quiz.collected_coins : quiz.pending_coins}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {quiz.collected ? 'Points collected' : 'Points to collect'}
                  </div>
                </div>
              </div>

              {quiz.collected ? (
                <div className="text-center p-4 bg-muted rounded-lg space-y-1">
                  <p className="font-medium text-foreground">
                    You've already collected today's rewards ✅
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Come back tomorrow for 5 new questions!
                  </p>
                </div>
              ) : (
                <>
                  <Button onClick={handleCollect} disabled={collecting} className="w-full gap-2" size="lg">
                    {collecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Collecting...
                      </>
                    ) : (
                      <>
                        <Gift className="h-5 w-5" />
                        Collect {quiz.pending_coins} Òloo Points
                      </>
                    )}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Maximum {quiz.daily_limit} Òloo Points per day. Your quiz resets tomorrow.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : currentQuestion ? (
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge className={categoryColors[currentQuestion.category] || 'bg-primary'}>
                  {categoryIcons[currentQuestion.category]} {currentQuestion.category.toUpperCase()}
                </Badge>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{currentQuestion.difficulty}</Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Coins className="h-3 w-3" />
                    {currentQuestion.coin_reward}
                  </Badge>
                </div>
              </div>
              <CardTitle className="text-xl mt-4">{currentQuestion.question}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  const showResult = !!result;
                  const isCorrect = showResult && option === result!.correct_answer;
                  const isWrong = showResult && isSelected && !result!.is_correct;

                  return (
                    <button
                      key={index}
                      onClick={() => !result && setSelectedAnswer(option)}
                      disabled={!!result || submitting}
                      className={`
                        w-full p-4 rounded-lg border-2 text-left transition-all
                        ${!result && 'hover:border-primary hover:bg-accent'}
                        ${isSelected && !result && 'border-primary bg-accent'}
                        ${isCorrect && 'border-green-500 bg-green-500/10'}
                        ${isWrong && 'border-destructive bg-destructive/10'}
                        ${showResult && !isCorrect && !isWrong && 'opacity-50'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{option}</span>
                        {showResult && isCorrect && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                        {showResult && isWrong && <XCircle className="h-5 w-5 text-destructive" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {!result ? (
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={!selectedAnswer || submitting}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Answer'
                  )}
                </Button>
              ) : (
                <Button onClick={handleNextQuestion} className="w-full" size="lg">
                  {quiz?.completed ? 'See Results' : 'Next Question'}
                </Button>
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
