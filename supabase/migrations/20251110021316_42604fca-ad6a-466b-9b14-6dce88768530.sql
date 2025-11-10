-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule monthly cleanup of old streaming sessions
SELECT cron.schedule(
  'cleanup-old-streaming-sessions',
  '0 0 1 * *', -- First day of every month at midnight
  $$SELECT cleanup_old_streaming_sessions();$$
);