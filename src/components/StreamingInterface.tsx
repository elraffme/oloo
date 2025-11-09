import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, VideoOff, Mic, MicOff, Settings, Users, Eye, Heart, Gift, Share2, MoreVertical, Play, Pause, Volume2, ArrowLeft, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BroadcastManager } from '@/utils/BroadcastManager';
import StreamViewer from '@/components/StreamViewer';
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
const StreamingInterface: React.FC<StreamingInterfaceProps> = ({
  onBack
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  
  // Determine active tab from URL - default to discover
  const activeTab = location.pathname.endsWith('/go-live') ? 'go-live' : 'discover';
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
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [viewingStreamId, setViewingStreamId] = useState<string | null>(null);
  const [viewingStreamData, setViewingStreamData] = useState<StreamData | null>(null);
  const [isBroadcastReady, setIsBroadcastReady] = useState(false);
  const broadcastManagerRef = useRef<BroadcastManager | null>(null);
  const viewerCountIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCleaningUpRef = useRef(false);
  const activeStreamIdRef = useRef<string | null>(null);

  // Sync activeStreamId to ref for cleanup
  useEffect(() => {
    activeStreamIdRef.current = activeStreamId;
  }, [activeStreamId]);

  // Initialize camera/mic on "Go Live" tab when navigating to it
  useEffect(() => {
    if (activeTab === 'go-live' && !hasCameraPermission && !isRequestingCamera) {
      initializeMedia(true, false);
    }
  }, [activeTab]);

  // Fetch live streams from database
  useEffect(() => {
    const fetchLiveStreams = async () => {
      try {
        const {
          data,
          error
        } = await supabase.from('streaming_sessions').select(`
            *,
            profiles:host_user_id (display_name)
          `).eq('status', 'live').order('created_at', {
          ascending: false
        });
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
        const mockStreams: StreamData[] = [{
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
        }, {
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
        }];
        setLiveStreams(mockStreams);
      }
    };
    fetchLiveStreams();

    // Set up real-time subscription for new streams
    const channel = supabase.channel('streaming_sessions_changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'streaming_sessions',
      filter: 'status=eq.live'
    }, () => {
      fetchLiveStreams();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Improved cleanup on unmount
  useEffect(() => {
    return () => {
      if (isCleaningUpRef.current) return;
      isCleaningUpRef.current = true;

      console.log('Component unmounting, cleaning up...');
      
      // 1. Stop media tracks first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped ${track.kind} track`);
        });
      }
      
      // 2. Cleanup broadcast manager
      if (broadcastManagerRef.current) {
        console.log('Cleaning up broadcast manager');
        broadcastManagerRef.current.cleanup();
      }
      
      // 3. Clear intervals
      if (viewerCountIntervalRef.current) {
        clearInterval(viewerCountIntervalRef.current);
      }

      // 4. Update database if streaming (use ref for current value)
      if (activeStreamIdRef.current) {
        console.log('Updating stream status on unmount');
        supabase
          .from('streaming_sessions')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            current_viewers: 0
          })
          .eq('id', activeStreamIdRef.current)
          .then(() => console.log('Stream status updated'));
      }
    };
  }, []);
  const initializeMedia = async (requestVideo: boolean, requestAudio: boolean) => {
    if (requestVideo) setIsRequestingCamera(true);
    if (requestAudio) setIsRequestingMic(true);
    
    try {
      const constraints: MediaStreamConstraints = {};
      
      if (requestVideo) {
        constraints.video = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        };
      }
      
      if (requestAudio) {
        constraints.audio = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        };
      }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

      // If we already have a stream, add new tracks to it
      if (streamRef.current) {
        newStream.getTracks().forEach(track => {
          streamRef.current!.addTrack(track);
        });
      } else {
        streamRef.current = newStream;
      }

      // Set video element once and play
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
      }

      if (requestVideo) {
        setHasCameraPermission(true);
        setIsCameraOn(true);
      }
      if (requestAudio) {
        setHasMicPermission(true);
        setIsMicOn(true);
      }

      const mediaTypes = [];
      if (requestVideo) mediaTypes.push('Camera');
      if (requestAudio) mediaTypes.push('Microphone');

      toast({
        title: "Media enabled ✓",
        description: `${mediaTypes.join(' and ')} ready to stream.`
      });

    } catch (error: any) {
      console.error('Error accessing media:', error);
      if (requestVideo) setHasCameraPermission(false);
      if (requestAudio) setHasMicPermission(false);
      
      let errorMessage = "Please enable permissions.";
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permission denied. Please click 'Allow' to grant access.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = `No ${requestVideo ? 'camera' : 'microphone'} found. Please connect a device.`;
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Device is already in use. Please close other apps.";
      }
      
      toast({
        title: "Media access failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      if (requestVideo) setIsRequestingCamera(false);
      if (requestAudio) setIsRequestingMic(false);
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
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please sign in to start streaming.",
        variant: "destructive"
      });
      return;
    }

    if (!streamTitle.trim()) {
      toast({
        title: "Missing title",
        description: "Please enter a stream title.",
        variant: "destructive"
      });
      return;
    }

    if (!streamRef.current) {
      toast({
        title: "Camera not ready",
        description: "Please enable your camera first.",
        variant: "destructive"
      });
      return;
    }

    // Ensure we have both video and audio tracks
    const videoTracks = streamRef.current.getVideoTracks();
    const audioTracks = streamRef.current.getAudioTracks();
    
    if (videoTracks.length === 0) {
      toast({
        title: "No video source",
        description: "Please enable your camera to start streaming.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('streaming_sessions')
        .insert({
          title: streamTitle,
          description: `Live stream by ${user.user_metadata?.display_name || 'Anonymous'}`,
          host_user_id: user.id,
          status: 'live',
          is_private: false,
          ar_space_data: { category: streamCategory || 'General' }
        })
        .select()
        .single();

      if (error) throw error;

      setActiveStreamId(data.id);

      // Initialize broadcast manager with current stream
      broadcastManagerRef.current = new BroadcastManager(data.id, streamRef.current);
      await broadcastManagerRef.current.initializeChannel(supabase);

      // Small delay to ensure channel is ready
      setTimeout(() => {
        setIsBroadcastReady(true);
        console.log('Broadcast channel ready, viewers can now join');
      }, 1000);

      // Update viewer count periodically
      viewerCountIntervalRef.current = setInterval(async () => {
        const count = broadcastManagerRef.current?.getViewerCount() || 0;
        setCurrentViewers(count);
        
        await supabase
          .from('streaming_sessions')
          .update({ current_viewers: count })
          .eq('id', data.id);
      }, 3000);

      setIsStreaming(true);
      toast({
        title: "🎥 You're Live!",
        description: `Broadcasting via WebRTC${isBroadcastReady ? '' : ' (preparing...)'}`
      });
    } catch (error: any) {
      console.error('Error starting stream:', error);
      toast({
        title: "Failed to start stream",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const endStream = async () => {
    if (!activeStreamId) return;

    setIsLoading(true);
    try {
      // Cleanup viewer count interval
      if (viewerCountIntervalRef.current) {
        clearInterval(viewerCountIntervalRef.current);
        viewerCountIntervalRef.current = null;
      }

      // Cleanup broadcast manager
      if (broadcastManagerRef.current) {
        broadcastManagerRef.current.cleanup();
        broadcastManagerRef.current = null;
      }

      // Update database
      const { error } = await supabase
        .from('streaming_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          current_viewers: 0
        })
        .eq('id', activeStreamId);

      if (error) {
        console.error('Error updating stream status:', error);
      }

      setIsStreaming(false);
      setActiveStreamId(null);
      setCurrentViewers(0);
      
      toast({
        title: "Stream ended",
        description: `Thanks for streaming! ${currentViewers} viewers watched.`
      });
    } catch (error: any) {
      console.error('Error ending stream:', error);
      toast({
        title: "Error ending stream",
        description: "Stream has been stopped locally.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const joinStream = (stream: StreamData) => {
    setViewingStreamId(stream.id);
    setViewingStreamData(stream);
  };

  const closeStreamViewer = () => {
    setViewingStreamId(null);
    setViewingStreamData(null);
  };
  return <div className="min-h-screen dark bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            {onBack && <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>}
            <h1 className="text-2xl font-afro-heading">Live Streaming</h1>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => navigate(`/app/streaming/${value}`)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="discover">Discover Streams</TabsTrigger>
            <TabsTrigger value="go-live">Go Live</TabsTrigger>
          </TabsList>

          {/* Discover Tab */}
          <TabsContent value="discover" className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-afro-heading mb-2">Live Cultural Streams</h2>
              <p className="text-muted-foreground mb-3">
                Connect with your community through live cultural content
              </p>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                ✨ Real-time WebRTC Broadcasting
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveStreams.map(stream => <Card key={stream.id} className="cultural-card overflow-hidden">
                  <div className="relative">
                    <img src={stream.thumbnail} alt={stream.title} className="w-full h-48 object-cover" />
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
                      <Button size="sm" onClick={() => joinStream(stream)} className="bg-primary hover:bg-primary/90">
                        <Play className="w-3 h-3 mr-1" />
                        Watch
                      </Button>
                    </div>
                  </CardContent>
                </Card>)}
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
                    <Input value={streamTitle} onChange={e => setStreamTitle(e.target.value)} placeholder="What's your stream about?" className="mt-1" />
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

                   {isStreaming && <div className="p-4 bg-muted rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Broadcasting Status:</span>
                        <Badge className="bg-green-500 text-white">
                          <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                          Live via WebRTC
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connected Viewers:</span>
                        <Badge variant="secondary">{currentViewers} watching</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Likes:</span>
                        <Badge variant="outline">{totalLikes}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Gifts:</span>
                        <Badge variant="outline">{totalGifts}</Badge>
                      </div>
                    </div>}
                </CardContent>
              </Card>

              {/* Video Preview */}
              <Card className="cultural-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Preview</span>
                    {isStreaming && (
                      <Badge variant="secondary" className="text-xs">
                        🔴 Broadcasting to {currentViewers} viewers
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    {isCameraOn ? <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white">
                        <VideoOff className="w-12 h-12" />
                      </div>}
                    
                    {isStreaming && <Badge className="absolute top-2 left-2 bg-red-500 text-white">
                        <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                        LIVE
                      </Badge>}
                  </div>

                  {/* Controls */}
                  <div className="mt-4 space-y-3">
                    {/* Permission Buttons */}
                    {(!hasCameraPermission || !hasMicPermission) && <div className="grid grid-cols-2 gap-2">
                        {!hasCameraPermission && <Button onClick={() => initializeMedia(true, false)} disabled={isRequestingCamera} variant="outline" size="sm">
                            <Video className="w-4 h-4 mr-2" />
                            {isRequestingCamera ? 'Enabling...' : 'Enable Camera'}
                          </Button>}
                        {!hasMicPermission && <Button onClick={() => initializeMedia(false, true)} disabled={isRequestingMic} variant="outline" size="sm">
                            <Mic className="w-4 h-4 mr-2" />
                            {isRequestingMic ? 'Enabling...' : 'Enable Mic'}
                          </Button>}
                      </div>}
                    
                    {/* Toggle Controls */}
                    {(hasCameraPermission || hasMicPermission) && <div className="flex items-center justify-center space-x-4">
                        <Button variant={isCameraOn ? "default" : "secondary"} size="sm" onClick={toggleCamera} disabled={!hasCameraPermission}>
                          {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                        </Button>
                        
                        <Button variant={isMicOn ? "default" : "secondary"} size="sm" onClick={toggleMicrophone} disabled={!hasMicPermission}>
                          {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                        </Button>
                        
                        <Button variant="ghost" size="sm">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>}
                  </div>

                  {/* Go Live Button */}
                  <div className="mt-6 space-y-2">
                    {!isStreaming ? (
                      <>
                        <Button onClick={startStream} disabled={!streamTitle.trim() || isLoading || !hasCameraPermission} className="w-full bg-red-500 hover:bg-red-600 text-white" size="lg">
                          {isLoading ? 'Starting...' : '🎥 Start WebRTC Broadcast'}
                        </Button>
                        {hasCameraPermission && (
                          <p className="text-xs text-muted-foreground text-center">
                            Viewers will connect to your stream in real-time via peer-to-peer connection
                          </p>
                        )}
                      </>
                    ) : (
                      <Button onClick={endStream} disabled={isLoading} variant="destructive" className="w-full" size="lg">
                        {isLoading ? 'Ending...' : 'End Stream'}
                      </Button>
                    )}
                    {!hasCameraPermission && <p className="text-sm text-muted-foreground text-center mt-2">
                      Enable camera to start broadcasting
                    </p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {viewingStreamId && viewingStreamData && (
        <StreamViewer
          streamId={viewingStreamId}
          streamTitle={viewingStreamData.title}
          hostName={viewingStreamData.host_name || 'Anonymous'}
          onClose={closeStreamViewer}
        />
      )}
    </div>;
};
export default StreamingInterface;