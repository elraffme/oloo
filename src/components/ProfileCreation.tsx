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
import { useToast } from '@/components/ui/use-toast';
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
  
  const [profilePhotos, setProfilePhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showVerification, setShowVerification] = useState(false);
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

  const removeBackground = async (imageFile: File): Promise<Blob> => {
    try {
      // Load the image
      const img = new Image();
      const imageUrl = URL.createObjectURL(imageFile);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Initialize the background removal pipeline
      const segmenter = await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512');
      
      // Process the image
      const result = await segmenter(imageUrl);
      
      // Create canvas for processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw original image
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Apply mask (assuming first result is person segmentation)
      if (result && result.length > 0 && result[0].mask) {
        const mask = result[0].mask;
        for (let i = 0; i < mask.data.length; i++) {
          // Set alpha based on mask (keep person, remove background)
          const alpha = Math.round(mask.data[i] * 255);
          data[i * 4 + 3] = alpha;
        }
      }
      
      // Put processed image data back
      ctx.putImageData(imageData, 0, 0);
      
      // Convert to blob
      return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          URL.revokeObjectURL(imageUrl);
          if (blob) resolve(blob);
          else reject(new Error('Failed to create processed image'));
        }, 'image/png');
      });
    } catch (error) {
      // SECURITY: Proper error handling without exposing internal details
      // Return original file if background removal fails
      return imageFile;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || profilePhotos.length >= 6) return;

    setIsUploading(true);
    
    try {
      for (const file of files.slice(0, 6 - profilePhotos.length)) {
        if (!file.type.startsWith('image/')) continue;

        // Process image with background removal
        const processedImage = await removeBackground(file);
        
        // Convert to data URL for preview
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(processedImage);
        });

        setProfilePhotos(prev => [...prev, dataUrl]);
      }

      toast({
        title: "Photos uploaded",
        description: "Your photos have been processed and background removed.",
      });
    } catch (error) {
      // SECURITY: Don't expose internal errors to users
      toast({
        title: "Upload failed",
        description: "Unable to process photos. Please try again with different images.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setProfilePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleVerificationComplete = async (success: boolean, score?: number) => {
    setShowVerification(false);
    
    if (success) {
      toast({
        title: "Verification successful!",
        description: `Face verification completed with ${Math.round((score || 0) * 100)}% confidence.`,
      });
    } else {
      toast({
        title: "Verification skipped",
        description: "You can verify your profile later in settings.",
        variant: "destructive",
      });
    }
    
    // Continue to profile completion
    await submitProfile();
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
        languages: formData.languages,
        profile_photos: profilePhotos
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
    if (currentStep === 3 && profilePhotos.length > 0) {
      setShowVerification(true);
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  if (showVerification) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <FaceVerification 
          onVerificationComplete={handleVerificationComplete}
          profilePhotos={profilePhotos}
        />
      </div>
    );
  }

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
              {currentStep === 3 && "Photos"}
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

            {currentStep === 3 && (
              <PhotoUpload 
                profilePhotos={profilePhotos}
                onPhotosUpdate={setProfilePhotos}
                maxPhotos={6}
              />
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
              
              {currentStep < 3 ? (
                <Button
                  onClick={nextStep}
                  disabled={
                    (currentStep === 1 && (!formData.displayName || !formData.age || !formData.occupation)) ||
                    (currentStep === 2 && (!formData.bio || formData.interests.length === 0))
                  }
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={profilePhotos.length === 0 || isSubmitting}
                >
                  {isSubmitting ? 'Creating Profile...' : 'Complete Profile'}
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
