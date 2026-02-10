import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const AuthVerify = () => {
  const { t } = useTranslation();
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Auto-check verification status and redirect when verified
  useEffect(() => {
    if (!user || loading) return;

    const checkAndRedirect = async () => {
      // OAuth users are always verified
      if (user.app_metadata?.provider && user.app_metadata.provider !== 'email') {
        await redirectToAppOrOnboarding();
        return;
      }
      
      // Check if email is confirmed
      if (user.email_confirmed_at) {
        await redirectToAppOrOnboarding();
      }
    };

    checkAndRedirect();

    // Poll for verification status every 3 seconds
    const pollInterval = setInterval(async () => {
      try {
        const { data: { user: refreshedUser } } = await supabase.auth.getUser();
        if (refreshedUser?.email_confirmed_at) {
          clearInterval(pollInterval);
          toast({
            title: t('authVerify.emailVerified'),
            description: t('authVerify.redirecting')
          });
          await redirectToAppOrOnboarding();
        }
      } catch (error) {
        console.error('Error polling verification status:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [user, loading]);

  const redirectToAppOrOnboarding = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate('/signin', { replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', currentUser.id)
        .single();
      
      if (profile?.onboarding_completed) {
        navigate('/app', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    } catch {
      navigate('/onboarding', { replace: true });
    }
  };

  // Redirect to sign in if no user
  if (!loading && !user) {
    navigate('/signin', { replace: true });
    return null;
  }

  const handleResendVerification = async () => {
    if (!user?.email) return;
    
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`
        }
      });

      if (error) {
        toast({
          title: t('common.error'),
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: t('authVerify.emailSentSuccess'),
          description: t('authVerify.newLinkSent')
        });
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('errors.somethingWrong'),
        variant: "destructive"
      });
    } finally {
      setResending(false);
    }
  };

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    try {
      // Refresh the session to get updated user data
      const { data: { user: refreshedUser }, error } = await supabase.auth.getUser();
      
      if (error) {
        toast({
          title: t('common.error'),
          description: t('authVerify.errorStatus'),
          variant: "destructive"
        });
        return;
      }

      if (refreshedUser?.email_confirmed_at) {
        toast({
          title: t('authVerify.emailVerified'),
          description: t('authVerify.redirecting')
        });
        
        // Check profile and redirect
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', refreshedUser.id)
          .single();
        
        if (profile?.onboarding_completed) {
          navigate('/app', { replace: true });
        } else {
          navigate('/onboarding', { replace: true });
        }
      } else {
        toast({
          title: t('authVerify.notYetVerified'),
          description: t('authVerify.checkEmailClick')
        });
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: t('authVerify.errorStatus'),
        variant: "destructive"
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="animate-pulse text-center">
          <div className="heart-logo mx-auto mb-4">
            <span className="logo-text">Ò</span>
          </div>
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('authVerify.title')}</CardTitle>
          <CardDescription>
            {t('authVerify.sentTo')} <strong>{user?.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground mb-1">{t('authVerify.checkInbox')}</p>
                <p>{t('authVerify.instructions')}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>{t('authVerify.waitingVerification')}</span>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleCheckStatus} 
              className="w-full"
              disabled={checkingStatus}
            >
              {checkingStatus ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t('authVerify.checking')}
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('authVerify.iveVerified')}
                </>
              )}
            </Button>

            <Button 
              variant="outline" 
              onClick={handleResendVerification}
              className="w-full"
              disabled={resending}
            >
              {resending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t('authVerify.sending')}
                </>
              ) : (
                t('authVerify.resendEmail')
              )}
            </Button>

            <Button 
              variant="ghost" 
              onClick={handleSignOut}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('authVerify.signOutDifferent')}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            {t('authVerify.spamNote')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthVerify;