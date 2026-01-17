import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const AuthVerify = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // If user is verified, redirect to app or onboarding
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!user) return;
      
      // OAuth users are always verified
      if (user.app_metadata?.provider && user.app_metadata.provider !== 'email') {
        redirectToAppOrOnboarding();
        return;
      }
      
      // Check if email is confirmed
      if (user.email_confirmed_at) {
        redirectToAppOrOnboarding();
      }
    };

    const redirectToAppOrOnboarding = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', user!.id)
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

    if (!loading && user) {
      checkVerificationStatus();
    }
  }, [user, loading, navigate]);

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
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Email Sent!",
          description: "A new verification link has been sent to your email."
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend verification email",
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
          title: "Error",
          description: "Could not check verification status",
          variant: "destructive"
        });
        return;
      }

      if (refreshedUser?.email_confirmed_at) {
        toast({
          title: "Email Verified!",
          description: "Redirecting you now..."
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
          title: "Not Yet Verified",
          description: "Please check your email and click the verification link."
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Could not check verification status",
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
          <p className="text-muted-foreground">Loading...</p>
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
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification link to <strong>{user?.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground mb-1">Check your inbox</p>
                <p>Click the verification link in the email we sent you to activate your account.</p>
              </div>
            </div>
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
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  I've Verified My Email
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
                  Sending...
                </>
              ) : (
                "Resend Verification Email"
              )}
            </Button>

            <Button 
              variant="ghost" 
              onClick={handleSignOut}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Sign Out & Try Different Email
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Didn't receive the email? Check your spam folder or request a new one.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthVerify;
