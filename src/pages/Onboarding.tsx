import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, ArrowRight, Upload, MapPin, Users, Heart, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
          <Button onClick={onNext} disabled={!canProceed} className="flex-1 nsibidi-gradient text-primary-foreground">
            {isLastStep ? "Let's Start!" : "Continue"}
            {!isLastStep && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>;
const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    agreed: false,
    name: "",
    birthDate: "",
    gender: "",
    orientation: "",
    interestedIn: "",
    lookingFor: "",
    distance: [25],
    hobbies: "",
    personality: "",
    photos: [] as File[],
    location: false,
    blockContacts: false,
    nearbyStudents: false
  });
  const totalSteps = 15;
  const updateData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      navigate('/app');
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
      return <OnboardingStep title="What's your name?" description="This will be displayed on your profile" onNext={nextStep} onBack={prevStep} canProceed={formData.name.length >= 2} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <Label htmlFor="name" className="text-base">Username</Label>
            <Input id="name" value={formData.name} onChange={e => updateData('name', e.target.value)} placeholder="Enter your username" className="text-lg" />
          </div>
        </OnboardingStep>;
    case 3:
      return <OnboardingStep title="When's your birthday?" description="Your age will be public, but not your birthday" onNext={nextStep} onBack={prevStep} canProceed={formData.birthDate.length > 0} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <Label htmlFor="birthDate">Date of Birth (MM/DD/YYYY)</Label>
            <Input id="birthDate" type="date" value={formData.birthDate} onChange={e => updateData('birthDate', e.target.value)} />
          </div>
        </OnboardingStep>;
    case 4:
      return <OnboardingStep title="What's your gender?" onNext={nextStep} onBack={prevStep} canProceed={formData.gender.length > 0} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
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
        </OnboardingStep>;
    case 5:
      return <OnboardingStep title="Who are you interested in?" onNext={nextStep} onBack={prevStep} canProceed={formData.interestedIn.length > 0} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
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
        </OnboardingStep>;
    case 6:
      return <OnboardingStep title="Sexual Orientation" onNext={nextStep} onBack={prevStep} canProceed={formData.orientation.length > 0} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
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
        </OnboardingStep>;
    case 7:
      return <OnboardingStep title="What are you looking for?" onNext={nextStep} onBack={prevStep} canProceed={formData.lookingFor.length > 0} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <Label>Relationship Goals</Label>
            <Select value={formData.lookingFor} onValueChange={value => updateData('lookingFor', value)}>
              <SelectTrigger>
                <SelectValue placeholder="What you're looking for" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="long-term">Long-term relationship</SelectItem>
                <SelectItem value="short-term">Short-term dating</SelectItem>
                <SelectItem value="open-to-short">Open to short-term</SelectItem>
                <SelectItem value="open-to-long">Open to long-term</SelectItem>
                <SelectItem value="not-sure">Not really sure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </OnboardingStep>;
    case 8:
      return <OnboardingStep title="Distance Range" description="How far are you willing to travel for love?" onNext={nextStep} onBack={prevStep} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <Label>Maximum Distance: {formData.distance[0]} miles</Label>
            <Slider value={formData.distance} onValueChange={value => updateData('distance', value)} max={100} min={1} step={1} className="w-full" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>1 mi</span>
              <span>100+ mi</span>
            </div>
          </div>
        </OnboardingStep>;
    case 9:
      return <OnboardingStep title="Hobbies & Lifestyle" description="Tell us about your interests" onNext={nextStep} onBack={prevStep} canProceed={formData.hobbies.length > 10} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <Label htmlFor="hobbies">What do you enjoy doing?</Label>
            <Textarea id="hobbies" value={formData.hobbies} onChange={e => updateData('hobbies', e.target.value)} placeholder="Tell us about your hobbies, interests, and lifestyle..." className="min-h-24" />
          </div>
        </OnboardingStep>;
    case 10:
      return <OnboardingStep title="Personality Type" description="Help others understand your vibe" onNext={nextStep} onBack={prevStep} canProceed={formData.personality.length > 0} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <Label>Personality Type</Label>
            <Select value={formData.personality} onValueChange={value => updateData('personality', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTJ">INTJ - The Architect (Introverted, Intuitive, Thinking, Judging)</SelectItem>
                <SelectItem value="INTP">INTP - The Thinker (Introverted, Intuitive, Thinking, Perceiving)</SelectItem>
                <SelectItem value="ENTJ">ENTJ - The Commander (Extraverted, Intuitive, Thinking, Judging)</SelectItem>
                <SelectItem value="ENTP">ENTP - The Debater (Extraverted, Intuitive, Thinking, Perceiving)</SelectItem>
                <SelectItem value="INFJ">INFJ - The Advocate (Introverted, Intuitive, Feeling, Judging)</SelectItem>
                <SelectItem value="INFP">INFP - The Mediator (Introverted, Intuitive, Feeling, Perceiving)</SelectItem>
                <SelectItem value="ENFJ">ENFJ - The Protagonist (Extraverted, Intuitive, Feeling, Judging)</SelectItem>
                <SelectItem value="ENFP">ENFP - The Campaigner (Extraverted, Intuitive, Feeling, Perceiving)</SelectItem>
                <SelectItem value="ISTJ">ISTJ - The Logistician (Introverted, Sensing, Thinking, Judging)</SelectItem>
                <SelectItem value="ISFJ">ISFJ - The Protector (Introverted, Sensing, Feeling, Judging)</SelectItem>
                <SelectItem value="ESTJ">ESTJ - The Executive (Extraverted, Sensing, Thinking, Judging)</SelectItem>
                <SelectItem value="ESFJ">ESFJ - The Consul (Extraverted, Sensing, Feeling, Judging)</SelectItem>
                <SelectItem value="ISTP">ISTP - The Virtuoso (Introverted, Sensing, Thinking, Perceiving)</SelectItem>
                <SelectItem value="ISFP">ISFP - The Adventurer (Introverted, Sensing, Feeling, Perceiving)</SelectItem>
                <SelectItem value="ESTP">ESTP - The Entrepreneur (Extraverted, Sensing, Thinking, Perceiving)</SelectItem>
                <SelectItem value="ESFP">ESFP - The Entertainer (Extraverted, Sensing, Feeling, Perceiving)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </OnboardingStep>;
    case 11:
      return <OnboardingStep title="Add Photos" description="Show your best self! Add at least one photo" onNext={nextStep} onBack={prevStep} canProceed={formData.photos.length > 0} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors" onClick={() => document.getElementById('photo-upload')?.click()}>
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                {formData.photos.length > 0 ? `${formData.photos.length} photo(s) selected` : "Maximum of six photos"}
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
    case 12:
      return <OnboardingStep title="Location Settings" description="Help us show you people nearby" onNext={nextStep} onBack={prevStep} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="location" checked={formData.location} onCheckedChange={checked => updateData('location', checked)} />
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Enable location services
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              We'll use your location to show you potential matches nearby and help you discover local events.
            </p>
          </div>
        </OnboardingStep>;
    case 13:
      return <OnboardingStep title="Block Contacts" description="Prevent people from your contacts from finding you" onNext={nextStep} onBack={prevStep} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="blockContacts" checked={formData.blockContacts} onCheckedChange={checked => updateData('blockContacts', checked)} />
              <Label htmlFor="blockContacts">Block people from my contacts</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              This prevents people in your phone contacts from seeing your profile.
            </p>
          </div>
        </OnboardingStep>;
    case 14:
      return <OnboardingStep title="Oloo Insight" description="Let's show you how Òloo works" onNext={nextStep} onBack={prevStep} currentStep={step} totalSteps={totalSteps}>
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 romantic-gradient rounded-full flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-3xl">Ò</span>
              </div>
              <h3 className="font-semibold mb-2">Swipe to Connect</h3>
              <p className="text-sm text-muted-foreground">
                Swipe right to like someone, left to pass. If you both like each other, it's a match!
              </p>
            </div>
            <div className="bg-primary/10 p-4 rounded-lg">
              <p className="text-sm"><strong>Pro tip:</strong> Take your time to read profiles and find meaningful connections.</p>
            </div>
          </div>
        </OnboardingStep>;
    case 15:
      return <OnboardingStep title="You're All Set!" description="Welcome to Òloo - let's find your perfect match" onNext={nextStep} onBack={prevStep} isLastStep={true} currentStep={step} totalSteps={totalSteps}>
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