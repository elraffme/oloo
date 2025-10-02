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
import ProfileCreation from '@/components/ProfileCreation';
import { FaceVerification } from '@/components/FaceVerification';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showProfileCreation, setShowProfileCreation] = useState(false);
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

  // Redirect if already authenticated
  if (user && !loading) {
    return <Navigate to="/app" replace />;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear email error when user types
    if (name === 'email') {
      setEmailError('');
    }
  };

  const validateEmail = (email: string): boolean => {
    try {
      emailSchema.parse(email);
      setEmailError('');
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailError(error.errors[0].message);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateEmail(formData.email)) {
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (!formData.acceptTerms) {
      alert('Please accept the Terms of Service');
      return;
    }

    setIsSubmitting(true);
    try {
      const metadata = {
        location: formData.location,
        bio: formData.bio || 'Hello, I\'m new to Òloo!',
        biometric_consent: formData.biometricConsent
      };

      const result = await signUp(formData.email, formData.password, metadata);
      
      if (!result.error) {
        // Show profile creation after successful signup
        if (formData.biometricConsent) {
          setShowVerification(true);
        } else {
          setShowProfileCreation(true);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationComplete = (success: boolean) => {
    setShowVerification(false);
    setShowProfileCreation(true);
  };

  const handleProfileCreationComplete = () => {
    setShowProfileCreation(false);
    // Navigate to discovery page to start swiping
    navigate('/app');
  };

  // Show profile creation flow
  if (showProfileCreation) {
    return <ProfileCreation onComplete={handleProfileCreationComplete} />;
  }

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
            Back
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
                Create Account
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground/90">
                Experience meaningful connections rooted in culture and heritage
              </CardDescription>
            </CardHeader>
            
            <CardContent className="relative">
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 rounded-b-lg pointer-events-none"></div>
              
              <div className="relative z-10">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
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
                    <Label htmlFor="location">Location</Label>
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
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Create a strong password"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Confirm your password"
                      required
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