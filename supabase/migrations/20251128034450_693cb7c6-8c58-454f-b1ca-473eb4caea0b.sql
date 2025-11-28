-- Enable REPLICA IDENTITY FULL for complete row data in realtime events
ALTER TABLE gift_transactions REPLICA IDENTITY FULL;

-- Add to the realtime publication so hosts and viewers receive gift notifications in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE gift_transactions;