import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Video, Shield, Check, X, Clock, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface VerificationRequest {
  id: string;
  requester_id: string;
  target_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  created_at: string;
  requester_name: string;
  requester_profile?: {
    display_name: string;
    avatar_url?: string;
    profile_photos?: string[];
  };
}

const VideoVerificationInbox: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);

  useEffect(() => {
    if (user) {
      loadVerificationRequests();
      setupRealtimeSubscription();
    }
  }, [user]);

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel('verification_requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'video_verification_requests',
          filter: `target_user_id=eq.${user.id}`
        },
        () => {
          loadVerificationRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadVerificationRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('video_verification_requests')
        .select(`
          *,
          requester_profile:profiles!video_verification_requests_requester_id_fkey(
            display_name,
            avatar_url,
            profile_photos
          )
        `)
        .eq('target_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      console.error('Error loading verification requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const respondToRequest = async (requestId: string, action: 'accept' | 'decline') => {
    setIsResponding(true);
    try {
      const { error } = await supabase
        .from('video_verification_requests')
        .update({ 
          status: action === 'accept' ? 'accepted' : 'declined',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      // Update local state
      setRequests(prev => prev.map(req => 
        req.id === requestId 
          ? { ...req, status: action === 'accept' ? 'accepted' : 'declined' }
          : req
      ));

      toast({
        title: action === 'accept' ? "Request accepted!" : "Request declined",
        description: action === 'accept' 
          ? "You'll receive a video call link shortly."
          : "The verification request has been declined.",
      });

      setSelectedRequest(null);
    } catch (error) {
      console.error('Error responding to request:', error);
      toast({
        title: "Error",
        description: "Failed to respond to the request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResponding(false);
    }
  };

  const pendingRequests = requests.filter(req => req.status === 'pending');
  const hasNewRequests = pendingRequests.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <Button
        variant={hasNewRequests ? "default" : "outline"}
        size="sm"
        className="gap-2 relative"
        onClick={() => setSelectedRequest(pendingRequests[0] || null)}
      >
        <Bell className="w-4 h-4" />
        Verification Requests
        {hasNewRequests && (
          <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
            {pendingRequests.length}
          </Badge>
        )}
      </Button>

      {selectedRequest && (
        <Dialog open={true} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-blue-500" />
                Video Verification Request
              </DialogTitle>
              <DialogDescription>
                Someone wants to verify your identity through a video call.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar>
                      <AvatarImage src={selectedRequest.requester_profile?.profile_photos?.[0] || selectedRequest.requester_profile?.avatar_url} />
                      <AvatarFallback>
                        {selectedRequest.requester_profile?.display_name?.[0] || selectedRequest.requester_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {selectedRequest.requester_profile?.display_name || selectedRequest.requester_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(selectedRequest.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Verification Request
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          They want to verify your identity through a brief video call to build trust.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="font-medium text-sm">What happens next?</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• A secure video call link will be generated</li>
                  <li>• The call is recorded for safety purposes</li>
                  <li>• You can end the call at any time</li>
                  <li>• Both parties can report inappropriate behavior</li>
                </ul>
              </div>

              {selectedRequest.status === 'pending' ? (
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={() => respondToRequest(selectedRequest.id, 'accept')}
                    disabled={isResponding}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => respondToRequest(selectedRequest.id, 'decline')}
                    disabled={isResponding}
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <Badge variant={selectedRequest.status === 'accepted' ? 'default' : 'secondary'}>
                    {selectedRequest.status === 'accepted' ? 'Accepted' : 'Declined'}
                  </Badge>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Show list of all requests if no specific request is selected */}
      {!selectedRequest && requests.length > 0 && (
        <Dialog open={false}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>All Verification Requests</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {requests.map((request) => (
                <Card key={request.id} className={`cursor-pointer transition-colors hover:bg-muted/50 ${request.status === 'pending' ? 'border-blue-200 dark:border-blue-800' : ''}`}>
                  <CardContent className="p-3" onClick={() => setSelectedRequest(request)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={request.requester_profile?.profile_photos?.[0] || request.requester_profile?.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {request.requester_profile?.display_name?.[0] || request.requester_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {request.requester_profile?.display_name || request.requester_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={request.status === 'pending' ? 'default' : 'secondary'}>
                        {request.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default VideoVerificationInbox;