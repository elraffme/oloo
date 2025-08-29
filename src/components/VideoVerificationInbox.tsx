import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Video, Bell, Shield, User, Clock, Phone, PhoneOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import VideoCall from './VideoCall';

interface VerificationRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  status: string;
  created_at: string;
}

const VideoVerificationInbox: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCall, setActiveCall] = useState<{
    callId: string;
    isInitiator: boolean;
    participantName: string;
  } | null>(null);

  useEffect(() => {
    if (user && isDialogOpen) {
      loadRequests();
    }
  }, [user, isDialogOpen]);

  const loadRequests = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('video_verification_requests')
        .select('*')
        .eq('target_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast({
        title: "Error",
        description: "Failed to load verification requests",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const respondToRequest = async (requestId: string, status: 'accepted' | 'declined', requesterName: string) => {
    try {
      const { error } = await supabase
        .from('video_verification_requests')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;

      if (status === 'accepted') {
        // Start video call
        const callId = `call_${requestId}_${Date.now()}`;
        setActiveCall({
          callId,
          isInitiator: false,
          participantName: requesterName
        });
        setIsDialogOpen(false);
        
        toast({
          title: "✅ Request Accepted",
          description: `Starting video call with ${requesterName}`,
        });
      } else {
        toast({
          title: "❌ Request Declined",
          description: `Declined verification request from ${requesterName}`,
        });
      }

      loadRequests(); // Refresh the list
    } catch (error) {
      console.error('Error responding to request:', error);
      toast({
        title: "Error",
        description: "Failed to respond to request",
        variant: "destructive"
      });
    }
  };

  const handleInboxClick = () => {
    setIsDialogOpen(true);
  };

  if (activeCall) {
    return (
      <VideoCall
        callId={activeCall.callId}
        isInitiator={activeCall.isInitiator}
        participantName={activeCall.participantName}
        onCallEnd={() => setActiveCall(null)}
      />
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 relative"
        onClick={handleInboxClick}
      >
        <Bell className="w-4 h-4" />
        Verification Requests
        {requests.filter(r => r.status === 'pending').length > 0 && (
          <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs">
            {requests.filter(r => r.status === 'pending').length}
          </Badge>
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
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
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-pulse">
                  <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                </div>
                <p className="text-sm text-muted-foreground">Loading requests...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No verification requests</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Requests from other users will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <Card key={request.id} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{request.requester_name}</span>
                        </div>
                        <Badge variant={
                          request.status === 'pending' ? 'default' :
                          request.status === 'accepted' ? 'secondary' : 'outline'
                        }>
                          {request.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(request.created_at).toLocaleDateString()}</span>
                      </div>

                      {request.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => respondToRequest(request.id, 'accepted', request.requester_name)}
                            className="flex-1 gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => respondToRequest(request.id, 'declined', request.requester_name)}
                            className="flex-1 gap-1"
                          >
                            <PhoneOff className="w-3 h-3" />
                            Decline
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="font-medium text-sm">Video Verification Info:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Secure WebRTC video calls</li>
                <li>• Verify identity through live video</li>
                <li>• Build trust with potential matches</li>
                <li>• All calls are private and secure</li>
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