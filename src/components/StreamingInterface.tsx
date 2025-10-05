import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Video, VideoOff, Mic, MicOff, Settings, Users, Eye, Heart, 
  Gift, Share2, MoreVertical, Play, Pause, Volume2, ArrowLeft, Crown 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StreamingInterfaceProps {
  onBack?: () => void;
}

interface StreamData {
  id: string;
  title: string;
  description: string;
  host_user_id: string;
  host_name?: string;
  current_viewers: number;
  status: 'live' | 'ended' | 'pending';
  created_at: string;
  category?: string;
  thumbnail?: string;
}

const StreamingInterface: React.FC<StreamingInterfaceProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamCategory, setStreamCategory] = useState('');
  const [currentViewers, setCurrentViewers] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalGifts, setTotalGifts] = useState(0);
  const [liveStreams, setLiveStreams] = useState<StreamData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);

  // Fetch live streams from database
  useEffect(() => {
    const fetchLiveStreams = async () => {
      try {
        const { data, error } = await supabase
          .from('streaming_sessions')
          .select(`
            *,
            profiles:host_user_id (display_name)
          `)
          .eq('status', 'live')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formattedStreams: StreamData[] = data?.map((stream: any) => ({
          id: stream.id,
          title: stream.title,
          description: stream.description || '',
          host_user_id: stream.host_user_id,
          host_name: stream.profiles?.display_name || 'Anonymous',
          current_viewers: stream.current_viewers || 0,
          status: stream.status,
          created_at: stream.created_at,
          category: stream.ar_space_data?.category || 'General',
          thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'
        })) || [];

        setLiveStreams(formattedStreams);
      } catch (error) {
        console.error('Error fetching live streams:', error);
        // Show mock data if fetch fails
        const mockStreams: StreamData[] = [
          {
            id: '1',
            title: 'Cultural Music Session 🎵',
            description: 'Live performance of traditional African songs',
            host_user_id: 'host1',
            host_name: 'Kemi Adebayo',
            current_viewers: 234,
            status: 'live',
            created_at: new Date().toISOString(),
            category: 'Music',
            thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'
          },
          {
            id: '2',
            title: 'Dating Tips & Cultural Values 💝',
            description: 'Discussion on modern dating with traditional values',
            host_user_id: 'host2',
            host_name: 'Amara Johnson',
            current_viewers: 156,
            status: 'live',
            created_at: new Date().toISOString(),
            category: 'Lifestyle',
            thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop'
          }
        ];
        setLiveStreams(mockStreams);
      }
    };

    fetchLiveStreams();

    // Set up real-time subscription for new streams
    const channel = supabase
      .channel('streaming_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streaming_sessions',
          filter: 'status=eq.live'
        },
        () => {
          fetchLiveStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const initializeCamera = async () => {
    setIsRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });
      
      // Merge with existing audio track if available
      if (streamRef.current) {
        const audioTrack = streamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          stream.addTrack(audioTrack);
        }
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.error('Error playing video:', playError);
        }
      }
      
      setHasCameraPermission(true);
      setIsCameraOn(true);
      
      toast({
        title: "Camera enabled ✓",
        description: "Camera is ready to stream.",
      });
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      
      let errorMessage = "Please enable camera permissions.";
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permission denied. Please click 'Allow' for camera access.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera found. Please connect a camera and try again.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Camera is already in use. Please close other apps.";
      }
      
      toast({
        title: "Camera access failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRequestingCamera(false);
    }
  };

  const initializeMicrophone = async () => {
    setIsRequestingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Merge with existing video track if available
      if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          stream.addTrack(videoTrack);
        }
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setHasMicPermission(true);
      setIsMicOn(true);
      
      toast({
        title: "Microphone enabled ✓",
        description: "Microphone is ready to stream.",
      });
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      setHasMicPermission(false);
      
      let errorMessage = "Please enable microphone permissions.";
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permission denied. Please click 'Allow' for microphone access.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No microphone found. Please connect a microphone.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Microphone is already in use. Please close other apps.";
      }
      
      toast({
        title: "Microphone access failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRequestingMic(false);
    }
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleMicrophone = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const startStream = async () => {
    if (!user || !streamTitle.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a stream title before going live.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Create stream record in database
      const streamData = {
        title: streamTitle,
        description: `Live stream by ${user.user_metadata?.display_name || 'Anonymous'}`,
        host_user_id: user.id,
        status: 'live' as const,
        is_private: false,
        ar_space_data: {
          category: streamCategory || 'General'
        }
      };

      const { data, error } = await supabase
        .from('streaming_sessions')
        .insert(streamData)
        .select()
        .single();

      if (error) throw error;

      setIsStreaming(true);
      setCurrentViewers(1);
      
      toast({
        title: "Stream started!",
        description: "You're now live. Share your stream to get more viewers.",
      });

      // In a real implementation, you would start the actual streaming here
      // This would involve WebRTC, RTMP, or another streaming protocol

    } catch (error: any) {
      console.error('Error starting stream:', error);
      toast({
        title: "Failed to start stream",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const endStream = async () => {
    setIsLoading(true);
    
    try {
      // Update stream status in database
      const { error } = await supabase
        .from('streaming_sessions')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('host_user_id', user?.id)
        .eq('status', 'live');

      if (error) throw error;

      setIsStreaming(false);
      setCurrentViewers(0);
      setStreamTitle('');
      
      toast({
        title: "Stream ended",
        description: `Your stream had ${currentViewers} viewers. Great job!`,
      });

    } catch (error: any) {
      console.error('Error ending stream:', error);
      toast({
        title: "Error ending stream",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const joinStream = (streamId: string) => {
    // In a real implementation, this would connect to the stream
    toast({
      title: "Joining stream...",
      description: "This feature will be available soon!",
    });
  };

  return (
    <div className="min-h-screen dark bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            {onBack && (
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <h1 className="text-2xl font-afro-heading">Live Streaming</h1>
          </div>
        </div>

        <Tabs defaultValue="discover" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="discover">Discover Streams</TabsTrigger>
            <TabsTrigger value="go-live">Go Live</TabsTrigger>
          </TabsList>

          {/* Discover Tab */}
          <TabsContent value="discover" className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-afro-heading mb-2">Live Cultural Streams</h2>
              <p className="text-muted-foreground">
                Connect with your community through live cultural content
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveStreams.map((stream) => (
                <Card key={stream.id} className="cultural-card overflow-hidden">
                  <div className="relative">
                    <img
                      src={stream.thumbnail}
                      alt={stream.title}
                      className="w-full h-48 object-cover"
                    />
                    <Badge className="absolute top-2 left-2 bg-red-500 text-white">
                      <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                      LIVE
                    </Badge>
                    <div className="absolute bottom-2 right-2 flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        <Eye className="w-3 h-3 mr-1" />
                        {stream.current_viewers}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg leading-tight">{stream.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{stream.host_name}</p>
                  </CardHeader>
                  
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {stream.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{stream.category}</Badge>
                      <Button 
                        size="sm" 
                        onClick={() => joinStream(stream.id)}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Watch
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Premium Live Events */}
            <Card className="premium-gradient p-6 text-center">
              <h3 className="text-xl font-afro-heading mb-2 text-white">
                Premium Live Events
              </h3>
              <p className="text-white/90 mb-4">
                Exclusive cultural events, matchmaking sessions, and premium content
              </p>
              <Button variant="secondary">
                <Crown className="w-4 h-4 mr-2" />
                Unlock Premium Events
              </Button>
            </Card>
          </TabsContent>

          {/* Go Live Tab */}
          <TabsContent value="go-live" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stream Setup */}
              <Card className="cultural-card">
                <CardHeader>
                  <CardTitle>Stream Setup</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Stream Title</label>
                    <Input
                      value={streamTitle}
                      onChange={(e) => setStreamTitle(e.target.value)}
                      placeholder="What's your stream about?"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <Select onValueChange={setStreamCategory}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="music">Music</SelectItem>
                        <SelectItem value="lifestyle">Lifestyle</SelectItem>
                        <SelectItem value="food">Food & Cooking</SelectItem>
                        <SelectItem value="culture">Culture</SelectItem>
                        <SelectItem value="dating">Dating & Relationships</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isStreaming && (
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Current Viewers:</span>
                        <Badge>{currentViewers}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Likes:</span>
                        <Badge variant="outline">{totalLikes}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Gifts:</span>
                        <Badge variant="outline">{totalGifts}</Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Video Preview */}
              <Card className="cultural-card">
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    {isCameraOn ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white">
                        <VideoOff className="w-12 h-12" />
                      </div>
                    )}
                    
                    {isStreaming && (
                      <Badge className="absolute top-2 left-2 bg-red-500 text-white">
                        <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                        LIVE
                      </Badge>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="mt-4 space-y-3">
                    {/* Permission Buttons */}
                    {(!hasCameraPermission || !hasMicPermission) && (
                      <div className="grid grid-cols-2 gap-2">
                        {!hasCameraPermission && (
                          <Button
                            onClick={initializeCamera}
                            disabled={isRequestingCamera}
                            variant="outline"
                            size="sm"
                          >
                            <Video className="w-4 h-4 mr-2" />
                            {isRequestingCamera ? 'Enabling...' : 'Enable Camera'}
                          </Button>
                        )}
                        {!hasMicPermission && (
                          <Button
                            onClick={initializeMicrophone}
                            disabled={isRequestingMic}
                            variant="outline"
                            size="sm"
                          >
                            <Mic className="w-4 h-4 mr-2" />
                            {isRequestingMic ? 'Enabling...' : 'Enable Mic'}
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {/* Toggle Controls */}
                    {(hasCameraPermission || hasMicPermission) && (
                      <div className="flex items-center justify-center space-x-4">
                        <Button
                          variant={isCameraOn ? "default" : "secondary"}
                          size="sm"
                          onClick={toggleCamera}
                          disabled={!hasCameraPermission}
                        >
                          {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                        </Button>
                        
                        <Button
                          variant={isMicOn ? "default" : "secondary"}
                          size="sm"
                          onClick={toggleMicrophone}
                          disabled={!hasMicPermission}
                        >
                          {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                        </Button>
                        
                        <Button variant="ghost" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Go Live Button */}
                  <div className="mt-6">
                    {!isStreaming ? (
                      <Button
                        onClick={startStream}
                        disabled={!streamTitle.trim() || isLoading || !hasCameraPermission}
                        className="w-full bg-red-500 hover:bg-red-600 text-white"
                        size="lg"
                      >
                        {isLoading ? 'Starting...' : 'Go Live'}
                      </Button>
                    ) : (
                      <Button
                        onClick={endStream}
                        disabled={isLoading}
                        variant="destructive"
                        className="w-full"
                        size="lg"
                      >
                        {isLoading ? 'Ending...' : 'End Stream'}
                      </Button>
                    )}
                    {!hasCameraPermission && (
                      <p className="text-sm text-muted-foreground text-center mt-2">
                        Enable camera to go live
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StreamingInterface;