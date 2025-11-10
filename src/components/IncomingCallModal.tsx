import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Video, Phone, PhoneOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface IncomingCall {
  id: string;
  call_id: string;
  caller_id: string;
  call_type: 'video' | 'audio';
  caller_name: string;
  caller_avatar?: string;
}

export const IncomingCallModal = () => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const setupIncomingCallListener = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to incoming calls
      const channel = supabase
        .channel('incoming-calls')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'video_calls',
            filter: `receiver_id=eq.${user.id}`
          },
          async (payload) => {
            const call = payload.new as any;
            
            if (call.status === 'ringing') {
              // Fetch caller info
              const { data: profile } = await supabase
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('user_id', call.caller_id)
                .single();

              setIncomingCall({
                id: call.id,
                call_id: call.call_id,
                caller_id: call.caller_id,
                call_type: call.call_type,
                caller_name: profile?.display_name || 'Someone',
                caller_avatar: profile?.avatar_url
              });
              setIsRinging(true);

              // Auto-reject after 30 seconds
              setTimeout(() => {
                if (isRinging) {
                  handleReject();
                }
              }, 30000);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupIncomingCallListener();
  }, [isRinging]);

  const handleAccept = async () => {
    if (!incomingCall) return;

    try {
      // Update call status to active
      const { error } = await supabase
        .from('video_calls')
        .update({ 
          status: 'active',
          answered_at: new Date().toISOString()
        })
        .eq('id', incomingCall.id);

      if (error) throw error;

      setIsRinging(false);
      setIncomingCall(null);

      // Navigate to video call
      navigate('/video-call', {
        state: {
          callId: incomingCall.call_id,
          isInitiator: false,
          participantId: incomingCall.caller_id,
          participantName: incomingCall.caller_name,
          callType: incomingCall.call_type
        }
      });
    } catch (error) {
      console.error('Error accepting call:', error);
      toast({
        title: 'Error',
        description: 'Failed to accept call',
        variant: 'destructive'
      });
    }
  };

  const handleReject = async () => {
    if (!incomingCall) return;

    try {
      // Update call status to rejected
      const { error } = await supabase
        .from('video_calls')
        .update({ 
          status: 'rejected',
          ended_at: new Date().toISOString()
        })
        .eq('id', incomingCall.id);

      if (error) throw error;

      setIsRinging(false);
      setIncomingCall(null);

      toast({
        title: 'Call Declined',
        description: `You declined the call from ${incomingCall.caller_name}`
      });
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  if (!incomingCall) return null;

  return (
    <Dialog open={isRinging} onOpenChange={(open) => !open && handleReject()}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center gap-6 py-8">
          <Avatar className="w-24 h-24 ring-4 ring-primary animate-pulse">
            <AvatarImage src={incomingCall.caller_avatar} />
            <AvatarFallback className="text-2xl">
              {incomingCall.caller_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <h3 className="text-xl font-semibold text-foreground">
              {incomingCall.caller_name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Incoming {incomingCall.call_type} call...
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              size="lg"
              variant="destructive"
              onClick={handleReject}
              className="rounded-full w-16 h-16"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>

            <Button
              size="lg"
              onClick={handleAccept}
              className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
            >
              {incomingCall.call_type === 'video' ? (
                <Video className="w-6 h-6" />
              ) : (
                <Phone className="w-6 h-6" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
