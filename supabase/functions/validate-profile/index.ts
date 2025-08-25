import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { profileData } = await req.json()

    // SECURITY: Server-side validation of profile data
    const validationErrors: string[] = []

    // Validate required fields
    if (!profileData.display_name || profileData.display_name.trim().length < 2) {
      validationErrors.push('Display name must be at least 2 characters')
    }

    if (!profileData.age || profileData.age < 18 || profileData.age > 100) {
      validationErrors.push('Age must be between 18 and 100')
    }

    if (!profileData.location || profileData.location.trim().length < 3) {
      validationErrors.push('Location must be at least 3 characters')
    }

    // Validate bio content (basic profanity and length check)
    if (profileData.bio) {
      if (profileData.bio.length > 500) {
        validationErrors.push('Bio must be less than 500 characters')
      }
      
      // Basic profanity filter
      const profanityWords = ['spam', 'scam', 'fake', 'bot']
      const bioLower = profileData.bio.toLowerCase()
      if (profanityWords.some(word => bioLower.includes(word))) {
        validationErrors.push('Bio contains inappropriate content')
      }
    }

    // Validate interests
    if (profileData.interests && profileData.interests.length > 8) {
      validationErrors.push('Maximum 8 interests allowed')
    }

    // Validate photo count
    if (profileData.profile_photos && profileData.profile_photos.length > 6) {
      validationErrors.push('Maximum 6 photos allowed')
    }

    // Validate height if provided
    if (profileData.height_cm && (profileData.height_cm < 140 || profileData.height_cm > 220)) {
      validationErrors.push('Height must be between 140-220 cm')
    }

    // Log security event
    await supabase.from('security_audit_log').insert({
      user_id: user.id,
      action: 'profile_validation',
      details: {
        validation_errors: validationErrors,
        profile_data_keys: Object.keys(profileData)
      }
    })

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          errors: validationErrors 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If validation passes, update the profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('user_id', user.id)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Profile updated successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Profile validation error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Profile validation failed' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})