import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Video, Shield, User, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VideoVerificationRequestProps {
  targetUserId: string;
  targetUserName: string;
  onRequestSent?: () => void;
}

interface VerificationRequest {
  id: string;
  requester_id: string;
  target_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  created_at: string;
  requester_name: string;
}

const VideoVerificationRequest: React.FC<VideoVerificationRequestProps> = ({ 
  targetUserId, 
  targetUserName,
  onRequestSent 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRequestingVerification, setIsRequestingVerification] = useState(false);
  const [existingRequest, setExistingRequest] = useState<VerificationRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  React.useEffect(() => {
    if (user && isDialogOpen) {
      checkExistingRequest();
    }
  }, [user, targetUserId, isDialogOpen]);

  const checkExistingRequest = async () => {
    try {
      const { data, error } = await supabase
        .from('video_verification_requests')
        .select('*')
        .eq('requester_id', user?.id)
        .eq('target_user_id', targetUserId)
        .in('status', ['pending', 'accepted'])
        .single();

      if (data) {
        setExistingRequest(data);
      }
    } catch (error) {
      // No existing request found
      setExistingRequest(null);
    }
  };

  const sendVerificationRequest = async () => {
    if (!user) return;

    setIsRequestingVerification(true);
    try {
      const { error } = await supabase
        .from('video_verification_requests')
        .insert({
          requester_id: user.id,
          target_user_id: targetUserId,
          requester_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Unknown',
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Verification request sent!",
        description: `${targetUserName} will be notified of your video verification request.`,
      });

      setIsDialogOpen(false);
      onRequestSent?.();
    } catch (error) {
      console.error('Error sending verification request:', error);
      toast({
        title: "Failed to send request",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsRequestingVerification(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'accepted':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'declined':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'accepted':
        return <Video className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'declined':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
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
          {existingRequest ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(existingRequest.status)}`} />
                    <div>
                      <p className="font-medium capitalize">{existingRequest.status}</p>
                      <p className="text-sm text-muted-foreground">
                        Requested {new Date(existingRequest.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    {getStatusIcon(existingRequest.status)}
                    {existingRequest.status}
                  </Badge>
                </div>
                
                {existingRequest.status === 'pending' && (
                  <p className="text-sm text-muted-foreground mt-3">
                    Waiting for {targetUserName} to respond to your verification request.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
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
                  <strong>How it works:</strong> {targetUserName} will receive your request and can choose to accept or decline. 
                  If accepted, you'll both receive a secure video call link.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={sendVerificationRequest}
                  disabled={isRequestingVerification}
                  className="flex-1"
                >
                  {isRequestingVerification ? "Sending..." : "Send Request"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoVerificationRequest;