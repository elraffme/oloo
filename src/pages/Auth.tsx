import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Heart, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { FaceVerification } from '@/components/FaceVerification';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(10, 'Password must be at least 10 characters');
const Auth = () => {
  const {
    t
  } = useTranslation();
  const {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithTwitter,
    signInWithFacebook,
    signInWithLinkedIn
  } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    location: '',
    bio: '',
    acceptTerms: false,
    biometricConsent: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [onboardingData, setOnboardingData] = useState<any>(null);

  // Load onboarding data from localStorage if it exists
  useEffect(() => {
    const storedData = localStorage.getItem('onboardingData');
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        setOnboardingData(data);
        // Pre-fill location from onboarding
        if (data.location) {
          setFormData(prev => ({
            ...prev,
            location: data.location
          }));
        }
      } catch (error) {
        console.error('Error loading onboarding data:', error);
      }
    }
  }, []);

  // Redirect only if user is authenticated - check email verification and profile
  useEffect(() => {
    const checkAndRedirect = async () => {
      if (user && !loading) {
        // For email sign-ups, check if email is verified first
        const isEmailProvider = !user.app_metadata?.provider || user.app_metadata.provider === 'email';
        if (isEmailProvider && !user.email_confirmed_at) {
          // Email not verified - redirect to verification page
          navigate('/auth/verify');
          return;
        }
        try {
          const {
            data
          } = await supabase.from('profiles').select('onboarding_completed').eq('user_id', user.id).single();

          // Redirect to /app if onboarding is complete, otherwise /onboarding
          if (data?.onboarding_completed) {
            navigate('/app');
          } else {
            navigate('/onboarding');
          }
        } catch (error) {
          console.error('Error checking profile:', error);
          navigate('/onboarding');
        }
      }
    };
    checkAndRedirect();
  }, [user, loading, navigate]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear errors when user types
    if (name === 'email') {
      setEmailError('');
    }
    if (name === 'password') {
      setPasswordError('');
    }
  };
  const validateEmail = (email: string): boolean => {
    try {
      emailSchema.parse(email);
      setEmailError('');
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailError(error.issues[0].message);
      }
      return false;
    }
  };
  const validatePassword = (password: string): boolean => {
    try {
      passwordSchema.parse(password);
      setPasswordError('');
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setPasswordError(error.issues[0].message);
      }
      return false;
    }
  };
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await signIn(formData.email, formData.password);
      // AuthContext's onAuthStateChange handles redirect after successful login
    } finally {
      setIsSubmitting(false);
    }
  };
  const [showEmailVerificationMessage, setShowEmailVerificationMessage] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous form error
    setFormError('');

    // Immediate visible feedback
    console.log('=== SIGNUP FORM SUBMITTED ===');
    console.log('[Auth] Form data:', {
      email: formData.email,
      hasPassword: !!formData.password,
      location: formData.location,
      acceptTerms: formData.acceptTerms
    });

    // Prevent double submission
    if (isSubmitting) {
      console.log('[Auth] Already submitting, ignoring');
      return;
    }

    // Collect all validation errors
    let hasErrors = false;

    // Validate email
    if (!formData.email.trim()) {
      console.log('[Auth] Email is empty');
      setEmailError('Email is required');
      hasErrors = true;
    } else if (!validateEmail(formData.email)) {
      console.log('[Auth] Email validation failed');
      hasErrors = true;
    }

    // Validate password
    if (!formData.password) {
      console.log('[Auth] Password is empty');
      setPasswordError('Password is required');
      hasErrors = true;
    } else if (!validatePassword(formData.password)) {
      console.log('[Auth] Password validation failed');
      hasErrors = true;
    }

    // Check password match
    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      console.log('[Auth] Passwords do not match');
      setPasswordError('Passwords do not match');
      hasErrors = true;
    } else if (!formData.confirmPassword) {
      console.log('[Auth] Confirm password is empty');
      setPasswordError('Please confirm your password');
      hasErrors = true;
    }

    // Check required fields - location
    if (!formData.location.trim()) {
      console.log('[Auth] Location missing');
      setFormError('Please enter your location');
      hasErrors = true;
    }

    // Check terms
    if (!formData.acceptTerms) {
      console.log('[Auth] Terms not accepted');
      setFormError('Please accept the Terms of Service to continue');
      hasErrors = true;
    }

    // If there are validation errors, stop here
    if (hasErrors) {
      console.log('[Auth] Validation failed, not proceeding with signup');
      return;
    }
    console.log('[Auth] All validations passed, starting signup...');
    setIsSubmitting(true);
    try {
      const metadata = {
        location: formData.location.trim(),
        bio: formData.bio.trim() || 'Hello, I\'m new to Òloo!',
        biometric_consent: formData.biometricConsent
      };
      console.log('[Auth] Calling signUp with:', {
        email: formData.email,
        hasPassword: !!formData.password,
        metadata
      });
      const result = await signUp(formData.email, formData.password, metadata);
      console.log('[Auth] SignUp result:', result);
      if (!result.error) {
        console.log('[Auth] SignUp successful, showing verification message');
        // Store the email and show verification message
        setRegisteredEmail(formData.email);
        setShowEmailVerificationMessage(true);

        // Store onboarding data for after email verification
        if (onboardingData) {
          localStorage.setItem('pendingOnboardingData', JSON.stringify(onboardingData));
        }

        // Store biometric consent preference for after verification
        if (formData.biometricConsent) {
          localStorage.setItem('pendingBiometricConsent', 'true');
        }
      } else {
        console.error('[Auth] SignUp returned error:', result.error);
        setFormError(result.error.message || 'Signup failed. Please try again.');
      }
    } catch (error: any) {
      console.error('[Auth] Sign up exception:', error);
      setFormError(error?.message || 'An error occurred during sign up. Please try again.');
    } finally {
      console.log('[Auth] Resetting isSubmitting state');
      setIsSubmitting(false);
    }
  };
  const handleVerificationComplete = (success: boolean) => {
    setShowVerification(false);
    navigate('/app');
  };

  // Show verification flow
  if (showVerification) {
    return <div className="min-h-screen dark bg-background flex items-center justify-center p-4">
        <FaceVerification onVerificationComplete={handleVerificationComplete} profilePhotos={[]} />
      </div>;
  }
  // Show email verification message
  if (showEmailVerificationMessage) {
    return <div className="min-h-screen flex items-center justify-center p-4" style={{
      backgroundColor: '#f7f4e8'
    }}>
        <Card className="max-w-md w-full backdrop-blur-md bg-card/80 border-primary/20 shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-afro-heading">{t('auth.checkEmail')}</CardTitle>
            <CardDescription className="text-base">
              {t('auth.emailSent')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="font-semibold text-lg text-foreground bg-muted/50 py-2 px-4 rounded-lg">
              {registeredEmail}
            </p>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2 text-left">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{t('auth.verificationStep1')}</span>
              </div>
              <div className="flex items-start gap-2 text-left">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{t('auth.verificationStep2')}</span>
              </div>
              <div className="flex items-start gap-2 text-left">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{t('auth.verificationStep3')}</span>
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <Button variant="outline" className="w-full" onClick={() => {
              setShowEmailVerificationMessage(false);
              setFormData(prev => ({
                ...prev,
                email: '',
                password: '',
                confirmPassword: ''
              }));
            }}>
                {t('auth.useDifferentEmail')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>;
  }

  // Debug: Log component state
  console.log('[Auth] Component state:', {
    loading,
    user: !!user,
    isSubmitting
  });
  if (loading) {
    console.log('[Auth] Showing loading spinner');
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="animate-pulse">
          <div className="heart-logo mx-auto mb-4">
            <span className="logo-text">Ò</span>
          </div>
          <p className="text-muted-foreground text-center">{t('auth.loadingOloo')}</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen" style={{
    backgroundColor: '#f7f4e8'
  }}>
      
      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <Button variant="ghost" className="absolute top-6 left-6" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
          
          
          
          <h1 className="text-4xl font-bold font-afro-heading mb-2">
            <span className="afro-heading text-primary cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/')}>Òloo</span>
          </h1>
          <p className="text-xl text-foreground font-afro-body">
            {t('landing.tagline')}
          </p>
        </div>

        {/* Auth Form */}
        <div className="max-w-md mx-auto">
          <Card className="backdrop-blur-md bg-card/80 border-primary/20 shadow-2xl shadow-primary/20 cultural-card hover:shadow-primary/30 transition-all duration-500">
            <CardHeader className="text-center pb-4 bg-gradient-to-b from-primary/5 to-transparent rounded-t-lg">
              <CardTitle className="font-afro-heading text-foreground text-2xl font-normal">
                {t('auth.createAccount')}
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground/90">
                {t('auth.meaningfulConnections')}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="relative">
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 rounded-b-lg pointer-events-none"></div>
              
              <div className="relative z-10">
                <form onSubmit={e => {
                e.preventDefault();
                console.log('=== FORM SUBMIT EVENT ===');
                handleSignUp(e);
              }} className="space-y-4">
                  <div>
                    <Label htmlFor="email">{t('auth.email')}</Label>
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} onBlur={() => formData.email && validateEmail(formData.email)} placeholder={t('auth.emailPlaceholder')} className={emailError ? 'border-destructive' : ''} required />
                    {emailError && <p className="text-sm text-destructive mt-1">{emailError}</p>}
                  </div>

                  <div>
                    <Label htmlFor="location">{t('auth.location')}</Label>
                    <Input id="location" name="location" value={formData.location} onChange={handleInputChange} placeholder={t('auth.locationPlaceholder')} required />
                  </div>

                  <div className="relative">
                    <Label htmlFor="password">{t('auth.passwordMinLength')}</Label>
                    <Input id="password" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleInputChange} onBlur={() => formData.password && validatePassword(formData.password)} placeholder={t('auth.createStrongPassword')} className={passwordError ? 'border-destructive' : ''} required minLength={10} />
                    <button type="button" className="absolute right-3 top-8 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {passwordError && <p className="text-sm text-destructive mt-1">{passwordError}</p>}
                  </div>

                  <div className="relative">
                    <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                    <Input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleInputChange} placeholder={t('auth.confirmPasswordPlaceholder')} className={passwordError && formData.confirmPassword ? 'border-destructive' : ''} required minLength={10} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <Checkbox id="acceptTerms" checked={formData.acceptTerms} onCheckedChange={checked => setFormData(prev => ({
                      ...prev,
                      acceptTerms: checked as boolean
                    }))} />
                      <Label htmlFor="acceptTerms" className="text-sm leading-relaxed">
                        {t('auth.acceptTerms')} <span className="text-primary underline">{t('auth.termsOfService')}</span> {t('auth.and')}{' '}
                        <span className="text-primary underline">{t('auth.privacyPolicy')}</span>
                      </Label>
                    </div>

                    <div className="flex items-start space-x-2">
                      <Checkbox id="biometricConsent" checked={formData.biometricConsent} onCheckedChange={checked => setFormData(prev => ({
                      ...prev,
                      biometricConsent: checked as boolean
                    }))} />
                      <Label htmlFor="biometricConsent" className="text-sm leading-relaxed">
                        <span className="text-accent">{t('auth.optional')}</span> {t('auth.biometricConsent')}
                      </Label>
                    </div>
                  </div>

                  {formError && <div className="p-3 rounded-lg border border-destructive/20 text-sm text-white bg-red-900">
                      {formError}
                    </div>}

                  <Button type="button" className="w-full h-12 text-lg font-semibold romantic-gradient hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-primary/40" disabled={isSubmitting} onClick={e => {
                  e.preventDefault();
                  console.log('=== DIRECT BUTTON CLICK - CALLING SIGNUP ===');
                  handleSignUp(e as unknown as React.FormEvent);
                }}>
                    {isSubmitting ? t('auth.creatingAccount') : t('auth.createAccount')}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-card px-4 text-muted-foreground">{t('common.orContinueWith')}</span>
                  </div>
                </div>

                {/* Social OAuth Buttons */}
                <div className="space-y-3">
                  {/* Google */}
                  <Button type="button" variant="outline" className="w-full h-12 bg-card text-foreground border-2 border-border hover:bg-muted font-semibold transition-all duration-300 flex items-center justify-center gap-3" onClick={() => signInWithGoogle()} disabled={isSubmitting}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {t('auth.continueWith')} {t('auth.google')}
                  </Button>

                  {/* X (Twitter) */}
                  <Button type="button" variant="outline" className="w-full h-12 bg-card text-foreground border-2 border-border hover:bg-muted font-semibold transition-all duration-300 flex items-center justify-center gap-3" onClick={() => signInWithTwitter()} disabled={isSubmitting}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    {t('auth.continueWith')} {t('auth.twitter')}
                  </Button>

                  {/* Facebook */}
                  <Button type="button" variant="outline" className="w-full h-12 bg-card text-foreground border-2 border-border hover:bg-muted font-semibold transition-all duration-300 flex items-center justify-center gap-3" onClick={() => signInWithFacebook()} disabled={isSubmitting}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    {t('auth.continueWith')} {t('auth.facebook')}
                  </Button>

                  {/* LinkedIn */}
                  <Button type="button" variant="outline" className="w-full h-12 bg-card text-foreground border-2 border-border hover:bg-muted font-semibold transition-all duration-300 flex items-center justify-center gap-3" onClick={() => signInWithLinkedIn()} disabled={isSubmitting}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0A66C2">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    {t('auth.continueWith')} {t('auth.linkedin')}
                  </Button>
                </div>

                {/* Sign In Link */}
                <div className="mt-6 pt-6 border-t border-border text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('auth.alreadyHaveAccount')}
                  </p>
                  <Button variant="outline" className="w-full h-12 bg-card text-foreground border-2 border-border hover:bg-muted font-semibold transition-all duration-300" onClick={() => window.location.href = '/signin'}>
                    {t('auth.signIn')}
                  </Button>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-border text-center">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('common.termsFooter')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>;
};
export default Auth;