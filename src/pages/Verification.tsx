import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import VideoVerificationRequest from '@/components/VideoVerificationRequest';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, ArrowLeft, Video, Users, Heart, CheckCircle, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Verification: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<any>(null);
  const [videoVerificationStatus, setVideoVerificationStatus] = useState<'none' | 'pending' | 'verified'>('none');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfileAndVerification = async () => {
      if (!user) return;
      
      try {
        // Fetch profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (profileError) throw profileError;
        setProfile(profileData);

        // SECURITY: Use secure function to get verification status
        const { data: verificationData, error: verificationError } = await supabase
          .rpc('get_secure_verification_status', { target_user_id: user.id });
        
        if (verificationError) {
          console.error('Error fetching verification status:', verificationError);
        } else {
          setVideoVerificationStatus(verificationData ? 'verified' : 'none');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error loading profile",
          description: "Please try again",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileAndVerification();
  }, [user, toast]);

  const handleVerificationComplete = async (verified: boolean) => {
    if (verified) {
      // Refresh verification status after successful verification
      try {
        const { data: updatedVerificationData } = await supabase
          .rpc('get_secure_verification_status', { target_user_id: user?.id });
        setVideoVerificationStatus(updatedVerificationData ? 'verified' : 'none');
        setProfile({ ...profile, verified: true });
      } catch (error) {
        console.error('Error refreshing verification status:', error);
      }
      
      setTimeout(() => {
        navigate('/', { 
          state: { message: 'Verification successful! You now have a verified badge.' }
        });
      }, 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Profile Required</h2>
            <p className="text-muted-foreground mb-4">
              Please complete your profile before verification.
            </p>
            <Button onClick={() => navigate('/')}>
              Go to Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background african-pattern-bg">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="hover:bg-muted"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold afro-heading">Profile Verification</h1>
              <p className="text-sm text-muted-foreground">Get your orange checkmark</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {(profile?.verified || videoVerificationStatus === 'verified') ? (
          /* Already Verified */
          <Card className="max-w-2xl mx-auto cultural-card">
            <CardHeader className="text-center">
              <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="afro-heading text-2xl">Already Verified!</CardTitle>
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white mx-auto">
                ✓ Verified Profile
              </Badge>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="space-y-4">
                <p className="text-lg text-muted-foreground">
                  Your profile has been successfully verified and displays the orange checkmark.
                </p>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    <Users className="w-8 h-8 text-primary mx-auto" />
                    <h3 className="font-medium">Increased Trust</h3>
                    <p className="text-sm text-muted-foreground">Other users know you're real</p>
                  </div>
                  
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    <Heart className="w-8 h-8 text-primary mx-auto" />
                    <h3 className="font-medium">More Matches</h3>
                    <p className="text-sm text-muted-foreground">Verified profiles get more visibility</p>
                  </div>
                  
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    <Shield className="w-8 h-8 text-primary mx-auto" />
                    <h3 className="font-medium">Enhanced Security</h3>
                    <p className="text-sm text-muted-foreground">Protected against fake profiles</p>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate('/')}
                className="luxury-gradient text-white px-8 py-3"
              >
                Back to Dating
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Verification Info */
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="cultural-card">
              <CardHeader className="text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-10 h-10 text-primary" />
                </div>
                <CardTitle className="afro-heading text-2xl">Get Verified</CardTitle>
                <p className="text-muted-foreground">
                  Stand out with our secure 2-step verification process
                </p>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">How it works:</h3>
                  
                  <div className="space-y-3">
                    <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                      <Camera className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-medium">Liveness Check</h4>
                        <p className="text-sm text-muted-foreground">
                          Follow simple instructions to prove you're a real person
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                      <Users className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-medium">Face Matching</h4>
                        <p className="text-sm text-muted-foreground">
                          We'll compare your live video with your profile photos
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                      <Shield className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-medium">Orange Checkmark</h4>
                        <p className="text-sm text-muted-foreground">
                          Get the verified badge that shows you're authentic
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <h4 className="font-medium text-orange-700 dark:text-orange-400 mb-2">
                    Requirements:
                  </h4>
                  <ul className="text-sm space-y-1 text-orange-600 dark:text-orange-300">
                    <li>• Camera access for video verification</li>
                    <li>• Good lighting conditions</li>
                    <li>• At least one clear profile photo</li>
                    <li>• 2-3 minutes of your time</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={() => handleVerificationComplete(true)}
                    className="luxury-gradient text-white px-8 py-3 flex-1"
                    disabled={!profile.profile_photos || profile.profile_photos.length === 0}
                  >
                    <Video className="w-5 h-5 mr-2" />
                    Enable Video Verification
                  </Button>
                </div>

                {(!profile.profile_photos || profile.profile_photos.length === 0) && (
                  <p className="text-sm text-destructive text-center">
                    Please add at least one profile photo for video verification
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Verification;