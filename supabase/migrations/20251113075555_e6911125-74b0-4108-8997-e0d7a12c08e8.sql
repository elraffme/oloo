-- Create achievements table
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('social', 'streaming', 'engagement', 'special', 'coins')),
  tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'legendary')) DEFAULT 'bronze',
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL,
  coin_reward INTEGER DEFAULT 0,
  is_hidden BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Everyone can view achievements
CREATE POLICY "Anyone can view achievements"
  ON achievements
  FOR SELECT
  USING (true);

-- Insert achievement definitions
INSERT INTO achievements (id, name, description, icon, category, tier, requirement_type, requirement_value, coin_reward, display_order) VALUES
  -- Social Achievements
  ('social_butterfly', 'Social Butterfly', 'Send 50+ social interactions (waves, winks, icebreakers)', '🦋', 'social', 'silver', 'social_interactions', 50, 25, 1),
  ('heart_throb', 'Heart Throb', 'Receive 100+ profile views', '💗', 'social', 'gold', 'profile_views', 100, 50, 2),
  ('super_connector', 'Super Connector', 'Make 25+ friends', '🤝', 'social', 'gold', 'friends', 25, 40, 3),
  ('icebreaker_pro', 'Icebreaker Pro', 'Send 20+ icebreaker messages', '❄️', 'social', 'bronze', 'icebreakers', 20, 15, 4),
  ('wave_master', 'Wave Master', 'Send 30+ waves to other users', '👋', 'social', 'bronze', 'waves', 30, 10, 5),
  
  -- Streaming Achievements
  ('live_legend', 'Live Legend', 'Host 10+ live streams', '🎥', 'streaming', 'gold', 'streams_hosted', 10, 60, 10),
  ('star_streamer', 'Star Streamer', 'Get 500+ total stream viewers', '⭐', 'streaming', 'platinum', 'total_viewers', 500, 100, 11),
  ('stream_starter', 'Stream Starter', 'Host your first live stream', '🎬', 'streaming', 'bronze', 'streams_hosted', 1, 10, 12),
  
  -- Engagement Achievements
  ('chatterbox', 'Chatterbox', 'Send 100+ messages', '💬', 'engagement', 'silver', 'messages_sent', 100, 30, 20),
  ('gift_giver', 'Generous Soul', 'Send 15+ gifts to others', '🎁', 'engagement', 'gold', 'gifts_sent', 15, 40, 21),
  ('meet_me_champion', 'Meet Me Champion', 'Play Meet Me game 100+ times', '⚡', 'engagement', 'silver', 'meet_me_plays', 100, 35, 22),
  ('streak_master', 'Streak Master', 'Achieve a 7-day Meet Me streak', '🔥', 'engagement', 'gold', 'meet_me_streak', 7, 50, 23),
  
  -- Special Achievements  
  ('early_bird', 'Early Bird', 'Join in the first 1000 users', '🐣', 'special', 'legendary', 'user_number', 1000, 100, 30),
  ('verified_user', 'Verified User', 'Complete profile verification', '✓', 'special', 'silver', 'verified', 1, 20, 31),
  ('profile_perfectionist', 'Profile Perfectionist', 'Fill out 100% of profile fields', '💯', 'special', 'bronze', 'profile_complete', 1, 15, 32),
  
  -- Coin Achievements
  ('coin_collector', 'Coin Collector', 'Earn 500+ coins', '🪙', 'coins', 'silver', 'coins_earned', 500, 50, 40),
  ('coin_master', 'Coin Master', 'Earn 1000+ coins', '💰', 'coins', 'gold', 'coins_earned', 1000, 100, 41);

-- Create user_achievements table
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  progress INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, achievement_id)
);

-- Create indexes
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_unlocked ON user_achievements(user_id, unlocked_at DESC);
CREATE INDEX idx_user_achievements_featured ON user_achievements(user_id, is_featured) WHERE is_featured = true;

-- Enable RLS
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can view their own achievements
CREATE POLICY "Users can view own achievements"
  ON user_achievements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view others' unlocked achievements
CREATE POLICY "Users can view others unlocked achievements"
  ON user_achievements
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- System can insert achievements
CREATE POLICY "System can insert achievements"
  ON user_achievements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their featured badges
