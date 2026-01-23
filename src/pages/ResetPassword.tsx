import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';

const ResetPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || cooldown > 0) return;

    setIsSubmitting(true);
    try {
      const { error } = await requestPasswordReset(email);
      
      if (!error) {
        setSuccess(true);
        // Start 60 second cooldown
        setCooldown(60);
        const interval = setInterval(() => {
          setCooldown(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f4e8' }}>
      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <Button variant="ghost" className="absolute top-6 left-6" onClick={() => navigate('/signin')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('resetPassword.backToSignIn')}
          </Button>
          
          <div className="heart-logo mx-auto mb-4">
            <span className="logo-text">Ò</span>
          </div>
          
          <h1 className="text-4xl font-bold font-afro-heading mb-2">
            <span className="afro-heading">Òloo</span>
          </h1>
          <p className="text-xl text-muted-foreground font-afro-body">
            {t('resetPassword.title')}
          </p>
        </div>

        {/* Reset Password Form */}
        <div className="max-w-md mx-auto">
          <Card className="backdrop-blur-md bg-card/80 border-primary/20 shadow-2xl shadow-primary/20 cultural-card hover:shadow-primary/30 transition-all duration-500">
            <CardHeader className="text-center pb-4 bg-gradient-to-b from-primary/5 to-transparent rounded-t-lg">
              <CardTitle className="text-2xl font-afro-heading bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t('resetPassword.forgotPassword')}
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground/90">
                {t('resetPassword.description')}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 rounded-b-lg pointer-events-none"></div>
              
              <div className="relative z-10">
                {success ? (
                  <Alert className="mb-6 border-green-500/50 bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      {t('resetPassword.checkEmail')}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">{t('resetPassword.emailAddress')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('resetPassword.placeholder')}
                        className="pl-10"
                        required
                        disabled={success}
                      />
                    </div>
                  </div>

                  {cooldown > 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                      {t('resetPassword.waitSeconds', { seconds: cooldown })}
                    </p>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-12 text-lg font-semibold romantic-gradient hover:opacity-90 text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-primary/40"
                    disabled={isSubmitting || success || cooldown > 0}
                  >
                    {isSubmitting ? t('resetPassword.sending') : success ? t('resetPassword.emailSent') : t('resetPassword.sendResetLink')}
                  </Button>
                </form>

                {/* Back to Sign In */}
                <div className="mt-6 pt-6 border-t border-border text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('resetPassword.rememberPassword')}
                  </p>
                  <Button 
                    variant="ghost" 
                    className="text-primary hover:text-primary/80 hover:bg-primary/5"
                    onClick={() => navigate('/signin')}
                  >
                    {t('resetPassword.backToSignIn')}
                  </Button>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-border text-center">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('resetPassword.securityNote')}
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

export default ResetPassword;