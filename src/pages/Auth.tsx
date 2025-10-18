import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Heart, ArrowLeft } from 'lucide-react';
import { FaceVerification } from '@/components/FaceVerification';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(10, 'Password must be at least 10 characters');

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
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
          setFormData(prev => ({ ...prev, location: data.location }));
        }
      } catch (error) {
        console.error('Error loading onboarding data:', error);
      }
    }
  }, []);

  // Redirect only if user is authenticated AND has a complete profile
  useEffect(() => {
    const checkAndRedirect = async () => {
      if (user && !loading) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name, age, location')
            .eq('user_id', user.id)
            .single();

          // Only redirect to /app if profile is complete
          if (data && data.display_name && data.age && data.location) {
            navigate('/app');
          }
        } catch (error) {
          console.error('Error checking profile:', error);
        }
      }
    };

    checkAndRedirect();
  }, [user, loading, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
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
      const { error } = await signIn(formData.email, formData.password);
      
      if (!error) {
        // Check if user has completed profile
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, age, location')
            .eq('user_id', session.session.user.id)
            .single();

          if (!profile || !profile.display_name || !profile.age || !profile.location) {
            navigate('/onboarding');
          } else {
            navigate('/app');
          }
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate email
    if (!validateEmail(formData.email)) {
      return;
    }

    // Validate password
    if (!validatePassword(formData.password)) {
      return;
    }

    // Check password match
    if (formData.password !== formData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    // Check terms
    if (!formData.acceptTerms) {
      alert('Please accept the Terms of Service to continue');
      return;
    }

    // Check required fields
    if (!formData.location.trim()) {
      alert('Please enter your location');
      return;
    }

    setIsSubmitting(true);
    console.log('Starting sign up process...');
    
    try {
      const metadata = {
        location: formData.location.trim(),
        bio: formData.bio.trim() || 'Hello, I\'m new to Òloo!',
        biometric_consent: formData.biometricConsent
      };

      console.log('Calling signUp with:', { email: formData.email, hasPassword: !!formData.password, metadata });
      const result = await signUp(formData.email, formData.password, metadata);
      
      console.log('SignUp result:', result);
      
      if (!result.error) {
        // If we have onboarding data, create the profile
        if (onboardingData) {
          try {
            const { data: session } = await supabase.auth.getSession();
            if (session?.session?.user) {
              // Calculate age from birthDate
              let age = 25; // default
              if (onboardingData.birthDate) {
                const birth = new Date(onboardingData.birthDate);
                const today = new Date();
                age = today.getFullYear() - birth.getFullYear();
                const monthDiff = today.getMonth() - birth.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                  age--;
                }
              }

              // Parse height
              let heightInCm = null;
              if (onboardingData.height && onboardingData.height.includes("'")) {
                const parts = onboardingData.height.split("'");
                const feet = parseInt(parts[0]) || 0;
                const inches = parseInt(parts[1]) || 0;
                heightInCm = Math.round(feet * 30.48 + inches * 2.54);
              }

              // Parse interests from hobbies
              const interests = onboardingData.hobbies 
                ? onboardingData.hobbies.split(',').map((h: string) => h.trim()).filter((h: string) => h)
                : [];

              // Build bio from hobbies and personality
              const bio = onboardingData.hobbies || onboardingData.personality
                ? `${onboardingData.hobbies || ''}\n\nPersonality: ${onboardingData.personality || ''}`.trim()
                : formData.bio || 'Hello, I\'m new to Òloo!';

              // Upload photos if they exist
              const profilePhotoUrls: string[] = [];
              if (onboardingData.photoDataUrls && onboardingData.photoDataUrls.length > 0) {
                toast({
                  title: "Uploading photos...",
                  description: `Uploading ${onboardingData.photoDataUrls.length} photo(s)`,
                });

                for (let i = 0; i < onboardingData.photoDataUrls.length; i++) {
                  try {
                    const dataUrl = onboardingData.photoDataUrls[i];
                    const base64Data = dataUrl.split(',')[1];
                    const mimeType = dataUrl.split(';')[0].split(':')[1];
                    const fileExt = mimeType.split('/')[1];
                    const fileName = `${session.session.user.id}/${Date.now()}_${i}.${fileExt}`;
                    
                    // Convert base64 to blob
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let j = 0; j < byteCharacters.length; j++) {
                      byteNumbers[j] = byteCharacters.charCodeAt(j);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: mimeType });
                    
                    const { error: uploadError } = await supabase.storage
                      .from('profile-photos')
                      .upload(fileName, blob, {
                        contentType: mimeType,
                        upsert: false
                      });
                    
                    if (!uploadError) {
                      const { data: { publicUrl } } = supabase.storage
                        .from('profile-photos')
                        .getPublicUrl(fileName);
                      profilePhotoUrls.push(publicUrl);
                    } else {
                      console.error('Photo upload error:', uploadError);
                    }
                  } catch (error) {
                    console.error('Photo processing error:', error);
                  }
                }

                if (profilePhotoUrls.length > 0) {
                  toast({
                    title: "Photos uploaded!",
                    description: `Successfully uploaded ${profilePhotoUrls.length} photo(s)`,
                  });
                }
              }

              await supabase
                .from('profiles')
                .update({
                  display_name: onboardingData.name || '',
                  age: age,
                  bio: bio,
                  location: formData.location || 'Not specified',
                  height_cm: heightInCm,
                  gender: onboardingData.gender || null,
                  education: onboardingData.education || 'Not specified',
                  occupation: onboardingData.occupation || 'Not specified',
                  interests: interests,
                  relationship_goals: onboardingData.lookingFor || 'Getting to know people',
                  profile_photos: profilePhotoUrls,
                  avatar_url: profilePhotoUrls[0] || null,
                })
                .eq('user_id', session.session.user.id);
              
              // Clear onboarding data from localStorage
              localStorage.removeItem('onboardingData');
              console.log('Onboarding data saved to profile');
            }
          } catch (error) {
            console.error('Error saving profile:', error);
          }
        }
        
        // Navigate to app after successful signup
        if (formData.biometricConsent) {
          setShowVerification(true);
        } else {
          navigate('/app');
        }
      }
    } catch (error) {
      console.error('Sign up error:', error);
      alert('An error occurred during sign up. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationComplete = (success: boolean) => {
    setShowVerification(false);
    navigate('/app');
  };

  // Show verification flow
  if (showVerification) {
    return (
      <div className="min-h-screen dark bg-background flex items-center justify-center p-4">
        <FaceVerification 
          onVerificationComplete={handleVerificationComplete}
          profilePhotos={[]}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="animate-pulse">
          <div className="heart-logo mx-auto mb-4">
            <span className="logo-text">Ò</span>
          </div>
          <p className="text-muted-foreground text-center">Loading Òloo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f4e8' }}>
      
      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <Button variant="ghost" className="absolute top-6 left-6" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('back')}
          </Button>
          
          <div className="heart-logo mx-auto mb-4">
            <span className="logo-text">Ò</span>
          </div>
          
          <h1 className="text-4xl font-bold font-afro-heading mb-2">
            <span className="afro-heading">Òloo</span>
          </h1>
          <p className="text-xl text-muted-foreground font-afro-body">
            Cultured in connection
          </p>
        </div>

        {/* Auth Form */}
        <div className="max-w-md mx-auto">
          <Card className="backdrop-blur-md bg-card/80 border-primary/20 shadow-2xl shadow-primary/20 cultural-card hover:shadow-primary/30 transition-all duration-500">
            <CardHeader className="text-center pb-4 bg-gradient-to-b from-primary/5 to-transparent rounded-t-lg">
              <CardTitle className="text-2xl font-afro-heading bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t('createAccount')}
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground/90">
                {t('meaningfulConnections')}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="relative">
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 rounded-b-lg pointer-events-none"></div>
              
              <div className="relative z-10">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="email">{t('email')}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      onBlur={() => formData.email && validateEmail(formData.email)}
                      placeholder="your@email.com"
                      className={emailError ? 'border-red-500' : ''}
                      required
                    />
                    {emailError && (
                      <p className="text-sm text-red-500 mt-1">{emailError}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="location">{t('location')}</Label>
                    <Input
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="Lagos, Nigeria"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Label htmlFor="password">{t('passwordMinimum')}</Label>
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleInputChange}
                      onBlur={() => formData.password && validatePassword(formData.password)}
                      placeholder={t('createStrongPassword')}
                      className={passwordError ? 'border-red-500' : ''}
                      required
                      minLength={10}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {passwordError && (
                      <p className="text-sm text-red-500 mt-1">{passwordError}</p>
                    )}
                  </div>

                  <div className="relative">
                    <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder={t('confirmYourPassword')}
                      className={passwordError && formData.confirmPassword ? 'border-red-500' : ''}
                      required
                      minLength={10}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="acceptTerms"
                        checked={formData.acceptTerms}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, acceptTerms: checked as boolean }))
                        }
                      />
                      <Label htmlFor="acceptTerms" className="text-sm leading-relaxed">
                        I accept the <span className="text-primary underline">Terms of Service</span> and{' '}
                        <span className="text-primary underline">Privacy Policy</span>
                      </Label>
                    </div>

                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="biometricConsent"
                        checked={formData.biometricConsent}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, biometricConsent: checked as boolean }))
                        }
                      />
                      <Label htmlFor="biometricConsent" className="text-sm leading-relaxed">
                        <span className="text-orange-500">Optional:</span> I consent to face verification for enhanced security and profile authenticity
                      </Label>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 text-lg font-semibold romantic-gradient hover:opacity-90 text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-primary/40"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>

                {/* Sign In Link */}
                <div className="mt-6 pt-6 border-t border-border text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Already have an account?
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full h-12 bg-white text-black border-2 border-gray-200 hover:bg-gray-50 font-semibold transition-all duration-300"
                    onClick={() => window.location.href = '/signin'}
                  >
                    Sign In
                  </Button>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-border text-center">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    By joining Òloo, you agree to our community guidelines and commit to respectful, 
                    authentic connections within our culturally-rich environment.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;