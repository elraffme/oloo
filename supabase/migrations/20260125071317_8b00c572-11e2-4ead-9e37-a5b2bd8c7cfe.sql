-- Add 'withdrawal' to the allowed transaction types in currency_transactions
ALTER TABLE currency_transactions 
DROP CONSTRAINT currency_transactions_transaction_type_check;

ALTER TABLE currency_transactions 
ADD CONSTRAINT currency_transactions_transaction_type_check 
CHECK (transaction_type = ANY (ARRAY['purchase'::text, 'gift_sent'::text, 'gift_received'::text, 'conversion'::text, 'reward'::text, 'refund'::text, 'withdrawal'::text]));