CREATE POLICY "Users can update own achievements"
  ON user_achievements
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION check_and_award_achievements(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_achievements JSONB := '[]'::jsonb;
  v_achievement RECORD;
  v_count INTEGER;
  v_already_has BOOLEAN;
BEGIN
  -- Check each achievement
  FOR v_achievement IN 
    SELECT * FROM achievements WHERE is_hidden = false
  LOOP
    -- Check if user already has this achievement
    SELECT EXISTS(
      SELECT 1 FROM user_achievements 
      WHERE user_id = p_user_id AND achievement_id = v_achievement.id
    ) INTO v_already_has;
    
    IF v_already_has THEN
      CONTINUE;
    END IF;
    
    -- Check if user qualifies for this achievement
    v_count := 0;
    
    CASE v_achievement.requirement_type
      WHEN 'social_interactions' THEN
        SELECT COUNT(*) INTO v_count 
        FROM social_interactions 
        WHERE from_user_id = p_user_id;
        
      WHEN 'profile_views' THEN
        SELECT COUNT(*) INTO v_count 
        FROM profile_views 
        WHERE viewed_profile_id = p_user_id;
        
      WHEN 'friends' THEN
        SELECT COUNT(*) INTO v_count 
        FROM user_connections 
        WHERE user_id = p_user_id AND connection_type IN ('friend', 'match');
        
      WHEN 'icebreakers' THEN
        SELECT COUNT(*) INTO v_count 
        FROM social_interactions 
        WHERE from_user_id = p_user_id AND interaction_type = 'icebreaker';
        
      WHEN 'waves' THEN
        SELECT COUNT(*) INTO v_count 
        FROM social_interactions 
        WHERE from_user_id = p_user_id AND interaction_type = 'wave';
        
      WHEN 'streams_hosted' THEN
        SELECT COUNT(*) INTO v_count 
        FROM streaming_sessions 
        WHERE host_user_id = p_user_id;
        
      WHEN 'total_viewers' THEN
        SELECT COALESCE(SUM(max_viewers), 0) INTO v_count 
        FROM streaming_sessions 
        WHERE host_user_id = p_user_id;
        
      WHEN 'messages_sent' THEN
        SELECT COUNT(*) INTO v_count 
        FROM messages 
        WHERE sender_id = p_user_id;
        
      WHEN 'gifts_sent' THEN
        SELECT COUNT(*) INTO v_count 
        FROM gift_transactions 
        WHERE sender_id = p_user_id;
        
      WHEN 'meet_me_plays' THEN
        SELECT COALESCE(total_plays, 0) INTO v_count 
        FROM meet_me_stats 
        WHERE user_id = p_user_id;
        
      WHEN 'meet_me_streak' THEN
        SELECT COALESCE(longest_streak, 0) INTO v_count 
        FROM meet_me_stats 
        WHERE user_id = p_user_id;
        
      WHEN 'verified' THEN
        SELECT CASE WHEN verified THEN 1 ELSE 0 END INTO v_count 
        FROM profiles 
        WHERE user_id = p_user_id;
        
      WHEN 'coins_earned' THEN
        SELECT COALESCE(coin_balance, 0) + COALESCE(lifetime_coins_spent, 0) INTO v_count 
        FROM currency_balances 
        WHERE user_id = p_user_id;
        
      ELSE
        CONTINUE;
    END CASE;
    
    -- Award achievement if requirement met
    IF v_count >= v_achievement.requirement_value THEN
      INSERT INTO user_achievements (user_id, achievement_id, progress)
      VALUES (p_user_id, v_achievement.id, v_count)
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
      
      -- Award coins if applicable
      IF v_achievement.coin_reward > 0 THEN
        INSERT INTO currency_balances (user_id, coin_balance)
        VALUES (p_user_id, v_achievement.coin_reward)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          coin_balance = currency_balances.coin_balance + v_achievement.coin_reward,
          updated_at = NOW();
        
        INSERT INTO currency_transactions (
          user_id, currency_type, transaction_type, 
          amount, balance_after, reason, metadata
        )
        SELECT 
          p_user_id, 'coins', 'earn',
          v_achievement.coin_reward, coin_balance,
          'Achievement unlocked: ' || v_achievement.name,
          jsonb_build_object('achievement_id', v_achievement.id)
        FROM currency_balances WHERE user_id = p_user_id;
      END IF;
      
      -- Add to results
      v_new_achievements := v_new_achievements || jsonb_build_object(
        'achievement_id', v_achievement.id,
        'name', v_achievement.name,
        'icon', v_achievement.icon,
        'coin_reward', v_achievement.coin_reward
      );
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object('new_achievements', v_new_achievements);
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE user_achievements;