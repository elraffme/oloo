import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Upload, X } from "lucide-react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OnboardingStepProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onNext: () => void | Promise<void>;
  onBack?: () => void;
  canProceed?: boolean;
  isLastStep?: boolean;
  isSaving?: boolean;
  currentStep: number;
  totalSteps: number;
  backLabel: string;
  continueLabel: string;
  savingLabel: string;
  letsStartLabel: string;
}

const OnboardingStep = ({
  title,
  description,
  children,
  onNext,
  onBack,
  canProceed = true,
  isLastStep = false,
  isSaving = false,
  currentStep,
  totalSteps,
  backLabel,
  continueLabel,
  savingLabel,
  letsStartLabel
}: OnboardingStepProps) => (
  <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
    <Card className="w-full max-w-md cultural-card">
      <CardHeader className="text-center">
        <div className="w-full bg-secondary rounded-full h-2 mb-4">
          <div className="nsibidi-gradient h-2 rounded-full transition-all duration-500" style={{
            width: `${currentStep / totalSteps * 100}%`
          }} />
        </div>
        <CardTitle className="text-2xl font-afro-heading">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {backLabel}
            </Button>
          )}
          <Button 
            onClick={onNext} 
            disabled={!canProceed || (isLastStep && isSaving)} 
            className="flex-1 nsibidi-gradient text-primary-foreground hover:opacity-90 transition-all duration-300 shadow-lg"
          >
            {isLastStep && isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                {savingLabel}
              </>
            ) : isLastStep ? (
              <>{letsStartLabel}</>
            ) : (
              <>
                {continueLabel}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

const Onboarding = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading, updateProfile } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [formData, setFormData] = useState({
    agreed: false,
    name: "",
    birthDate: "",
    gender: "",
    orientation: "",
    height: "",
    bodyType: "",
    education: "",
    occupation: "",
    interestedIn: "",
    lookingFor: "",
    hobbies: "",
    personality: "",
    photos: [] as File[]
  });

  // Check if user has completed onboarding
  useEffect(() => {
    const checkProfile = async () => {
      if (!user) {
        setCheckingProfile(false);
        return;
      }
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .single();
        
        // If onboarding is completed, redirect to app
        if (profile?.onboarding_completed === true) {
          setHasProfile(true);
        }
      } catch (error) {
        console.log('No existing profile found, proceeding with onboarding');
      } finally {
        setCheckingProfile(false);
      }
    };
    
    if (!authLoading) {
      checkProfile();
    }
  }, [user, authLoading]);

  // Loading state
  if (authLoading || checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="animate-pulse text-center">
          <div className="heart-logo mx-auto mb-4">
            <span className="logo-text">Ò</span>
          </div>
          <p className="text-muted-foreground">{t('onboarding.loading')}</p>
        </div>
      </div>
    );
  }

  // Redirect to sign in if not authenticated
  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  // Block unverified email users - redirect to verification page
  const isEmailProvider = !user.app_metadata?.provider || user.app_metadata.provider === 'email';
  if (isEmailProvider && !user.email_confirmed_at) {
    return <Navigate to="/auth/verify" replace />;
  }

  // Redirect returning users to app
  if (hasProfile) {
    return <Navigate to="/app" replace />;
  }

  const totalSteps = 6;

  const updateData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (!user || formData.photos.length === 0) return [];
    
    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < formData.photos.length; i++) {
      const photo = formData.photos[i];
      const fileExt = photo.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, photo);
      
      if (uploadError) {
        console.error('Photo upload error:', uploadError);
        continue;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);
      
      uploadedUrls.push(publicUrl);
    }
    
    return uploadedUrls;
  };

  const calculateAge = (birthDate: string): number => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const saveProfile = async (): Promise<boolean> => {
    if (!user) {
      toast({
        title: t('common.error'),
        description: t('onboarding.errors.mustBeLoggedIn'),
        variant: "destructive"
      });
      return false;
    }

    // Validate required fields
    if (!formData.name || !formData.birthDate || !formData.gender) {
      toast({
        title: t('onboarding.errors.missingInfo'),
        description: t('onboarding.errors.completeFields'),
        variant: "destructive"
      });
      return false;
    }

    setIsSaving(true);
    
    try {
      // Upload photos first
      const photoUrls = await uploadPhotos();
      
      // Calculate age from birth date
      const age = calculateAge(formData.birthDate);
      
      // Validate age
      if (age < 18 || age > 100) {
        toast({
          title: t('onboarding.errors.invalidAge'),
          description: t('onboarding.errors.mustBe18'),
          variant: "destructive"
        });
        setIsSaving(false);
        return false;
      }

      // Parse height safely
      let heightInCm = 170; // default height
      if (formData.height && formData.height.includes("'")) {
        const parts = formData.height.split("'");
        const feet = parseInt(parts[0]) || 0;
        const inches = parseInt(parts[1]) || 0;
        heightInCm = Math.round(feet * 30.48 + inches * 2.54);
      }
      
      // Prepare profile data with onboarding_completed = true
      const profileData = {
        display_name: formData.name,
        age: age,
        gender: formData.gender,
        height_cm: heightInCm,
        education: formData.education || 'Not specified',
        occupation: formData.occupation || 'Not specified',
        relationship_goals: formData.lookingFor || 'Getting to know people',
        interests: formData.hobbies ? formData.hobbies.split(',').map(h => h.trim()).filter(h => h) : [],
        profile_photos: photoUrls,
        avatar_url: photoUrls[0] || null,
        bio: formData.hobbies ? `${formData.hobbies}\n\nPersonality: ${formData.personality}` : 'New to Òloo!',
        location: 'Not specified',
        onboarding_completed: true
      };
      
      console.log('Saving profile with onboarding_completed = true...', profileData);
      
      // Use updateProfile from context (handles upsert with onConflict: 'user_id')
      const { error } = await updateProfile(profileData);
      
      if (error) {
        console.error('Update profile error:', error);
        toast({
          title: t('onboarding.errors.errorSaving'),
          description: error.message,
          variant: "destructive"
        });
        setIsSaving(false);
        return false;
      }
      
      // Verify the profile was saved with onboarding_completed = true
      const { data: verifyProfile, error: verifyError } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single();
      
      if (verifyError || !verifyProfile?.onboarding_completed) {
        console.error('Profile verification failed:', verifyError);
        // Retry saving directly if verification failed
        const { error: retryError } = await supabase
          .from('profiles')
          .upsert({
            user_id: user.id,
            ...profileData,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id',
            ignoreDuplicates: false
          });
        
        if (retryError) {
          console.error('Retry save failed:', retryError);
          toast({
            title: t('onboarding.errors.errorSaving'),
            description: t('onboarding.errors.tryAgain'),
            variant: "destructive"
          });
          setIsSaving(false);
          return false;
        }
      }
      
      console.log('Profile saved successfully! onboarding_completed:', verifyProfile?.onboarding_completed);
      
      // Clear all pending states to allow immediate navigation to /app
      localStorage.removeItem('pendingOnboardingData');
      localStorage.removeItem('onboardingData');
      localStorage.removeItem('pendingBiometricConsent');
      localStorage.removeItem('pendingVerification');
      localStorage.removeItem('onboardingStep');
      
      toast({
        title: t('onboarding.success.profileCreated'),
        description: t('onboarding.success.welcome')
      });
      
      return true;
    } catch (error: any) {
      console.error('Profile save error:', error);
      toast({
        title: t('common.error'),
        description: error?.message || t('onboarding.errors.failedSave'),
        variant: "destructive"
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Final step - save profile and go to app
      const success = await saveProfile();
      if (success) {
        // Use window.location for reliable redirect that bypasses any auth state race conditions
        console.log('Onboarding complete, redirecting to /app...');
        window.location.href = '/app';
      }
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      updateData('photos', [...formData.photos, ...files].slice(0, 6));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      updateData('photos', [...formData.photos, ...files].slice(0, 6));
    }
  };

  // Common props for OnboardingStep
  const stepProps = {
    currentStep: step,
    totalSteps,
    backLabel: t('onboarding.back'),
    continueLabel: t('onboarding.continue'),
    savingLabel: t('onboarding.savingProfile'),
    letsStartLabel: t('onboarding.letsStart')
  };

  switch (step) {
    case 1:
      return (
        <OnboardingStep 
          title={t('onboarding.step1.title')} 
          description={t('onboarding.step1.description')} 
          onNext={nextStep} 
          canProceed={formData.agreed} 
          {...stepProps}
        >
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg max-h-32 overflow-y-auto text-sm">
              <p>{t('onboarding.step1.welcome')}</p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="agree" checked={formData.agreed} onCheckedChange={checked => updateData('agreed', checked)} />
              <Label htmlFor="agree" className="text-sm">{t('onboarding.step1.agreeTerms')}</Label>
            </div>
          </div>
        </OnboardingStep>
      );
    
    case 2:
      return (
        <OnboardingStep 
          title={t('onboarding.step2.title')} 
          description={t('onboarding.step2.description')} 
          onNext={nextStep} 
          onBack={prevStep} 
          canProceed={formData.name.length >= 2 && formData.birthDate.length > 0 && formData.gender.length > 0 && formData.orientation.length > 0} 
          {...stepProps}
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-base">{t('onboarding.step2.username')}</Label>
              <Input id="name" value={formData.name} onChange={e => updateData('name', e.target.value)} placeholder={t('onboarding.step2.usernamePlaceholder')} className="text-lg" />
              <p className="text-xs text-muted-foreground mt-1">{t('onboarding.step2.usernameHint')}</p>
            </div>
            <div>
              <Label htmlFor="birthDate">{t('onboarding.step2.dateOfBirth')}</Label>
              <Input 
                id="birthDate" 
                type="date"
                value={formData.birthDate} 
                onChange={e => updateData('birthDate', e.target.value)} 
                max={new Date().toISOString().split('T')[0]}
                min="1900-01-01"
                className="h-12"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('onboarding.step2.dateOfBirthHint')}</p>
            </div>
            <div>
              <Label>{t('onboarding.step2.gender')}</Label>
              <Select value={formData.gender} onValueChange={value => updateData('gender', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('onboarding.step2.genderPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="man">{t('onboarding.step2.genderMan')}</SelectItem>
                  <SelectItem value="woman">{t('onboarding.step2.genderWoman')}</SelectItem>
                  <SelectItem value="other">{t('onboarding.step2.genderOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('onboarding.step2.orientation')}</Label>
              <Select value={formData.orientation} onValueChange={value => updateData('orientation', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('onboarding.step2.orientationPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight">{t('onboarding.step2.orientationStraight')}</SelectItem>
                  <SelectItem value="gay">{t('onboarding.step2.orientationGay')}</SelectItem>
                  <SelectItem value="lesbian">{t('onboarding.step2.orientationLesbian')}</SelectItem>
                  <SelectItem value="bisexual">{t('onboarding.step2.orientationBisexual')}</SelectItem>
                  <SelectItem value="pansexual">{t('onboarding.step2.orientationPansexual')}</SelectItem>
                  <SelectItem value="other">{t('onboarding.step2.orientationOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </OnboardingStep>
      );
    
    case 3:
      return (
        <OnboardingStep 
          title={t('onboarding.step3.title')} 
          description={t('onboarding.step3.description')} 
          onNext={nextStep} 
          onBack={prevStep} 
          canProceed={formData.height.length > 0 && formData.bodyType.length > 0 && formData.education.length > 0} 
          {...stepProps}
        >
          <div className="space-y-4">
            <div>
              <Label>{t('onboarding.step3.height')}</Label>
              <Select value={formData.height} onValueChange={value => updateData('height', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('onboarding.step3.heightPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4'10">4'10" (147 cm)</SelectItem>
                  <SelectItem value="4'11">4'11" (150 cm)</SelectItem>
                  <SelectItem value="5'0">5'0" (152 cm)</SelectItem>
                  <SelectItem value="5'1">5'1" (155 cm)</SelectItem>
                  <SelectItem value="5'2">5'2" (157 cm)</SelectItem>
                  <SelectItem value="5'3">5'3" (160 cm)</SelectItem>
                  <SelectItem value="5'4">5'4" (163 cm)</SelectItem>
                  <SelectItem value="5'5">5'5" (165 cm)</SelectItem>
                  <SelectItem value="5'6">5'6" (168 cm)</SelectItem>
                  <SelectItem value="5'7">5'7" (170 cm)</SelectItem>
                  <SelectItem value="5'8">5'8" (173 cm)</SelectItem>
                  <SelectItem value="5'9">5'9" (175 cm)</SelectItem>
                  <SelectItem value="5'10">5'10" (178 cm)</SelectItem>
                  <SelectItem value="5'11">5'11" (180 cm)</SelectItem>
                  <SelectItem value="6'0">6'0" (183 cm)</SelectItem>
                  <SelectItem value="6'1">6'1" (185 cm)</SelectItem>
                  <SelectItem value="6'2">6'2" (188 cm)</SelectItem>
                  <SelectItem value="6'3">6'3" (191 cm)</SelectItem>
                  <SelectItem value="6'4">6'4" (193 cm)</SelectItem>
                  <SelectItem value="6'5">6'5" (196 cm)</SelectItem>
                  <SelectItem value="6'6+">6'6"+ (198+ cm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('onboarding.step3.bodyType')}</Label>
              <Select value={formData.bodyType} onValueChange={value => updateData('bodyType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('onboarding.step3.bodyTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slim">{t('onboarding.step3.bodyTypeSlim')}</SelectItem>
                  <SelectItem value="athletic">{t('onboarding.step3.bodyTypeAthletic')}</SelectItem>
                  <SelectItem value="average">{t('onboarding.step3.bodyTypeAverage')}</SelectItem>
                  <SelectItem value="curvy">{t('onboarding.step3.bodyTypeCurvy')}</SelectItem>
                  <SelectItem value="muscular">{t('onboarding.step3.bodyTypeMuscular')}</SelectItem>
                  <SelectItem value="heavyset">{t('onboarding.step3.bodyTypeHeavyset')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('onboarding.step3.education')}</Label>
              <Select value={formData.education} onValueChange={value => updateData('education', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('onboarding.step3.educationPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high-school">{t('onboarding.step3.educationHighSchool')}</SelectItem>
                  <SelectItem value="some-college">{t('onboarding.step3.educationSomeCollege')}</SelectItem>
                  <SelectItem value="associates">{t('onboarding.step3.educationAssociates')}</SelectItem>
                  <SelectItem value="bachelors">{t('onboarding.step3.educationBachelors')}</SelectItem>
                  <SelectItem value="masters">{t('onboarding.step3.educationMasters')}</SelectItem>
                  <SelectItem value="phd">{t('onboarding.step3.educationPhD')}</SelectItem>
                  <SelectItem value="trade">{t('onboarding.step3.educationTrade')}</SelectItem>
                  <SelectItem value="other">{t('onboarding.step3.educationOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="occupation">{t('onboarding.step3.occupation')}</Label>
              <Input id="occupation" value={formData.occupation} onChange={e => updateData('occupation', e.target.value)} placeholder={t('onboarding.step3.occupationPlaceholder')} />
            </div>
          </div>
        </OnboardingStep>
      );
    
    case 4:
      return (
        <OnboardingStep 
          title={t('onboarding.step4.title')} 
          description={t('onboarding.step4.description')} 
          onNext={nextStep} 
          onBack={prevStep} 
          canProceed={formData.interestedIn.length > 0 && formData.lookingFor.length > 0} 
          {...stepProps}
        >
          <div className="space-y-4">
            <div>
              <Label>{t('onboarding.step4.showMe')}</Label>
              <Select value={formData.interestedIn} onValueChange={value => updateData('interestedIn', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('onboarding.step4.showMePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="men">{t('onboarding.step4.showMeMen')}</SelectItem>
                  <SelectItem value="women">{t('onboarding.step4.showMeWomen')}</SelectItem>
                  <SelectItem value="everyone">{t('onboarding.step4.showMeEveryone')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('onboarding.step4.relationshipGoals')}</Label>
              <Select value={formData.lookingFor} onValueChange={value => updateData('lookingFor', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('onboarding.step4.relationshipGoalsPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long-term">{t('onboarding.step4.relationshipLongTerm')}</SelectItem>
                  <SelectItem value="short-term">{t('onboarding.step4.relationshipShortTerm')}</SelectItem>
                  <SelectItem value="open-to-short">{t('onboarding.step4.relationshipOpenShort')}</SelectItem>
                  <SelectItem value="open-to-long">{t('onboarding.step4.relationshipOpenLong')}</SelectItem>
                  <SelectItem value="not-sure">{t('onboarding.step4.relationshipNotSure')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="hobbies">{t('onboarding.step4.hobbies')}</Label>
              <Textarea id="hobbies" value={formData.hobbies} onChange={e => updateData('hobbies', e.target.value)} placeholder={t('onboarding.step4.hobbiesPlaceholder')} className="min-h-24" />
            </div>
            <div>
              <Label>{t('onboarding.step4.personality')}</Label>
              <Select value={formData.personality} onValueChange={value => updateData('personality', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('onboarding.step4.personalityPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTJ">INTJ - The Architect</SelectItem>
                  <SelectItem value="INTP">INTP - The Thinker</SelectItem>
                  <SelectItem value="ENTJ">ENTJ - The Commander</SelectItem>
                  <SelectItem value="ENTP">ENTP - The Debater</SelectItem>
                  <SelectItem value="INFJ">INFJ - The Advocate</SelectItem>
                  <SelectItem value="INFP">INFP - The Mediator</SelectItem>
                  <SelectItem value="ENFJ">ENFJ - The Protagonist</SelectItem>
                  <SelectItem value="ENFP">ENFP - The Campaigner</SelectItem>
                  <SelectItem value="ISTJ">ISTJ - The Logistician</SelectItem>
                  <SelectItem value="ISFJ">ISFJ - The Protector</SelectItem>
                  <SelectItem value="ESTJ">ESTJ - The Executive</SelectItem>
                  <SelectItem value="ESFJ">ESFJ - The Consul</SelectItem>
                  <SelectItem value="ISTP">ISTP - The Virtuoso</SelectItem>
                  <SelectItem value="ISFP">ISFP - The Adventurer</SelectItem>
                  <SelectItem value="ESTP">ESTP - The Entrepreneur</SelectItem>
                  <SelectItem value="ESFP">ESFP - The Entertainer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </OnboardingStep>
      );
    
    case 5:
      return (
        <OnboardingStep 
          title={t('onboarding.step5.title')} 
          description={t('onboarding.step5.description')} 
          onNext={nextStep} 
          onBack={prevStep} 
          canProceed={formData.photos.length > 0} 
          {...stepProps}
        >
          <div className="space-y-4">
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary'
              }`}
              onClick={() => document.getElementById('photo-upload')?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                {isDragging 
                  ? t('onboarding.step5.dropPhotos')
                  : formData.photos.length > 0 
                    ? `${formData.photos.length} photo(s) selected` 
                    : t('onboarding.step5.dragDrop')}
              </p>
              <Input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" id="photo-upload" />
              <Button type="button" variant="outline" className="w-full pointer-events-none">
                <Upload className="w-4 h-4 mr-2" />
                {t('onboarding.step5.selectPhotos')}
              </Button>
            </div>
            
            {formData.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {formData.photos.slice(0, 6).map((photo, index) => (
                  <div key={index} className="relative aspect-square group">
                    <img src={URL.createObjectURL(photo)} alt={`Upload ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity" 
                      onClick={e => {
                        e.stopPropagation();
                        const newPhotos = formData.photos.filter((_, i) => i !== index);
                        updateData('photos', newPhotos);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    {index === 0 && (
                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                        {t('onboarding.step5.main')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="bg-accent/10 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {t('onboarding.step5.tip')}
              </p>
            </div>
          </div>
        </OnboardingStep>
      );
    
    case 6:
      return (
        <OnboardingStep 
          title={t('onboarding.step6.title')} 
          description={t('onboarding.step6.description')} 
          onNext={nextStep} 
          onBack={prevStep} 
          isLastStep={true} 
          isSaving={isSaving} 
          canProceed={true} 
          {...stepProps}
        >
          <div className="text-center space-y-4">
            <div className="heart-logo mx-auto mb-6">
              <span className="logo-text">Ò</span>
            </div>
            <p className="text-lg font-medium">{t('onboarding.step6.ready')}</p>
            <p className="text-sm text-muted-foreground">
              {t('onboarding.step6.readyDescription')}
            </p>
          </div>
        </OnboardingStep>
      );
    
    default:
      return <div>{t('onboarding.errors.invalidStep')}</div>;
  }
};

export default Onboarding;
