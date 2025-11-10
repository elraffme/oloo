-- Helper function to check if users can call each other (create first)
CREATE OR REPLACE FUNCTION public.can_user_call(caller_uuid uuid, receiver_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if users are matched or friends
  RETURN EXISTS (
    -- Check for mutual likes (matches)
    SELECT 1 FROM user_connections uc1
    WHERE uc1.user_id = caller_uuid 
      AND uc1.connected_user_id = receiver_uuid 
      AND uc1.connection_type = 'like'
      AND EXISTS (
        SELECT 1 FROM user_connections uc2
        WHERE uc2.user_id = receiver_uuid 
          AND uc2.connected_user_id = caller_uuid 
          AND uc2.connection_type = 'like'
      )
  ) OR EXISTS (
    -- Check for friends
    SELECT 1 FROM user_connections
    WHERE user_id = caller_uuid 
      AND connected_user_id = receiver_uuid 
      AND connection_type = 'friend'
  );
END;
$$;

-- Create video_calls table for call tracking
CREATE TABLE public.video_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text UNIQUE NOT NULL,
  caller_id uuid REFERENCES auth.users(id) NOT NULL,
  receiver_id uuid REFERENCES auth.users(id) NOT NULL,
  status text NOT NULL CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'rejected', 'cancelled')),
  call_type text NOT NULL CHECK (call_type IN ('video', 'audio')),
  started_at timestamptz DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_calls ENABLE ROW LEVEL SECURITY;

-- Users can view calls they're part of
CREATE POLICY "Users can view their calls"
ON public.video_calls
FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Users can create calls
CREATE POLICY "Users can create calls"
ON public.video_calls
FOR INSERT
WITH CHECK (
  auth.uid() = caller_id 
  AND can_user_call(caller_id, receiver_id)
);

-- Users can update calls they're part of
CREATE POLICY "Users can update their calls"
ON public.video_calls
FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id)
WITH CHECK (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Helper function to create video call with permission check
CREATE OR REPLACE FUNCTION public.create_video_call(
  p_receiver_id uuid, 
  p_call_type text,
  p_call_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_call_id uuid;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  
  -- Check permissions
  IF NOT can_user_call(v_caller_id, p_receiver_id) THEN
    RAISE EXCEPTION 'You can only call matched users or friends';
  END IF;
  
  -- Create call record
  INSERT INTO public.video_calls (
    call_id,
    caller_id,
    receiver_id,
    status,
    call_type
  ) VALUES (
    p_call_id,
    v_caller_id,
    p_receiver_id,
    'ringing',
    p_call_type
  ) RETURNING id INTO v_call_id;
  
  -- Log the call creation
  PERFORM log_security_event(
    'video_call_initiated',
    'video_calls',
    v_call_id,
    jsonb_build_object(
      'caller_id', v_caller_id,
      'receiver_id', p_receiver_id,
      'call_type', p_call_type
    )
  );
  
  RETURN v_call_id;
END;
$$;

-- Add indexes for performance
CREATE INDEX idx_video_calls_caller ON public.video_calls(caller_id);
CREATE INDEX idx_video_calls_receiver ON public.video_calls(receiver_id);
CREATE INDEX idx_video_calls_status ON public.video_calls(status);
CREATE INDEX idx_video_calls_created_at ON public.video_calls(created_at DESC);