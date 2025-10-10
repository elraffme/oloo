import { z } from 'zod';

/**
 * Security-Enhanced Input Validation Schemas
 * These schemas prevent injection attacks, data corruption, and business logic bypass
 */

// Profile validation schema
export const profileSchema = z.object({
  display_name: z.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  
  age: z.number()
    .int('Age must be a whole number')
    .min(18, 'You must be at least 18 years old')
    .max(100, 'Invalid age'),
  
  bio: z.string()
    .trim()
    .max(500, 'Bio must be less than 500 characters')
    .optional()
    .transform(val => val || ''),
  
  location: z.string()
    .trim()
    .min(3, 'Location must be at least 3 characters')
    .max(100, 'Location must be less than 100 characters')
    .regex(/^[a-zA-Z\s,'-]+$/, 'Invalid location format'),
  
  occupation: z.string()
    .trim()
    .max(100, 'Occupation must be less than 100 characters')
    .optional(),
  
  education: z.string()
    .trim()
    .max(100, 'Education must be less than 100 characters')
    .optional(),
  
  relationship_goals: z.string()
    .trim()
    .max(200, 'Relationship goals must be less than 200 characters')
    .optional(),
  
  interests: z.array(
    z.string()
      .trim()
      .min(1, 'Interest cannot be empty')
      .max(30, 'Interest must be less than 30 characters')
      .regex(/^[a-zA-Z0-9\s&-]+$/, 'Invalid characters in interest')
  )
    .max(10, 'Maximum 10 interests allowed')
    .optional()
    .default([]),
  
  height_cm: z.number()
    .int('Height must be a whole number')
    .min(120, 'Height must be at least 120cm')
    .max(250, 'Height must be less than 250cm')
    .optional()
    .nullable(),
  
  languages: z.array(z.string().trim().max(50))
    .max(5, 'Maximum 5 languages allowed')
    .optional()
    .default([]),
  
  profile_photos: z.array(z.string().url('Invalid photo URL'))
    .max(6, 'Maximum 6 photos allowed')
    .optional()
    .default([])
});

// Onboarding validation schema (step-by-step)
export const onboardingStep1Schema = z.object({
  termsAccepted: z.boolean().refine(val => val === true, 'You must accept the terms of service')
});

export const onboardingStep2Schema = z.object({
  display_name: profileSchema.shape.display_name,
  age: profileSchema.shape.age,
  location: profileSchema.shape.location,
  gender: z.string().refine(
    (val) => ['male', 'female', 'non-binary', 'other'].includes(val),
    { message: 'Please select a valid gender' }
  )
});

export const onboardingStep3Schema = z.object({
  height_cm: profileSchema.shape.height_cm,
  interests: profileSchema.shape.interests
});

export const onboardingStep4Schema = z.object({
  relationship_goals: profileSchema.shape.relationship_goals,
  occupation: profileSchema.shape.occupation.optional(),
  education: profileSchema.shape.education.optional()
});

export const onboardingStep5Schema = z.object({
  photos: z.array(z.instanceof(File))
    .min(1, 'At least 1 photo is required')
    .max(6, 'Maximum 6 photos allowed')
    .refine(
      files => files.every(file => file.size <= 10 * 1024 * 1024),
      'Each photo must be less than 10MB'
    )
    .refine(
      files => files.every(file => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)),
      'Only JPEG, PNG, and WebP images are allowed'
    ),
  bio: profileSchema.shape.bio
});

// Message validation schema
export const messageSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be less than 2000 characters'),
  
  receiver_id: z.string()
    .uuid('Invalid user ID')
});

// Search query validation
export const searchQuerySchema = z.string()
  .trim()
  .min(2, 'Search query must be at least 2 characters')
  .max(50, 'Search query must be less than 50 characters')
  .regex(/^[a-zA-Z0-9\s'-]+$/, 'Invalid characters in search query');

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate and sanitize user input
 */
export const validateAndSanitize = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } => {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return { 
        success: false, 
        error: firstError.message || 'Invalid input' 
      };
    }
    return { success: false, error: 'Validation failed' };
  }
};

// Type exports
export type ProfileFormData = z.infer<typeof profileSchema>;
export type MessageFormData = z.infer<typeof messageSchema>;
