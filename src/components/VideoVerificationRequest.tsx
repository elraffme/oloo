import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Video, Shield, User, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
      toast({
        title: "Video Verification Feature",
        description: "Video verification will be available soon! Stay tuned for this exciting feature.",
      });

      setIsDialogOpen(false);
      onRequestSent?.();
    } catch (error) {
      console.error('Error sending verification request:', error);
      toast({
        title: "Feature Coming Soon",
        description: "Video verification is currently under development.",
        variant: "default",
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

          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Coming Soon:</strong> Video verification is currently under development. 
              This feature will allow you to request live video calls with other users for identity confirmation.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={sendVerificationRequest}
              className="flex-1"
            >
              Notify Me When Available
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