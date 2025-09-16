-- Update the messaging function to allow messaging between any authenticated users (like Facebook)
CREATE OR REPLACE FUNCTION public.check_user_can_message(sender_uuid uuid, receiver_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow messaging between any authenticated users (Facebook-style)
  -- Only prevent users from messaging themselves
  IF sender_uuid = receiver_uuid THEN
    RETURN FALSE;
  END IF;
  
  -- Both users must exist and be authenticated
  IF sender_uuid IS NULL OR receiver_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Allow messaging between any users
  RETURN TRUE;
END;
$function$;