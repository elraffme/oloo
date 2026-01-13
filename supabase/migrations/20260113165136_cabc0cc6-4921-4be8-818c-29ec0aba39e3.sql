-- Fix currency_balances foreign key
ALTER TABLE public.currency_balances 
  DROP CONSTRAINT IF EXISTS currency_balances_user_id_fkey,
  ADD CONSTRAINT currency_balances_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix currency_transactions foreign key
ALTER TABLE public.currency_transactions 
  DROP CONSTRAINT IF EXISTS currency_transactions_user_id_fkey,
  ADD CONSTRAINT currency_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix gift_transactions sender foreign key
ALTER TABLE public.gift_transactions 
  DROP CONSTRAINT IF EXISTS gift_transactions_sender_id_fkey,
  ADD CONSTRAINT gift_transactions_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix gift_transactions receiver foreign key
ALTER TABLE public.gift_transactions 
  DROP CONSTRAINT IF EXISTS gift_transactions_receiver_id_fkey,
  ADD CONSTRAINT gift_transactions_receiver_id_fkey 
    FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix video_calls caller foreign key
ALTER TABLE public.video_calls 
  DROP CONSTRAINT IF EXISTS video_calls_caller_id_fkey,
  ADD CONSTRAINT video_calls_caller_id_fkey 
    FOREIGN KEY (caller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix video_calls receiver foreign key
ALTER TABLE public.video_calls 
  DROP CONSTRAINT IF EXISTS video_calls_receiver_id_fkey,
  ADD CONSTRAINT video_calls_receiver_id_fkey 
    FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;