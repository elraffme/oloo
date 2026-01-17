import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithTwitter: () => Promise<{ error: any }>;
  signInWithFacebook: () => Promise<{ error: any }>;
  signInWithLinkedIn: () => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  updateProfile: (data: any) => Promise<{ error: any }>;
  requestPasswordReset: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Helper function to clear all pending onboarding/verification states
const clearPendingStates = () => {
  localStorage.removeItem('pendingOnboardingData');
  localStorage.removeItem('onboardingData');
  localStorage.removeItem('pendingBiometricConsent');
  localStorage.removeItem('pendingVerification');
  localStorage.removeItem('onboardingStep');
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Handle OAuth redirect - check profile onboarding_completed status
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(async () => {
            try {
              // Check if this is an OAuth user (automatically verified) or email user
              const isOAuthUser = session.user.app_metadata?.provider && 
                                  session.user.app_metadata.provider !== 'email';
              
              // For email sign-ups, check if email is verified
              if (!isOAuthUser && !session.user.email_confirmed_at) {
                const currentPath = window.location.pathname;
                const authPages = ['/signin', '/auth', '/'];
                
                if (authPages.includes(currentPath)) {
                  // Redirect unverified email users to verify page
                  window.location.href = '/auth/verify';
                }
                return;
              }
              
              const { data: profile } = await supabase
                .from('profiles')
                .select('onboarding_completed')
                .eq('user_id', session.user.id)
                .single();
              
              // Check for pending onboarding data (from email verification flow)
              const pendingOnboardingData = localStorage.getItem('pendingOnboardingData');
              
              if (pendingOnboardingData) {
                try {
                  const onboardingData = JSON.parse(pendingOnboardingData);
                  await supabase.from('profiles').update({
                    display_name: onboardingData.displayName || '',
                    age: onboardingData.age || 0,
                    bio: onboardingData.bio || 'Hello, I\'m new to Òloo!',
                    height_cm: onboardingData.height || null,
                    gender: onboardingData.gender || null,
                    interests: onboardingData.interests || [],
                    relationship_goals: onboardingData.relationshipGoal || null,
                    profile_photos: onboardingData.photos || [],
                    prompt_responses: onboardingData.promptResponses || {}
                  }).eq('user_id', session.user.id);
                } catch (error) {
                  console.error('Error applying pending onboarding data:', error);
                }
              }
              
              // Clear all pending states after processing
              clearPendingStates();
              
              // Only redirect if we're on a page that should handle auth redirects
              const currentPath = window.location.pathname;
              const authPages = ['/signin', '/auth', '/', '/auth/verify'];
              
              if (authPages.includes(currentPath)) {
                if (profile?.onboarding_completed === true) {
                  // Returning user with completed onboarding - go to app
                  window.location.href = '/app';
                } else {
                  // New user or onboarding not completed - go to onboarding
                  window.location.href = '/onboarding';
                }
              }
              
              // Log security event
              await supabase.rpc('log_security_event', {
                p_action: 'login',
                p_resource_type: 'auth',
                p_details: { event, timestamp: new Date().toISOString() }
              });
            } catch (error) {
              console.error('Failed to check profile:', error);
              // If profile check fails, redirect to onboarding as safe default
              const currentPath = window.location.pathname;
              if (['/signin', '/auth', '/'].includes(currentPath)) {
                window.location.href = '/onboarding';
              }
            }
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        const errorMessage = error.message.toLowerCase().includes('invalid') || 
                           error.message.toLowerCase().includes('password') ||
                           error.message.toLowerCase().includes('credentials')
          ? "Wrong password or email. Please check your credentials and try again."
          : error.message;
        
        toast({
          title: "Sign In Error",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "Successfully signed in to Òloo",
        });
      }
      
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, metadata: any = {}) => {
    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: metadata
        }
      });
      
      if (error) {
        toast({
          title: "Sign Up Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome to Òloo!",
          description: "Please check your email to confirm your account",
        });
      }
      
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      // Check for active streams and end them before logout
      if (user) {
        try {
          const { data: activeStreams } = await supabase
            .from('streaming_sessions')
            .select('id')
            .eq('host_user_id', user.id)
            .eq('status', 'live')
            .limit(1);
          
          if (activeStreams && activeStreams.length > 0) {
            const streamId = activeStreams[0].id;
            
            // End the stream
            await supabase
              .from('streaming_sessions')
              .update({
                status: 'archived',
                ended_at: new Date().toISOString(),
                current_viewers: 0
              })
              .eq('id', streamId);
            
            console.log('✓ Active stream ended before logout');
            
            toast({
              title: "Stream Ended",
              description: "Your active stream has been ended",
            });
          }
          
          // Log signout using secure audit function
          await supabase.rpc('log_security_event', {
            p_action: 'logout',
            p_resource_type: 'auth',
            p_details: { timestamp: new Date().toISOString() }
          });
        } catch (error) {
          console.error('Failed to end stream or log security event:', error);
        }
      }
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast({
          title: "Sign Out Error", 
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Signed out",
          description: "See you soon on Òloo!",
        });
      }
      
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: any) => {
    try {
      if (!user) return { error: new Error('No user logged in') };
      
      // Use upsert to create or update profile with proper onConflict
      const { error } = await supabase
        .from('profiles')
        .upsert(
          { 
            user_id: user.id,
            ...data,
            updated_at: new Date().toISOString()
          },
          { 
            onConflict: 'user_id',
            ignoreDuplicates: false 
          }
        );
      
      if (error) {
        console.error('Profile update error:', error);
        toast({
          title: "Update Error",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }
      
      console.log('Profile updated successfully with onboarding_completed:', data.onboarding_completed);
      
      return { error: null };
    } catch (error: any) {
      console.error('Profile update exception:', error);
      toast({
        title: "Update Error",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        const validationError = { message: 'Please enter a valid email address' };
        toast({
          title: "Invalid Email",
          description: validationError.message,
          variant: "destructive",
        });
        return { error: validationError };
      }

      const redirectUrl = `${window.location.origin}/reset-password/confirm`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      
      if (error) {
        // Check for rate limiting
        if (error.message.includes('rate limit')) {
          toast({
            title: "Too Many Requests",
            description: "Please wait a moment before requesting another reset link.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Reset Request Error",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Check Your Email",
          description: "If an account exists with this email, you'll receive a password reset link (valid for 1 hour)",
        });
      }
      
      return { error };
    } catch (error: any) {
      toast({
        title: "Reset Request Error",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (error) {
        toast({
          title: "Password Update Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password Updated",
          description: "Your password has been successfully updated. Redirecting to sign in...",
        });
      }
      
      return { error };
    } catch (error: any) {
      toast({
        title: "Password Update Error",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        }
      });
      
      if (error) {
        toast({
          title: "Google Sign In Error",
          description: error.message,
          variant: "destructive",
        });
      }
      
      return { error };
    } catch (error: any) {
      toast({
        title: "Google Sign In Error",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signInWithTwitter = async () => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'twitter',
        options: {
          redirectTo: redirectUrl,
        }
      });
      
      if (error) {
        toast({
          title: "X Sign In Error",
          description: error.message,
          variant: "destructive",
        });
      }
      
      return { error };
    } catch (error: any) {
      toast({
        title: "X Sign In Error",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signInWithFacebook = async () => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: redirectUrl,
        }
      });
      
      if (error) {
        toast({
          title: "Facebook Sign In Error",
          description: error.message,
          variant: "destructive",
        });
      }
      
      return { error };
    } catch (error: any) {
      toast({
        title: "Facebook Sign In Error",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signInWithLinkedIn = async () => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: redirectUrl,
        }
      });
      
      if (error) {
        toast({
          title: "LinkedIn Sign In Error",
          description: error.message,
          variant: "destructive",
        });
      }
      
      return { error };
    } catch (error: any) {
      toast({
        title: "LinkedIn Sign In Error",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithTwitter,
    signInWithFacebook,
    signInWithLinkedIn,
    signOut,
    updateProfile,
    requestPasswordReset,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};