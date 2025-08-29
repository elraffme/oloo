import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Video, Shield, User, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface VideoVerificationRequestProps {
  targetUserId: string;
  targetUserName: string;
  onRequestSent?: () => void;
}

const VideoVerificationRequest: React.FC<VideoVerificationRequestProps> = ({ 
  targetUserId, 
  targetUserName,
  onRequestSent 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const sendVerificationRequest = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('video_verification_requests')
        .insert({
          requester_id: user.id,
          target_user_id: targetUserId,
          requester_name: user.email?.split('@')[0] || 'Someone',
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Request Sent",
        description: `Video verification request sent to ${targetUserName}`,
      });

      setIsDialogOpen(false);
      onRequestSent?.();
    } catch (error) {
      console.error('Error sending verification request:', error);
      toast({
        title: "Error",
        description: "Failed to send verification request. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Video className="w-4 h-4" />
          Request Video Verification
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            Video Verification Request
          </DialogTitle>
          <DialogDescription>
            Request that {targetUserName} verify their identity through a live video call.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Why request verification?</p>
                <p className="text-sm text-muted-foreground">
                  Build trust by confirming their identity through a live video interaction.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Safe & Secure</p>
                <p className="text-sm text-muted-foreground">
                  All verification calls are recorded for safety and can be reported if needed.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-400">
              <strong>Ready to Use:</strong> Send a video verification request to {targetUserName}. 
              They'll receive a notification and can accept to start a secure video call for identity verification.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={sendVerificationRequest}
              className="flex-1"
            >
              Send Request
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoVerificationRequest;