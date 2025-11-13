-- Create social_interactions table for casual interactions
CREATE TABLE social_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('wave', 'wink', 'icebreaker')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT different_users CHECK (from_user_id <> to_user_id)
);

-- Create indexes for performance
CREATE INDEX idx_social_interactions_to_user ON social_interactions(to_user_id, created_at DESC);
CREATE INDEX idx_social_interactions_from_user ON social_interactions(from_user_id, created_at DESC);
CREATE INDEX idx_social_interactions_unread ON social_interactions(to_user_id, read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE social_interactions ENABLE ROW LEVEL SECURITY;

-- Users can send interactions to others
CREATE POLICY "Users can send social interactions"
  ON social_interactions
  FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id 
    AND from_user_id <> to_user_id
  );

-- Users can view interactions they sent or received
CREATE POLICY "Users can view their social interactions"
  ON social_interactions
  FOR SELECT
  USING (
    auth.uid() = from_user_id 
    OR auth.uid() = to_user_id
  );

-- Users can mark received interactions as read
CREATE POLICY "Users can mark received interactions as read"
  ON social_interactions
  FOR UPDATE
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE social_interactions;