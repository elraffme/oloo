import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, ArrowRight, Upload, MapPin, Users, Heart, X, CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  totalSteps
}: {
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
}) => <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
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
          {onBack && <Button variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>}
          <Button 
            onClick={onNext} 
            disabled={!canProceed || (isLastStep && isSaving)} 
            className="flex-1 nsibidi-gradient text-primary-foreground hover:opacity-90 transition-all duration-300 shadow-lg"
          >
            {isLastStep && isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Saving Profile...
              </>
            ) : isLastStep ? (
              <>
              Let's Start!
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>;
const Onboarding = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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

  const saveProfile = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to complete onboarding",
        variant: "destructive"
      });
      return false;
    }

    // Validate required fields
    if (!formData.name || !formData.birthDate || !formData.gender) {
      toast({
        title: "Missing Information",
        description: "Please complete all required fields",
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
          title: "Invalid Age",
          description: "You must be at least 18 years old",
          variant: "destructive"
        });
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
      
      // Prepare profile data
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
        location: 'Not specified'
      };
      
      console.log('Saving profile...', profileData);
      
      const { error } = await updateProfile(profileData);
      
      if (error) {
        console.error('Update profile error:', error);
        toast({
          title: "Error saving profile",
          description: error.message,
          variant: "destructive"
        });
        return false;
      }
      
      toast({
        title: "Profile created!",
        description: "Welcome to Òloo"
      });
      
      return true;
    } catch (error: any) {
      console.error('Profile save error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save profile. Please try again.",
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
      // Convert photos to base64 for localStorage
      const photoDataUrls = await Promise.all(
        formData.photos.map(photo => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(photo);
          });
        })
      );
      
      // Save to localStorage with base64 photos
      const dataToSave = {
        ...formData,
        photos: undefined, // Remove File objects
        photoDataUrls // Add base64 strings
      };
      localStorage.setItem('onboardingData', JSON.stringify(dataToSave));
      navigate('/auth');
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
  switch (step) {
    case 1:
      return <OnboardingStep title="Terms of Service" description="Please review and accept our terms" onNext={nextStep} canProceed={formData.agreed} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg max-h-32 overflow-y-auto text-sm">
              <p>Welcome to Òloo! By using our service, you agree to our terms of service and privacy policy. We prioritize your safety and cultural connections.</p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="agree" checked={formData.agreed} onCheckedChange={checked => updateData('agreed', checked)} />
              <Label htmlFor="agree" className="text-sm">I agree to the Terms of Service and Privacy Policy</Label>
            </div>
          </div>
        </OnboardingStep>;
    case 2:
      return <OnboardingStep title="Tell us about yourself" description="Basic information for your profile" onNext={nextStep} onBack={prevStep} canProceed={formData.name.length >= 2 && formData.birthDate.length > 0 && formData.gender.length > 0 && formData.orientation.length > 0} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-base">Username</Label>
              <Input id="name" value={formData.name} onChange={e => updateData('name', e.target.value)} placeholder="Enter your username" className="text-lg" />
              <p className="text-xs text-muted-foreground mt-1">Username will appear on profile</p>
            </div>
            <div>
              <Label htmlFor="birthDate">Date of Birth</Label>
              <Input 
                id="birthDate" 
                type="date"
                value={formData.birthDate} 
                onChange={e => updateData('birthDate', e.target.value)} 
                max={new Date().toISOString().split('T')[0]}
                min="1900-01-01"
                className="h-12"
              />
              <p className="text-xs text-muted-foreground mt-1">Your age will be public, but not your birthday</p>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={formData.gender} onValueChange={value => updateData('gender', value)}>
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
              <Label>Sexual Orientation</Label>
              <Select value={formData.orientation} onValueChange={value => updateData('orientation', value)}>
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
          </div>
        </OnboardingStep>;
    case 3:
      return <OnboardingStep title="Basic Information" description="A few more details about you" onNext={nextStep} onBack={prevStep} canProceed={formData.height.length > 0 && formData.bodyType.length > 0 && formData.education.length > 0 && formData.occupation.length > 0} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <div>
              <Label>Height</Label>
              <Select value={formData.height} onValueChange={value => updateData('height', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your height" />
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
              <Label>Body Type</Label>
              <Select value={formData.bodyType} onValueChange={value => updateData('bodyType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your body type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slim">Slim</SelectItem>
                  <SelectItem value="athletic">Athletic</SelectItem>
                  <SelectItem value="average">Average</SelectItem>
                  <SelectItem value="curvy">Curvy</SelectItem>
                  <SelectItem value="muscular">Muscular</SelectItem>
                  <SelectItem value="heavyset">Heavyset</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Education</Label>
              <Select value={formData.education} onValueChange={value => updateData('education', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your education level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high-school">High School</SelectItem>
                  <SelectItem value="some-college">Some College</SelectItem>
                  <SelectItem value="associates">Associate's Degree</SelectItem>
                  <SelectItem value="bachelors">Bachelor's Degree</SelectItem>
                  <SelectItem value="masters">Master's Degree</SelectItem>
                  <SelectItem value="phd">PhD/Doctorate</SelectItem>
                  <SelectItem value="trade">Trade School</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="occupation">Occupation</Label>
              <Input id="occupation" value={formData.occupation} onChange={e => updateData('occupation', e.target.value)} placeholder="What do you do?" />
            </div>
          </div>
        </OnboardingStep>;
    case 4:
      return <OnboardingStep title="Your Preferences" description="Tell us what you're looking for" onNext={nextStep} onBack={prevStep} canProceed={formData.interestedIn.length > 0 && formData.lookingFor.length > 0} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <div>
              <Label>Show me</Label>
              <Select value={formData.interestedIn} onValueChange={value => updateData('interestedIn', value)}>
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
              <Label>Relationship Goals</Label>
              <Select value={formData.lookingFor} onValueChange={value => updateData('lookingFor', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="What you're looking for" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long-term">Long-term relationship</SelectItem>
                  <SelectItem value="marriage">Marriage</SelectItem>
                  <SelectItem value="life-partner">Life partner</SelectItem>
                  <SelectItem value="short-term">Short-term dating</SelectItem>
                  <SelectItem value="casual">Something casual</SelectItem>
                  <SelectItem value="friendship">New friends</SelectItem>
                  <SelectItem value="open-to-short">Open to short-term</SelectItem>
                  <SelectItem value="open-to-long">Open to long-term</SelectItem>
                  <SelectItem value="figuring-out">Figuring it out</SelectItem>
                  <SelectItem value="not-sure">Not really sure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="hobbies">Hobbies & Lifestyle</Label>
              <Textarea id="hobbies" value={formData.hobbies} onChange={e => updateData('hobbies', e.target.value)} placeholder="Tell us about your hobbies, interests, and lifestyle..." className="min-h-24" />
            </div>
            <div>
              <Label>Personality Type</Label>
              <Select value={formData.personality} onValueChange={value => updateData('personality', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
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
        </OnboardingStep>;
    case 5:
      return <OnboardingStep title="Add Photos" description="Show your best self! Add at least one photo" onNext={nextStep} onBack={prevStep} canProceed={formData.photos.length > 0} currentStep={step} totalSteps={totalSteps}>
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
                  ? "Drop your photos here" 
                  : formData.photos.length > 0 
                    ? `${formData.photos.length} photo(s) selected` 
                    : "Drag & drop or click to upload (max 6 photos)"}
              </p>
              <Input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" id="photo-upload" />
              <Button type="button" variant="outline" className="w-full pointer-events-none">
                <Upload className="w-4 h-4 mr-2" />
                Select Photos
              </Button>
            </div>
            
            {formData.photos.length > 0 && <div className="grid grid-cols-3 gap-2">
                {formData.photos.slice(0, 6).map((photo, index) => <div key={index} className="relative aspect-square group">
                    <img src={URL.createObjectURL(photo)} alt={`Upload ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                    <Button size="sm" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => {
                e.stopPropagation();
                const newPhotos = formData.photos.filter((_, i) => i !== index);
                updateData('photos', newPhotos);
              }}>
                      <X className="h-3 w-3" />
                    </Button>
                    {index === 0 && <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                        Main
                      </div>}
                  </div>)}
              </div>}
            
            <div className="bg-accent/10 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                💡 <strong>Tip:</strong> Your first photo will be your main profile picture. Add multiple angles and genuine smiles!
              </p>
            </div>
          </div>
        </OnboardingStep>;
    case 6:
      return <OnboardingStep title="You're All Set!" description="Welcome to Òloo - let's find your perfect match" onNext={nextStep} onBack={prevStep} isLastStep={true} isSaving={isSaving} currentStep={step} totalSteps={totalSteps}>
          <div className="text-center space-y-4">
            <div className="heart-logo mx-auto mb-6">
              <span className="logo-text">Ò</span>
            </div>
            <p className="text-lg font-medium">Ready to start your journey?</p>
            <p className="text-sm text-muted-foreground">
              Your profile is complete and you're ready to discover amazing people who share your culture and values.
            </p>
          </div>
        </OnboardingStep>;
    default:
      return <div>Error: Invalid step</div>;
  }
};
export default Onboarding;