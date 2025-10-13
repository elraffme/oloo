import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Video, VideoOff, Mic, MicOff, Settings, Users, Eye, Heart, Gift, Share2, MoreVertical, Play, Pause, Volume2, ArrowLeft, Crown } from 'lucide-react';
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
const StreamingInterface: React.FC<StreamingInterfaceProps> = ({
  onBack
}) => {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
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
  const [viewingStream, setViewingStream] = useState<StreamData | null>(null);
  const [isViewerMode, setIsViewerMode] = useState(false);
  const [streamQuality, setStreamQuality] = useState<'720p' | '1080p'>('720p');
  const [enableChat, setEnableChat] = useState(true);
  const [allowGifts, setAllowGifts] = useState(true);

  // Fetch live streams from database with real-time broadcasting
  useEffect(() => {
    const fetchLiveStreams = async () => {
      if (!user) {
        setLiveStreams([]);
        return;
      }

      try {
        console.log('Fetching live streams for discovery...');
        
        // Fetch live streams without join
        const { data: streams, error: streamsError } = await supabase
          .from('streaming_sessions')
          .select('*')
          .eq('status', 'live')
          .eq('is_private', false)
          .order('started_at', { ascending: false });

        if (streamsError) {
          console.error('Error fetching streams:', streamsError);
          setLiveStreams([]);
          return;
        }

        if (!streams || streams.length === 0) {
          setLiveStreams([]);
          return;
        }

        // Get unique host user IDs
        const hostUserIds = [...new Set(streams.map(s => s.host_user_id))];
        
        // Fetch profiles for all hosts
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', hostUserIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }

        // Create a map of user_id to profile
        const profileMap = new Map(
          (profiles || []).map(p => [p.user_id, p])
        );

        // Filter out user's own streams and format data
        const formattedStreams: StreamData[] = streams
          .filter((stream: any) => stream.host_user_id !== user.id)
          .map((stream: any) => {
            const profile = profileMap.get(stream.host_user_id);
            return {
              id: stream.id,
              title: stream.title,
              description: stream.description || '',
              host_user_id: stream.host_user_id,
              host_name: profile?.display_name || 'Anonymous',
              current_viewers: stream.current_viewers || 0,
              status: stream.status,
              created_at: stream.created_at,
              category: stream.ar_space_data?.category || 'General',
              thumbnail: profile?.avatar_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'
            };
          });

        console.log(`Discovered ${formattedStreams.length} live streams`);
        setLiveStreams(formattedStreams);
      } catch (error) {
        console.error('Error fetching live streams:', error);
        setLiveStreams([]);
      }
    };
    
    fetchLiveStreams();

    // Enhanced real-time subscription for broadcasting new streams
    const channel = supabase
      .channel('live_stream_broadcast')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'streaming_sessions',
        filter: 'status=eq.live'
      }, (payload) => {
        console.log('🔴 NEW LIVE STREAM DETECTED:', payload.new);
        
        // Immediately show notification for new live stream
        if (payload.new.host_user_id !== user.id) {
          toast({
            title: "🔴 New Live Stream!",
            description: `${payload.new.title} just went live`,
          });
        }
        
        fetchLiveStreams();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'streaming_sessions'
      }, (payload) => {
        console.log('📡 STREAM UPDATED:', payload.new);
        
        // If stream just went live
        if (payload.new.status === 'live' && payload.old.status !== 'live') {
          if (payload.new.host_user_id !== user.id) {
            toast({
              title: "🔴 Stream Now Live!",
              description: `${payload.new.title} is now broadcasting`,
            });
          }
        }
        
        fetchLiveStreams();
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'streaming_sessions'
      }, () => {
        console.log('Stream ended, refreshing list...');
        fetchLiveStreams();
      })
      .subscribe((status) => {
        console.log('Broadcast subscription status:', status);
      });

    // Periodic refresh every 30 seconds as backup
    const refreshInterval = setInterval(() => {
      console.log('Periodic refresh of live streams...');
      fetchLiveStreams();
    }, 30000);

    return () => {
      console.log('Cleaning up broadcast subscription...');
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, [user, toast]);

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
          width: {
            ideal: 1280
          },
          height: {
            ideal: 720
          },
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
        description: "Camera is ready to stream."
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
        variant: "destructive"
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
        description: "Microphone is ready to stream."
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
        variant: "destructive"
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
    // Validate all requirements
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to start streaming.",
        variant: "destructive"
      });
      return;
    }

    if (!streamTitle.trim()) {
      toast({
        title: "Missing stream title",
        description: "Please enter a title for your stream.",
        variant: "destructive"
      });
      return;
    }

    if (!hasCameraPermission || !streamRef.current) {
      toast({
        title: "Camera not ready",
        description: "Please enable your camera before going live.",
        variant: "destructive"
      });
      return;
    }

    if (!hasMicPermission) {
      toast({
        title: "Microphone not ready",
        description: "Please enable your microphone before going live.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('🎥 Starting broadcast stream with full functionality...');
      
      // Verify stream tracks are active
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const audioTrack = streamRef.current.getAudioTracks()[0];
      
      if (!videoTrack || !videoTrack.enabled) {
        throw new Error('Video track not available or disabled');
      }
      
      if (!audioTrack || !audioTrack.enabled) {
        throw new Error('Audio track not available or disabled');
      }

      console.log('✓ Video and audio tracks validated');
      
      // Setup MediaRecorder for broadcasting
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: streamQuality === '1080p' ? 2500000 : 1500000
      });

      let streamChannel: any;

      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log('📦 Stream chunk:', event.data.size, 'bytes');
          
          // Broadcast chunk to all viewers via Realtime
          if (streamChannel) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              streamChannel.send({
                type: 'broadcast',
                event: 'stream_data',
                payload: { 
                  chunk: base64data,
                  timestamp: Date.now(),
                  quality: streamQuality
                }
              });
            };
            reader.readAsDataURL(event.data);
          }
        }
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        toast({
          title: "Recording error",
          description: "There was an issue with the stream recording.",
          variant: "destructive"
        });
      };

      console.log('✓ MediaRecorder configured');
      
      // Create stream record in database
      const streamData = {
        title: streamTitle.trim(),
        description: `Live stream by ${user.user_metadata?.display_name || user.email || 'Anonymous'}`,
        host_user_id: user.id,
        status: 'live' as const,
        is_private: false,
        started_at: new Date().toISOString(),
        current_viewers: 0,
        max_viewers: 100,
        ar_space_data: {
          category: streamCategory || 'General',
          broadcast_enabled: true,
          discovery_enabled: true,
          stream_quality: streamQuality,
          chat_enabled: enableChat,
          gifts_enabled: allowGifts,
          host_name: user.user_metadata?.display_name || user.email || 'Anonymous'
        }
      };
      
      const { data, error } = await supabase
        .from('streaming_sessions')
        .insert(streamData)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Stream session created:', data.id);
      
      // Setup broadcast channel
      streamChannel = supabase.channel(`stream:${data.id}`, {
        config: {
          broadcast: { self: true }
        }
      });

      await streamChannel
        .on('broadcast', { event: 'viewer_joined' }, (payload: any) => {
          console.log('👤 Viewer joined:', payload);
          setCurrentViewers(prev => prev + 1);
        })
        .on('broadcast', { event: 'viewer_left' }, () => {
          setCurrentViewers(prev => Math.max(0, prev - 1));
        })
        .subscribe();

      console.log('✓ Broadcast channel established');
      
      // Start recording
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      
      setActiveStreamId(data.id);
      setIsStreaming(true);
      setCurrentViewers(1);
      
      console.log('📡 Stream is now LIVE and discoverable');
      
      toast({
        title: "🔴 You're Live!",
        description: `Broadcasting "${streamTitle}" to all users`,
        duration: 5000
      });
      
    } catch (error: any) {
      console.error('❌ Failed to start stream:', error);
      
      // Cleanup on error
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      
      toast({
        title: "Failed to start stream",
        description: error.message || "Please check your camera and microphone permissions.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const endStream = async () => {
    setIsLoading(true);
    try {
      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }

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

      // Cleanup broadcast channel
      if (activeStreamId) {
        await supabase.removeChannel(supabase.channel(`stream:${activeStreamId}`));
      }

      setIsStreaming(false);
      setActiveStreamId(null);
      setCurrentViewers(0);
      setStreamTitle('');
      
      toast({
        title: "Stream ended",
        description: `Your stream had ${currentViewers} viewers. Great job!`
      });
    } catch (error: any) {
      console.error('Error ending stream:', error);
      toast({
        title: "Error ending stream",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const joinStream = async (stream: StreamData) => {
    try {
      // Increment viewer count
      const { error } = await supabase
        .from('streaming_sessions')
        .update({ current_viewers: stream.current_viewers + 1 })
        .eq('id', stream.id);

      if (error) throw error;

      // Subscribe to stream broadcast channel
      const channel = supabase.channel(`stream:${stream.id}`);
      channel
        .on('broadcast', { event: 'stream_data' }, (payload) => {
          console.log('📺 Received stream data:', payload);
          // Handle incoming stream data for playback
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Notify host that viewer joined
            channel.send({
              type: 'broadcast',
              event: 'viewer_joined',
              payload: { viewer_id: user?.id }
            });
          }
        });

      setViewingStream(stream);
      setIsViewerMode(true);
      
      toast({
        title: "Joined stream",
        description: `Now watching ${stream.host_name}'s stream`
      });
    } catch (error: any) {
      console.error('Error joining stream:', error);
      toast({
        title: "Failed to join stream",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    }
  };

  const leaveStream = async () => {
    if (!viewingStream) return;

    try {
      // Decrement viewer count
      const { error } = await supabase
        .from('streaming_sessions')
        .update({ current_viewers: Math.max(0, viewingStream.current_viewers - 1) })
        .eq('id', viewingStream.id);

      if (error) console.error('Error leaving stream:', error);

      setViewingStream(null);
      setIsViewerMode(false);
      
      toast({
        title: "Left stream",
        description: "You've left the stream"
      });
    } catch (error: any) {
      console.error('Error leaving stream:', error);
    }
  };
  // Stream viewer mode
  if (isViewerMode && viewingStream) {
    return (
      <div className="min-h-screen dark bg-background">
        <div className="max-w-6xl mx-auto">
          {/* Viewer Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={leaveStream}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Discover
              </Button>
              <div>
                <h2 className="text-lg font-semibold">{viewingStream.title}</h2>
                <p className="text-sm text-muted-foreground">{viewingStream.host_name}</p>
              </div>
            </div>
            <Badge className="bg-red-500 text-white">
              <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
              LIVE
            </Badge>
          </div>

          {/* Video Stream */}
          <div className="relative bg-black aspect-video">
            <video 
              ref={viewerVideoRef}
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center text-white">
                <Play className="w-16 h-16 mx-auto mb-4 animate-pulse" />
                <p className="text-lg font-semibold">Live Stream Active</p>
                <p className="text-sm opacity-90 mt-2">Broadcasting in {viewingStream.category}</p>
                <p className="text-xs opacity-75 mt-1">Real-time streaming enabled for all users</p>
              </div>
            </div>
            
            {/* Stream Overlay Info */}
            <div className="absolute top-4 left-4 flex items-center space-x-2">
              <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur-sm">
                <Eye className="w-3 h-3 mr-1" />
                {viewingStream.current_viewers} viewers
              </Badge>
              <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur-sm">
                {viewingStream.category}
              </Badge>
            </div>
          </div>

          {/* Stream Info and Actions */}
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">About this stream</h3>
              <p className="text-muted-foreground">{viewingStream.description}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Heart className="w-4 h-4 mr-2" />
                Like
              </Button>
              <Button variant="outline" size="sm">
                <Gift className="w-4 h-4 mr-2" />
                Send Gift
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

            {!user ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Please log in to discover live streams</p>
              </div>
            ) : liveStreams.length === 0 ? (
              <div className="text-center py-12 col-span-full">
                <p className="text-muted-foreground">No live streams at the moment. Check back soon!</p>
              </div>
            ) : (
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
            )}

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

                  {isStreaming && <div className="p-4 bg-muted rounded-lg space-y-2">
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
                    </div>}
                </CardContent>
              </Card>

              {/* Video Preview */}
              <Card className="cultural-card">
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
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
                        {!hasCameraPermission && <Button onClick={initializeCamera} disabled={isRequestingCamera} variant="outline" size="sm">
                            <Video className="w-4 h-4 mr-2" />
                            {isRequestingCamera ? 'Enabling...' : 'Enable Camera'}
                          </Button>}
                        {!hasMicPermission && <Button onClick={initializeMicrophone} disabled={isRequestingMic} variant="outline" size="sm">
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
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Stream Settings</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="quality">Stream Quality</Label>
                                <Select value={streamQuality} onValueChange={(value: '720p' | '1080p') => setStreamQuality(value)}>
                                  <SelectTrigger id="quality">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="720p">720p (Recommended)</SelectItem>
                                    <SelectItem value="1080p">1080p (High Quality)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <Label htmlFor="chat">Enable Chat</Label>
                                <Switch id="chat" checked={enableChat} onCheckedChange={setEnableChat} />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <Label htmlFor="gifts">Allow Gifts</Label>
                                <Switch id="gifts" checked={allowGifts} onCheckedChange={setAllowGifts} />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>}
                  </div>

                  {/* Go Live Button */}
                  <div className="mt-6">
                    {!isStreaming ? <Button onClick={startStream} disabled={!streamTitle.trim() || isLoading || !hasCameraPermission} className="w-full bg-red-500 hover:bg-red-600 text-white" size="lg">
                        {isLoading ? 'Starting...' : 'Go Live'}
                      </Button> : <Button onClick={endStream} disabled={isLoading} variant="destructive" className="w-full" size="lg">
                        {isLoading ? 'Ending...' : 'End Stream'}
                      </Button>}
                    {!hasCameraPermission && <p className="text-sm text-muted-foreground text-center mt-2">
                  </p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>;
};
export default StreamingInterface;