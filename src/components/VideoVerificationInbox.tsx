import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Video, Bell, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const VideoVerificationInbox: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleInboxClick = () => {
    toast({
      title: "Video Verification Feature",
      description: "Video verification inbox will be available soon! Stay tuned for this exciting feature.",
    });
    setIsDialogOpen(true);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleInboxClick}
      >
        <Bell className="w-4 h-4" />
        Verification Requests
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-500" />
              Video Verification Inbox
            </DialogTitle>
            <DialogDescription>
              Manage your incoming video verification requests.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Feature Coming Soon
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Video verification requests will appear here once the feature is ready. 
                    You'll be able to accept or decline verification calls from other users.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-medium text-sm">What to expect:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Receive notification when someone requests verification</li>
                <li>• Accept or decline video call requests</li>
                <li>• Secure video calls with recording for safety</li>
                <li>• Report inappropriate behavior if needed</li>
              </ul>
            </div>

            <div className="text-center py-2">
              <Button 
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VideoVerificationInbox;