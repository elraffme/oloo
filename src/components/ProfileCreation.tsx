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
const ProfileCreation: React.FC<ProfileCreationProps> = ({
  onComplete
}) => {
  const {
    user,
    updateProfile
  } = useAuth();
  const {
    toast
  } = useToast();
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
  const availableInterests = ['Travel', 'Music', 'Dancing', 'Reading', 'Cooking', 'Fitness', 'Art', 'Photography', 'Movies', 'Hiking', 'Swimming', 'Yoga', 'Gaming', 'Fashion', 'Technology', 'Volunteering', 'Sports', 'Writing', 'Languages', 'Culture', 'History', 'Nature', 'Meditation', 'Comedy'];
  const availableLanguages = ['English', 'French', 'Spanish', 'Swahili', 'Arabic', 'Yoruba', 'Igbo', 'Hausa', 'Amharic', 'Zulu', 'Portuguese', 'Mandarin', 'Hindi', 'German', 'Italian'];
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest) ? prev.interests.filter(i => i !== interest) : [...prev.interests, interest].slice(0, 8) // Max 8 interests
    }));
  };
  const toggleLanguage = (language: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(language) ? prev.languages.filter(l => l !== language) : [...prev.languages, language]
    }));
  };
  const submitProfile = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      // Convert feet and inches to cm for storage
      const heightInCm = formData.heightFeet && formData.heightInches ? Math.round((parseInt(formData.heightFeet) * 12 + parseInt(formData.heightInches)) * 2.54) : null;
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
      const {
        error
      } = await updateProfile(profileData);
      if (error) throw error;
      toast({
        title: "Profile created!",
        description: "Welcome to Òloo! Your profile is now complete."
      });
      onComplete();
    } catch (error: any) {
      // SECURITY: Don't expose internal errors to users
      toast({
        title: "Error creating profile",
        description: "Unable to create profile. Please check your information and try again.",
        variant: "destructive"
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
  return <div>Profile Creation Component</div>;
};
export default ProfileCreation;