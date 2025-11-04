import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle, Loader2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { parseAuthHash, cleanAuthHash } from '@/utils/authUtils';
import { useToast } from '@/hooks/use-toast';

const ResetPasswordConfirm = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');
  const [error, setError] = useState('');
  const [validToken, setValidToken] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string>('');
  const [isProcessingToken, setIsProcessingToken] = useState(true);

  useEffect(() => {
    const handleTokenExchange = async () => {
      setIsProcessingToken(true);
      
      const hash = window.location.hash;
      const authParams = parseAuthHash(hash);
      
      console.log('Password reset - Hash params:', authParams?.type);
      
      if (authParams?.error) {
        console.error('Auth error in URL:', authParams.error_description);
        setTokenError(authParams.error_description || 'Invalid reset link');
        setValidToken(false);
        setIsProcessingToken(false);
        cleanAuthHash();
        return;
      }
      
      if (authParams?.access_token && authParams?.type === 'recovery') {
        console.log('Recovery token found, exchanging for session...');
        
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: authParams.access_token,
            refresh_token: authParams.refresh_token || '',
          });
          
          if (error) throw error;
          
          if (data.session) {
            console.log('Session established successfully');
            setValidToken(true);
            setTokenError('');
            cleanAuthHash();
            toast({
              title: "Link verified",
              description: "You can now set your new password.",
            });
          } else {
            throw new Error('No session created');
          }
        } catch (err: any) {
          console.error('Token exchange error:', err);
          setTokenError(err.message || 'Failed to verify reset link');
          setValidToken(false);
        }
        
        setIsProcessingToken(false);
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('Existing session found');
        setValidToken(true);
      } else {
        console.log('No token or session found');
        setTokenError('No reset token found. Please request a new password reset link.');
        setValidToken(false);
      }
      
      setIsProcessingToken(false);
    };

    handleTokenExchange();
  }, [toast]);

  useEffect(() => {
    // Calculate password strength
    if (password.length === 0) {
      setPasswordStrength('weak');
      return;
    }

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 1) setPasswordStrength('weak');
    else if (strength <= 3) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  }, [password]);

  const validatePassword = (): boolean => {
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    if (!/[a-zA-Z]/.test(password)) {
      setError('Password must contain at least one letter');
      return false;
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !validatePassword()) return;

    setIsSubmitting(true);
    try {
      const { error } = await updatePassword(password);
      
      if (!error) {
        toast({
          title: "Password updated",
          description: "Your password has been changed successfully.",
        });
        setTimeout(() => {
          navigate('/signin');
        }, 1000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isProcessingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Processing reset link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validToken === false) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f7f4e8' }}>
        <div className="relative z-10 container mx-auto px-6 py-8">
          <div className="max-w-md mx-auto">
            <Card className="backdrop-blur-md bg-card/80 border-destructive/20">
              <CardHeader className="text-center">
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <CardTitle className="text-2xl">Reset Link Issue</CardTitle>
                <CardDescription>
                  {tokenError || "This password reset link is invalid or has expired."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Password reset links expire after 1 hour. Please request a new link if yours has expired.
                  </AlertDescription>
                </Alert>
                <Button 
                  className="w-full"
                  onClick={() => navigate('/reset-password')}
                >
                  Request New Link
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/signin')} 
                  className="w-full"
                >
                  Back to Sign In
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const strengthColors = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500'
  };

  const strengthWidths = {
    weak: 'w-1/3',
    medium: 'w-2/3',
    strong: 'w-full'
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f4e8' }}>
      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="heart-logo mx-auto mb-4">
            <span className="logo-text">Ò</span>
          </div>
          
          <h1 className="text-4xl font-bold font-afro-heading mb-2">
            <span className="afro-heading">Òloo</span>
          </h1>
          <p className="text-xl text-muted-foreground font-afro-body">
            Set your new password
          </p>
        </div>

        {/* Set New Password Form */}
        <div className="max-w-md mx-auto">
          <Card className="backdrop-blur-md bg-card/80 border-primary/20 shadow-2xl shadow-primary/20 cultural-card hover:shadow-primary/30 transition-all duration-500">
            <CardHeader className="text-center pb-4 bg-gradient-to-b from-primary/5 to-transparent rounded-t-lg">
              <CardTitle className="text-2xl font-afro-heading bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Create New Password
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground/90">
                Choose a strong password to secure your account
              </CardDescription>
            </CardHeader>
            
            <CardContent className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 rounded-b-lg pointer-events-none"></div>
              
              <div className="relative z-10">
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    
                    {/* Password Strength Indicator */}
                    {password && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Password strength:</span>
                          <span className={`font-medium ${
                            passwordStrength === 'weak' ? 'text-red-500' :
                            passwordStrength === 'medium' ? 'text-yellow-500' :
                            'text-green-500'
                          }`}>
                            {passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1)}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${strengthColors[passwordStrength]} ${strengthWidths[passwordStrength]}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Requirements */}
                  <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded-md">
                    <p className="font-medium mb-2">Password must contain:</p>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-3 w-3 ${password.length >= 8 ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <span>At least 8 characters</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-3 w-3 ${/[a-zA-Z]/.test(password) ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <span>Letters (a-z, A-Z)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-3 w-3 ${/[0-9]/.test(password) ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <span>Numbers (0-9)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`h-3 w-3 ${/[^a-zA-Z0-9]/.test(password) ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <span>Special characters (!@#$%^&*) - Recommended</span>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 text-lg font-semibold romantic-gradient hover:opacity-90 text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-primary/40"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Updating Password...' : 'Reset Password'}
                  </Button>
                </form>

                {/* Footer */}
                <div className="mt-6 pt-6 border-t border-border text-center">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    After resetting your password, you'll be redirected to sign in with your new credentials.
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

export default ResetPasswordConfirm;
