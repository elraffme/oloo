import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Heart, ArrowLeft } from 'lucide-react';

const Auth = () => {
  const { user, loading, signIn, signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    age: '',
    location: '',
    bio: '',
    acceptTerms: false,
    biometricConsent: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  if (user && !loading) {
    return <Navigate to="/app" replace />;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        display_name: formData.displayName,
        age: parseInt(formData.age),
        location: formData.location,
        bio: formData.bio || 'Hello, I\'m new to Òloo!',
        biometric_consent: formData.biometricConsent
      };

      await signUp(formData.email, formData.password, metadata);
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 cultural-pattern">
      <div className="container mx-auto px-6 py-8">
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
          <Card className="cultural-card">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-afro-heading">Join the Community</CardTitle>
              <CardDescription className="text-base">
                Experience meaningful connections rooted in culture and heritage
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Tabs defaultValue="signup" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="signup" className="font-afro-body">Sign Up</TabsTrigger>
                  <TabsTrigger value="signin" className="font-afro-body">Sign In</TabsTrigger>
                </TabsList>

                {/* Sign Up Tab */}
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="displayName">Name</Label>
                        <Input
                          id="displayName"
                          name="displayName"
                          value={formData.displayName}
                          onChange={handleInputChange}
                          placeholder="Your name"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="age">Age</Label>
                        <Input
                          id="age"
                          name="age"
                          type="number"
                          min="18"
                          max="100"
                          value={formData.age}
                          onChange={handleInputChange}
                          placeholder="25"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="your@email.com"
                        required
                      />
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
                          <span className="text-orange-500">Optional:</span> I consent to face verification for enhanced security
                        </Label>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </form>
                </TabsContent>

                {/* Sign In Tab */}
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="your@email.com"
                        required
                      />
                    </div>

                    <div className="relative">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input
                        id="signin-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Your password"
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

                    <Button 
                      type="submit" 
                      className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Signing In...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-border text-center">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  By joining Òloo, you agree to our community guidelines and commit to respectful, 
                  authentic connections within our culturally-rich environment.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;