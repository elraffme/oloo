-- Add free livestream gifts to gifts table
INSERT INTO gifts (name, cost_tokens, description, category, asset_url, rarity) VALUES
  ('Wave', 0, 'Say hi!', 'free_livestream', '👋', 'common'),
  ('Clap', 0, 'Show appreciation', 'free_livestream', '👏', 'common'),
  ('Fire', 0, 'That''s lit!', 'free_livestream', '🔥', 'common'),
  ('Heart Eyes', 0, 'Looking good!', 'free_livestream', '😍', 'common'),
  ('Star', 0, 'You''re a star!', 'free_livestream', '⭐', 'common'),
  ('Thumbs Up', 0, 'Great stream!', 'free_livestream', '👍', 'common')
ON CONFLICT (id) DO NOTHING;