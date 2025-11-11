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
    // Initialize Supabase client with service role for secure operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // Get user from auth header for user operations
    let user = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
      
      if (authError) {
        console.error('Auth error:', authError)
        throw new Error(`Authentication failed: ${authError.message}`)
      }
      
      user = authUser
      console.log('User authenticated:', user?.id)
    } else {
      console.log('No authorization header found')
    }

    const { operation, paymentIntentId, paymentData } = await req.json()

    // Validate operation type
    const validOperations = ['create', 'update_status', 'retrieve', 'webhook_update']
    if (!validOperations.includes(operation)) {
      throw new Error(`Invalid operation type: ${operation}`)
    }

    // SECURITY: Validate user permissions for each operation
    switch (operation) {
      case 'create':
        if (!user) {
          throw new Error('Authentication required for payment creation')
        }
        // Validate payment amount limits
        if (paymentData?.amount_cents && paymentData?.tier) {
          const { data: isValidAmount } = await supabase.rpc('validate_payment_amount', {
            amount_cents: paymentData.amount_cents,
            tier: paymentData.tier
          })
          if (!isValidAmount) {
            throw new Error('Payment amount exceeds tier limits')
          }
        }
        // Ensure user can only create payments for themselves
        paymentData.user_id = user.id
        break

      case 'retrieve':
        if (!user && operation !== 'webhook_update') {
          throw new Error('Authentication required for payment retrieval')
        }
        break

      case 'webhook_update':
        // Only allow webhook updates from service operations (no user auth)
        if (user) {
          throw new Error('Webhook operations not allowed with user authentication')
        }
        break

      case 'update_status':
        if (!user && !paymentIntentId) {
          throw new Error('Authentication or webhook context required for status updates')
        }
        break
    }

    // Execute secure payment operation
    const { data: result, error } = await supabase.rpc('secure_payment_operation', {
      operation_type: operation,
      payment_intent_id: paymentIntentId,
      payment_data: paymentData || {}
    })

    if (error) {
      console.error('Payment operation error:', error)
      throw new Error(`Payment operation failed: ${error.message}`)
    }

    // Log successful operation
    console.log(`Secure payment operation completed:`, {
      operation,
      paymentIntentId,
      userId: user?.id || 'service',
      timestamp: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        operation: operation
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Secure payment function error:', error)
    
    // SECURITY: Don't expose internal error details to clients
    const userFriendlyMessage = error.message.includes('Authentication required') ||
                               error.message.includes('exceeds tier limits') ||
                               error.message.includes('Invalid operation type')
                               ? error.message
                               : 'Payment operation failed. Please try again.'
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: userFriendlyMessage
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})