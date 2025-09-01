import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, ArrowRight, Upload, MapPin, Users, Heart, X, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';

const OnboardingStep = ({ 
  title, 
  description, 
  children, 
  onNext, 
  onBack, 
  canProceed = true,
  isLastStep = false,
  currentStep,
  totalSteps 
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  canProceed?: boolean;
  isLastStep?: boolean;
  currentStep: number;
  totalSteps: number;
}) => (
  <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
    <Card className="w-full max-w-md cultural-card">
      <CardHeader className="text-center">
        <div className="w-full bg-secondary rounded-full h-2 mb-4">
          <div 
            className="nsibidi-gradient h-2 rounded-full transition-all duration-500"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
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
              Back
            </Button>
          )}
          <Button 
            onClick={onNext} 
            disabled={!canProceed}
            className="flex-1 nsibidi-gradient text-primary-foreground"
          >
            {isLastStep ? "Let's Start!" : "Continue"}
            {!isLastStep && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

const Onboarding = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Account creation fields
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
    videoVerificationConsent: false,
    // Profile fields
    name: "",
    birthDate: "",
    gender: "",
    orientation: "",
    interestedIn: "",
    lookingFor: "",
    distance: [25],
    heightFeet: "",
    heightInches: "",
    hobbies: "",
    photos: [] as File[],
    location: "",
    occupation: "",
    education: ""
  });

  const totalSteps = 7;

  const updateData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = async () => {
    if (step === 1 && formData.acceptTerms && formData.email && formData.password) {
      // Handle account creation on step 1
      if (formData.password !== formData.confirmPassword) {
        alert('Passwords do not match');
        return;
      }

      setIsSubmitting(true);
      try {
        const metadata = {
          onboarding_step: 'account_created'
        };

        const result = await signUp(formData.email, formData.password, metadata);
        
        if (result.error) {
          alert(result.error.message);
          setIsSubmitting(false);
          return;
        }
      } catch (error) {
        console.error('Signup error:', error);
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      navigate('/discover');
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      updateData('photos', [...formData.photos, ...files]);
    }
  };

  switch (step) {
    case 1:
      return (
        <OnboardingStep
          title="Create Your Account"
          description="Join Òloo - where culture meets connection"
          onNext={nextStep}
          canProceed={formData.email && formData.password && formData.confirmPassword && formData.acceptTerms && !isSubmitting}
          currentStep={step}
          totalSteps={totalSteps}
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateData('email', e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>

            <div className="relative">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => updateData('password', e.target.value)}
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
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => updateData('confirmPassword', e.target.value)}
                placeholder="Confirm your password"
                required
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="acceptTerms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => updateData('acceptTerms', checked)}
                />
                <Label htmlFor="acceptTerms" className="text-sm leading-relaxed">
                  I accept the <span className="text-primary underline">Terms of Service</span> and{' '}
                  <span className="text-primary underline">Privacy Policy</span>
                </Label>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="videoVerificationConsent"
                  checked={formData.videoVerificationConsent}
                  onCheckedChange={(checked) => updateData('videoVerificationConsent', checked)}
                />
                <Label htmlFor="videoVerificationConsent" className="text-sm leading-relaxed">
                  <span className="text-orange-500">Optional:</span> I consent to video verification for enhanced trust and safety
                </Label>
              </div>
            </div>
          </div>
        </OnboardingStep>
      );

    case 2:
      return (
        <OnboardingStep
          title="Tell us about yourself"
          description="Basic information for your profile"
          onNext={nextStep}
          onBack={prevStep}
          canProceed={formData.name.length >= 2 && formData.birthDate.length > 0 && formData.gender.length > 0 && formData.location.length > 0}
          currentStep={step}
          totalSteps={totalSteps}
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">First Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateData('name', e.target.value)}
                placeholder="Enter your first name"
                className="text-lg"
              />
            </div>
            
            <div>
              <Label htmlFor="birthDate">Date of Birth</Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => updateData('birthDate', e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Your age will be public, but not your birthday</p>
            </div>
            
            <div>
              <Label>Gender</Label>
              <Select value={formData.gender} onValueChange={(value) => updateData('gender', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="man">Man</SelectItem>
                  <SelectItem value="woman">Woman</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => updateData('location', e.target.value)}
                placeholder="Lagos, Nigeria"
                required
              />
            </div>
          </div>
        </OnboardingStep>
      );

    case 3:
      return (
        <OnboardingStep
          title="Dating preferences"
          description="Help us find your perfect match"
          onNext={nextStep}
          onBack={prevStep}
          canProceed={formData.orientation.length > 0 && formData.interestedIn.length > 0 && formData.lookingFor.length > 0}
          currentStep={step}
          totalSteps={totalSteps}
        >
          <div className="space-y-4">
            <div>
              <Label>Sexual Orientation</Label>
              <Select value={formData.orientation} onValueChange={(value) => updateData('orientation', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your orientation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight">Straight</SelectItem>
                  <SelectItem value="gay">Gay</SelectItem>
                  <SelectItem value="lesbian">Lesbian</SelectItem>
                  <SelectItem value="bisexual">Bisexual</SelectItem>
                  <SelectItem value="pansexual">Pansexual</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Show me</Label>
              <Select value={formData.interestedIn} onValueChange={(value) => updateData('interestedIn', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Who you're interested in" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="men">Men</SelectItem>
                  <SelectItem value="women">Women</SelectItem>
                  <SelectItem value="everyone">Everyone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>What are you looking for?</Label>
              <Select value={formData.lookingFor} onValueChange={(value) => updateData('lookingFor', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Relationship goals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long-term">Long-term relationship</SelectItem>
                  <SelectItem value="open-to-short">Open to short-term</SelectItem>
                  <SelectItem value="short-term">Short-term dating</SelectItem>
                  <SelectItem value="open-to-long">Open to long-term</SelectItem>
                  <SelectItem value="not-sure">Not really sure</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </OnboardingStep>
      );

    case 4:
      return (
        <OnboardingStep
          title="Your preferences"
          description="Height, distance, and interests"
          onNext={nextStep}
          onBack={prevStep}
          canProceed={formData.hobbies.length > 10}
          currentStep={step}
          totalSteps={totalSteps}
        >
          <div className="space-y-4">
            <div>
              <Label>Height</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min="4"
                    max="7"
                    value={formData.heightFeet}
                    onChange={(e) => updateData('heightFeet', e.target.value)}
                    placeholder="Feet"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    min="0"
                    max="11"
                    value={formData.heightInches}
                    onChange={(e) => updateData('heightInches', e.target.value)}
                    placeholder="Inches"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <Label>Maximum Distance: {formData.distance[0]} miles</Label>
              <Slider
                value={formData.distance}
                onValueChange={(value) => updateData('distance', value)}
                max={100}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>1 mi</span>
                <span>100+ mi</span>
              </div>
            </div>
            
            <div>
              <Label htmlFor="hobbies">What do you enjoy doing?</Label>
              <Textarea
                id="hobbies"
                value={formData.hobbies}
                onChange={(e) => updateData('hobbies', e.target.value)}
                placeholder="Tell us about your hobbies, interests, and lifestyle..."
                className="min-h-24"
              />
            </div>
          </div>
        </OnboardingStep>
      );

    case 5:
      return (
        <OnboardingStep
          title="Add Photos"
          description="Show your best self! Add at least one photo"
          onNext={nextStep}
          onBack={prevStep}
          canProceed={formData.photos.length > 0}
          currentStep={step}
          totalSteps={totalSteps}
        >
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => document.getElementById('photo-upload')?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                {formData.photos.length > 0 
                  ? `${formData.photos.length} photo(s) selected` 
                  : "Add at least 2 photos (max 6)"
                }
              </p>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="photo-upload"
              />
              <Button type="button" variant="outline" className="w-full pointer-events-none">
                <Upload className="w-4 h-4 mr-2" />
                Select Photos
              </Button>
            </div>
            
            {formData.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {formData.photos.slice(0, 6).map((photo, index) => (
                  <div key={index} className="relative aspect-square group">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newPhotos = formData.photos.filter((_, i) => i !== index);
                        updateData('photos', newPhotos);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    {index === 0 && (
                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                        Main
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="bg-accent/10 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                💡 <strong>Tip:</strong> Your first photo will be your main profile picture. Add multiple angles and genuine smiles!
              </p>
            </div>
          </div>
        </OnboardingStep>
      );

    case 6:
      return (
        <OnboardingStep
          title="Complete Your Profile"
          description="Add your display name, occupation, and education"
          onNext={nextStep}
          onBack={prevStep}
          canProceed={true}
          currentStep={step}
          totalSteps={totalSteps}
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="displayName">Display Name (Optional)</Label>
              <Input
                id="displayName"
                value={formData.name}
                onChange={(e) => updateData('name', e.target.value)}
                placeholder="How should others see your name?"
              />
            </div>
            
            <div>
              <Label htmlFor="occupation">Occupation (Optional)</Label>
              <Input
                id="occupation"
                value={formData.occupation || ""}
                onChange={(e) => updateData('occupation', e.target.value)}
                placeholder="Software Engineer, Teacher, etc."
              />
            </div>
            
            <div>
              <Label htmlFor="education">Education (Optional)</Label>
              <Input
                id="education"
                value={formData.education || ""}
                onChange={(e) => updateData('education', e.target.value)}
                placeholder="University of Lagos, High School, etc."
              />
            </div>
          </div>
        </OnboardingStep>
      );

    case 7:
      return (
        <OnboardingStep
          title="You're All Set!"
          description="Welcome to Òloo - let's find your perfect match"
          onNext={nextStep}
          onBack={prevStep}
          isLastStep={true}
          currentStep={step}
          totalSteps={totalSteps}
        >
          <div className="text-center space-y-4">
            <div className="heart-logo mx-auto mb-6">
              <span className="logo-text">Ò</span>
            </div>
            <p className="text-lg font-medium">Ready to start your journey?</p>
            <p className="text-sm text-muted-foreground">
              Your profile is complete and you're ready to discover amazing people who share your culture and values.
            </p>
            {formData.videoVerificationConsent && (
              <p className="text-sm text-orange-500 font-medium">
                💡 You can complete video verification later for enhanced trust
              </p>
            )}
          </div>
        </OnboardingStep>
      );

    default:
      return <div>Error: Invalid step</div>;
  }
};

export default Onboarding;