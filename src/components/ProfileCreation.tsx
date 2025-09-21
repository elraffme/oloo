import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Upload, X, Plus, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { pipeline, env } from '@huggingface/transformers';
import { FaceVerification } from './FaceVerification';
import { PhotoUpload } from './PhotoUpload';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false;

interface ProfileCreationProps {
  onComplete: () => void;
}

const ProfileCreation: React.FC<ProfileCreationProps> = ({ onComplete }) => {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    displayName: '',
    age: '',
    bio: '',
    occupation: '',
    education: '',
    heightFeet: '',
    heightInches: '',
    bodyType: '',
    interests: [] as string[],
    relationshipGoals: '',
    languages: [] as string[]
  });
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableInterests = [
    'Travel', 'Music', 'Dancing', 'Reading', 'Cooking', 'Fitness', 'Art', 'Photography',
    'Movies', 'Hiking', 'Swimming', 'Yoga', 'Gaming', 'Fashion', 'Technology', 'Volunteering',
    'Sports', 'Writing', 'Languages', 'Culture', 'History', 'Nature', 'Meditation', 'Comedy'
  ];

  const availableLanguages = [
    'English', 'French', 'Spanish', 'Swahili', 'Arabic', 'Yoruba', 'Igbo', 'Hausa',
    'Amharic', 'Zulu', 'Portuguese', 'Mandarin', 'Hindi', 'German', 'Italian'
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest].slice(0, 8) // Max 8 interests
    }));
  };

  const toggleLanguage = (language: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter(l => l !== language)
        : [...prev.languages, language]
    }));
  };


  const submitProfile = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    
    try {
      // Convert feet and inches to cm for storage
      const heightInCm = formData.heightFeet && formData.heightInches 
        ? Math.round((parseInt(formData.heightFeet) * 12 + parseInt(formData.heightInches)) * 2.54)
        : null;

      const profileData = {
        display_name: formData.displayName,
        age: parseInt(formData.age),
        bio: formData.bio,
        occupation: formData.occupation,
        education: formData.education,
        height_cm: heightInCm,
        body_type: formData.bodyType,
        interests: formData.interests,
        relationship_goals: formData.relationshipGoals,
        languages: formData.languages
      };

      const { error } = await updateProfile(profileData);
      
      if (error) throw error;

      toast({
        title: "Profile created!",
        description: "Welcome to Òloo! Your profile is now complete.",
      });
      
      onComplete();
    } catch (error: any) {
      // SECURITY: Don't expose internal errors to users
      toast({
        title: "Error creating profile",
        description: "Unable to create profile. Please check your information and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 2) {
      submitProfile();
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 2));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };


  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-afro-heading mb-2">Complete Your Profile</h1>
        </div>

        <Card className="cultural-card">
          <CardHeader>
            <CardTitle className="text-center">
              {currentStep === 1 && "Basic Information"}
              {currentStep === 2 && "About You"}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={formData.displayName}
                      onChange={(e) => handleInputChange('displayName', e.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      min="18"
                      max="100"
                      value={formData.age}
                      onChange={(e) => handleInputChange('age', e.target.value)}
                      placeholder="25"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    value={formData.occupation}
                    onChange={(e) => handleInputChange('occupation', e.target.value)}
                    placeholder="Software Engineer"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Height</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Input
                          type="number"
                          min="4"
                          max="7"
                          value={formData.heightFeet}
                          onChange={(e) => handleInputChange('heightFeet', e.target.value)}
                          placeholder="5"
                        />
                        <Label className="text-xs text-muted-foreground">Feet</Label>
                      </div>
                      <div>
                        <Input
                          type="number"
                          min="0"
                          max="11"
                          value={formData.heightInches}
                          onChange={(e) => handleInputChange('heightInches', e.target.value)}
                          placeholder="8"
                        />
                        <Label className="text-xs text-muted-foreground">Inches</Label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bodyType">Body Type</Label>
                    <Select onValueChange={(value) => handleInputChange('bodyType', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select body type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slim">Slim</SelectItem>
                        <SelectItem value="athletic">Athletic</SelectItem>
                        <SelectItem value="average">Average</SelectItem>
                        <SelectItem value="curvy">Curvy</SelectItem>
                        <SelectItem value="heavyset">Heavyset</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="education">Education</Label>
                  <Select onValueChange={(value) => handleInputChange('education', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select education level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high_school">High School</SelectItem>
                      <SelectItem value="university">University Degree</SelectItem>
                      <SelectItem value="masters">Master's Degree</SelectItem>
                      <SelectItem value="phd">PhD</SelectItem>
                      <SelectItem value="professional">Professional Certification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="bio">About You</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Tell others about yourself, your passions, and what you're looking for..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="relationshipGoals">Relationship Goals</Label>
                  <Select onValueChange={(value) => handleInputChange('relationshipGoals', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="What are you looking for?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serious_relationship">Serious relationship</SelectItem>
                      <SelectItem value="casual_dating">Casual dating</SelectItem>
                      <SelectItem value="friendship">Friendship first</SelectItem>
                      <SelectItem value="networking">Cultural networking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Interests (Select up to 8)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {availableInterests.map(interest => (
                      <Badge
                        key={interest}
                        variant={formData.interests.includes(interest) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleInterest(interest)}
                      >
                        {formData.interests.includes(interest) && <Check className="w-3 h-3 mr-1" />}
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Languages</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {availableLanguages.map(language => (
                      <Badge
                        key={language}
                        variant={formData.languages.includes(language) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleLanguage(language)}
                      >
                        {formData.languages.includes(language) && <Check className="w-3 h-3 mr-1" />}
                        {language}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}


            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                Previous
              </Button>
              
              {currentStep < 2 ? (
                <Button
                  onClick={nextStep}
                  disabled={
                    (currentStep === 1 && (!formData.displayName || !formData.age || !formData.occupation))
                  }
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={!formData.bio || !formData.relationshipGoals || formData.interests.length === 0 || formData.languages.length === 0 || isSubmitting}
                >
                  {isSubmitting ? "Creating Profile..." : "Complete Profile"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileCreation;
