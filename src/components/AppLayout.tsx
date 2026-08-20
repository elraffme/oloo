import { Outlet, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { CurrencyWallet } from '@/components/CurrencyWallet';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { Heart, Video, MessageCircle, User, Settings, LogOut, Search, Zap, Shield, Crown, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { SocialInteractionsNotifier } from '@/components/SocialInteractionsNotifier';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFoundingClaimRedeemer } from '@/hooks/useFoundingClaim';
import { toast } from 'sonner';

const AppLayout = () => {
  const { t } = useTranslation();
  const {
    user,
    signOut,
    loading
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [checkingProfile, setCheckingProfile] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);


  // Check if user has completed onboarding, email verification, and if they're an admin
  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setCheckingProfile(false);
        return;
      }

      // Check email verification for non-OAuth users
      // OAuth users (google, twitter, etc.) are automatically verified
      const isOAuthUser = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
      
      if (!isOAuthUser && !user.email_confirmed_at) {
        // Email not verified — the synchronous guard below performs the redirect.
        setCheckingProfile(false);
        return;
      }

      
      try {
        setProfileError(null);
        const { data: profile, error: loadError } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .maybeSingle();

        if (loadError) {
          // Never bounce to /onboarding on a read failure — that creates a redirect loop.
          console.error('[AppLayout] Failed to load profile:', loadError);
          setProfileError(loadError.message);
          return;
        }

        setHasProfile(profile?.onboarding_completed === true);

        // Check admin status
        const { data: adminStatus } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        setIsAdmin(adminStatus === true);
      } catch (error: any) {
        console.error('[AppLayout] Profile check error:', error);
        setProfileError(error?.message ?? 'Unknown error');
      } finally {
        setCheckingProfile(false);
      }


    };
    
    if (!loading) {
      checkProfile();
    }
  }, [user, loading]);

  // Redeem a pending founding-credit claim once the Main Òloo user exists.
  // Idempotent: the edge function + RPC guarantee a single +500 transaction.
  const redeemFoundingClaim = useFoundingClaimRedeemer();
  useEffect(() => {
    if (!user || loading || checkingProfile || !hasProfile) return;
    let cancelled = false;
    (async () => {
      const result = await redeemFoundingClaim();
      if (cancelled || !result) return;
      if (result.ok && !result.already && result.awarded > 0) {
        toast.success('Founding credits added', {
          description: `${result.awarded} Oloo Points are now in your wallet.`,
        });
        window.dispatchEvent(new Event('oloo:currency-refresh'));
      } else if (!result.ok) {
        console.error('[AppLayout] Founding claim redemption failed:', result.code, result.message);
      }
    })();
    return () => { cancelled = true; };
  }, [user, loading, checkingProfile, hasProfile, redeemFoundingClaim]);

  // Enable global real-time notifications
  useRealtimeNotifications();
  
  // Enable social interaction notifications
  SocialInteractionsNotifier();

  // Redirect to sign in if not logged in
  if (!user && !loading) {
    return <Navigate to="/signin" replace />;
  }

  // CRITICAL: Block unverified email users from accessing /app
  // This is a synchronous check that runs before any content renders
  if (user && !loading) {
    const isOAuthUser = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
    if (!isOAuthUser && !user.email_confirmed_at) {
      return <Navigate to="/auth/verify" replace />;
    }
  }

  // Show loading while checking
  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="animate-pulse text-center">
          <div className="heart-logo mx-auto mb-4">
            <span className="logo-text">Ò</span>
          </div>
          <p className="text-muted-foreground">{t('onboarding.loadingExperience')}</p>
        </div>
      </div>
    );
  }

  // Profile read failed — surface the real error instead of looping back to onboarding
  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="text-center max-w-md space-y-4">
          <p className="text-foreground font-medium">We couldn't load your profile.</p>
          <p className="text-sm text-muted-foreground break-words">{profileError}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  // Redirect to onboarding if profile not complete
  if (!hasProfile) {
    return <Navigate to="/onboarding" replace />;
  }


  const navItems = [
    {
      path: '/app',
      icon: Sparkles,
      label: t('navigation.feed'),
      end: true
    },
    {
      path: '/app/discover',
      icon: Heart,
      label: t('navigation.discover')
    },
    {
      path: '/app/streaming',
      icon: Video,
      label: t('navigation.streaming')
    },
    {
      path: '/app/messages',
      icon: MessageCircle,
      label: t('navigation.messages')
    },
    {
      path: '/app/profile',
      icon: User,
      label: t('navigation.profile')
    },
    ...(isAdmin ? [{
      path: '/app/admin',
      icon: Shield,
      label: t('navigation.admin')
    }] : [])
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
        {/* Top Navigation */}
        <header className="bg-background/95 backdrop-blur-sm border-b border-border/20 sticky top-0 z-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div>
                  <h1 className="text-xl font-bold font-afro-heading text-primary">Òloo</h1>
                  <p className="text-xs text-muted-foreground">Cultured connections</p>
                </div>
              </div>

              {/* Center Navigation - Desktop */}
              <nav className="hidden md:flex items-center space-x-1">
                {navItems.map(item => {
                  const isActive = item.end ? location.pathname === item.path : location.pathname.startsWith(item.path);
                  return (
                    <NavLink key={item.path} to={item.path}>
                      <Button variant="default" size="sm" className="flex items-center space-x-2 bg-primary text-primary-foreground hover:bg-primary/90">
                        <item.icon className="w-4 h-4" fill="currentColor" />
                        <span>{item.label}</span>
                      </Button>
                    </NavLink>
                  );
                })}
              </nav>

              {/* Right Actions */}
              <div className="flex items-center space-x-2">
                {/* Quick Actions */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex">
                      <Search className="w-4 h-4 text-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('navigation.search')}</p>
                  </TooltipContent>
                </Tooltip>
                
                {/* Oloo Points wallet (real balance from currency_balances) */}
                <CurrencyWallet onBuyCoins={() => navigate('/app/shop')} />


                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleSignOut}>
                      <LogOut className="w-4 h-4 text-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('navigation.logOut')}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6 pb-20 md:pb-6">
          <Outlet />
        </main>

        {/* Bottom Navigation - Mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border">
          <div className="grid grid-cols-5 h-16">
        {navItems.map(item => {
              const isActive = item.end ? location.pathname === item.path : location.pathname.startsWith(item.path);
              return (
                <NavLink key={item.path} to={item.path} className="flex flex-col items-center justify-center space-y-1">
                  <item.icon className="w-5 h-5 text-primary" fill="currentColor" />
                  <span className="text-xs text-white font-medium">
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
};

export default AppLayout;
