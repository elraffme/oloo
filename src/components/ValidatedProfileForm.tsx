/**
 * Validated Profile Form Component
 * Implements comprehensive input validation to prevent injection attacks
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { profileSchema, validateAndSanitize } from '@/lib/validation';
import { AlertCircle } from 'lucide-react';
import { z } from 'zod';

interface ValidatedProfileFormProps {
  initialData?: any;
  onSave: (data: any) => Promise<void>;
  onCancel?: () => void;
}

export const ValidatedProfileForm: React.FC<ValidatedProfileFormProps> = ({
  initialData = {},
  onSave,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    display_name: initialData.display_name || '',
    age: initialData.age || 18,
    location: initialData.location || '',
    bio: initialData.bio || '',
    occupation: initialData.occupation || '',
    education: initialData.education || '',
    relationship_goals: initialData.relationship_goals || '',
    interests: initialData.interests || [],
    height_cm: initialData.height_cm || null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newInterest, setNewInterest] = useState('');
  const [saving, setSaving] = useState(false);

  const validateField = (field: string, value: any) => {
    try {
      // Create a partial schema for single field validation
      const fieldSchema = profileSchema.pick({ [field]: true } as any);
      fieldSchema.parse({ [field]: value });
      
      // Clear error if validation passes
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
      
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({
          ...prev,
          [field]: error.issues[0].message
        }));
      }
      return false;
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    validateField(field, value);
  };

  const handleAddInterest = () => {
    const trimmed = newInterest.trim();
    
    if (!trimmed) return;
    
    if (formData.interests.length >= 10) {
      setErrors(prev => ({ ...prev, interests: 'Maximum 10 interests allowed' }));
      return;
    }
    
    if (trimmed.length > 30) {
      setErrors(prev => ({ ...prev, interests: 'Interest must be less than 30 characters' }));
      return;
    }
    
    if (!/^[a-zA-Z0-9\s&-]+$/.test(trimmed)) {
      setErrors(prev => ({ ...prev, interests: 'Interest contains invalid characters' }));
      return;
    }
    
    if (formData.interests.includes(trimmed)) {
      setErrors(prev => ({ ...prev, interests: 'Interest already added' }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      interests: [...prev.interests, trimmed]
    }));
    setNewInterest('');
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.interests;
      return newErrors;
    });
  };

  const handleRemoveInterest = (index: number) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter((_: any, i: number) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    // Validate entire form
    const result = validateAndSanitize(profileSchema, formData);
    
    if (!result.success) {
      setErrors({ general: (result as any).error });
      return;
    }
    
    setSaving(true);
    try {
      await onSave(result.data);
    } catch (error) {
      setErrors({ general: 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {errors.general && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.general}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="display_name">Display Name *</Label>
        <Input
          id="display_name"
          value={formData.display_name}
          onChange={(e) => handleFieldChange('display_name', e.target.value)}
          placeholder="Your display name"
          maxLength={50}
          className={errors.display_name ? 'border-destructive' : ''}
        />
        {errors.display_name && (
          <p className="text-sm text-destructive mt-1">{errors.display_name}</p>
        )}
      </div>

      <div>
        <Label htmlFor="age">Age *</Label>
        <Input
          id="age"
          type="number"
          value={formData.age}
          onChange={(e) => handleFieldChange('age', parseInt(e.target.value) || 18)}
          min="18"
          max="100"
          className={errors.age ? 'border-destructive' : ''}
        />
        {errors.age && (
          <p className="text-sm text-destructive mt-1">{errors.age}</p>
        )}
      </div>

      <div>
        <Label htmlFor="location">Location *</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => handleFieldChange('location', e.target.value)}
          placeholder="City, Country"
          maxLength={100}
          className={errors.location ? 'border-destructive' : ''}
        />
        {errors.location && (
          <p className="text-sm text-destructive mt-1">{errors.location}</p>
        )}
      </div>

      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => handleFieldChange('bio', e.target.value)}
          placeholder="Tell us about yourself..."
          rows={4}
          maxLength={500}
          className={errors.bio ? 'border-destructive' : ''}
        />
        <div className="flex justify-between items-center mt-1">
          {errors.bio ? (
            <p className="text-sm text-destructive">{errors.bio}</p>
          ) : (
            <span className="text-xs text-muted-foreground">
              {formData.bio.length}/500 characters
            </span>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="occupation">Occupation</Label>
        <Input
          id="occupation"
          value={formData.occupation}
          onChange={(e) => handleFieldChange('occupation', e.target.value)}
          placeholder="Your occupation"
          maxLength={100}
          className={errors.occupation ? 'border-destructive' : ''}
        />
      </div>

      <div>
        <Label htmlFor="education">Education</Label>
        <Input
          id="education"
          value={formData.education}
          onChange={(e) => handleFieldChange('education', e.target.value)}
          placeholder="Your education"
          maxLength={100}
          className={errors.education ? 'border-destructive' : ''}
        />
      </div>

      <div>
        <Label htmlFor="relationship_goals">Relationship Goals</Label>
        <Input
          id="relationship_goals"
          value={formData.relationship_goals}
          onChange={(e) => handleFieldChange('relationship_goals', e.target.value)}
          placeholder="What are you looking for?"
          maxLength={200}
          className={errors.relationship_goals ? 'border-destructive' : ''}
        />
      </div>

      <div>
        <Label>Interests (max 10)</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.interests.map((interest: string, index: number) => (
            <Badge
              key={index}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => handleRemoveInterest(index)}
            >
              {interest} ×
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddInterest();
              }
            }}
            placeholder="Add interest and press Enter"
            maxLength={30}
          />
          <Button type="button" onClick={handleAddInterest} variant="outline">
            Add
          </Button>
        </div>
        {errors.interests && (
          <p className="text-sm text-destructive mt-1">{errors.interests}</p>
        )}
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={saving} className="flex-1">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};
