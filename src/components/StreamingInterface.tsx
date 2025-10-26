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
import { Video, VideoOff, Mic, MicOff, Settings, Users, Eye, Heart, Gift, Share2, MoreVertical, Play, Pause, Volume2, ArrowLeft, Crown, ThumbsUp, Laugh, Flower2, RefreshCw, Info, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AudioVUMeter } from '@/components/AudioVUMeter';
import { DeviceSelector } from '@/components/DeviceSelector';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLiveKit } from '@/hooks/useLiveKit';
import { RoomEvent, RemoteTrack, RemoteParticipant } from 'livekit-client';
import { analyzeVideoBrightness, isVideoTrackHealthy, getOptimalVideoConstraints } from '@/utils/videoQuality';
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
  const [hasLiked, setHasLiked] = useState(false);
  const [reactions, setReactions] = useState<Array<{
    id: string;
    type: string;
    x: number;
  }>>([]);
  const [viewerVolumeMuted, setViewerVolumeMuted] = useState(true);
  const [videoBrightness, setVideoBrightness] = useState(() => {
    const saved = sessionStorage.getItem('stream_brightness');
    return saved ? Number(saved) : 100;
  });
  const [detectedBrightness, setDetectedBrightness] = useState<number | null>(null);
  const [showBrightnessWarning, setShowBrightnessWarning] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<{
    camera: 'prompt' | 'granted' | 'denied';
    microphone: 'prompt' | 'granted' | 'denied';
  }>({ camera: 'prompt', microphone: 'prompt' });
  const [audioDetected, setAudioDetected] = useState(false);
  const [streamLoadingState, setStreamLoadingState] = useState<'connecting' | 'waiting' | 'ready' | 'error'>('connecting');

  // LiveKit integration for WebRTC streaming
  const liveKit = useLiveKit({
    onConnected: () => {
      console.log('✓ LiveKit connected successfully');
    },
    onDisconnected: () => {
      console.log('LiveKit disconnected');
      setIsStreaming(false);
    },
    onParticipantConnected: (count) => {
      setCurrentViewers(count);
    },
    onError: (error) => {
      console.error('LiveKit error:', error);
      toast({
        title: "Streaming error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch live streams from database with real-time broadcasting
  useEffect(() => {
    const fetchLiveStreams = async () => {
      if (!user) {
        setLiveStreams([]);
        return;
      }
      try {
        console.log('Fetching live streams for discovery...');

        // Cleanup stale streams before fetching
        await supabase.rpc('cleanup_stale_streams');

        // Fetch live streams without join
        const {
          data: streams,
          error: streamsError
        } = await supabase.from('streaming_sessions').select('*').eq('status', 'live').eq('is_private', false).order('started_at', {
          ascending: false
        });
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
        const {
          data: profiles,
          error: profilesError
        } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', hostUserIds);
        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }

        // Create a map of user_id to profile
        const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

        // Filter out user's own streams and format data
        const formattedStreams: StreamData[] = streams.filter((stream: any) => stream.host_user_id !== user.id).map((stream: any) => {
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
    const channel = supabase.channel('live_stream_broadcast').on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'streaming_sessions',
      filter: 'status=eq.live'
    }, payload => {
      console.log('🔴 NEW LIVE STREAM DETECTED:', payload.new);

      // Immediately show notification for new live stream
      if (payload.new.host_user_id !== user.id) {
        toast({
          title: "🔴 New Live Stream!",
          description: `${payload.new.title} just went live`
        });
      }
      fetchLiveStreams();
    }).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'streaming_sessions'
    }, payload => {
      console.log('📡 STREAM UPDATED:', payload.new);

      // If stream just went live
      if (payload.new.status === 'live' && payload.old.status !== 'live') {
        if (payload.new.host_user_id !== user.id) {
          toast({
            title: "🔴 Stream Now Live!",
            description: `${payload.new.title} is now broadcasting`
          });
        }
      }
      fetchLiveStreams();
    }).on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'streaming_sessions'
    }, () => {
      console.log('Stream ended, refreshing list...');
      fetchLiveStreams();
    }).subscribe(status => {
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

  // Check permissions status
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        
        setPermissionStatus({
          camera: cameraPermission.state,
          microphone: micPermission.state
        });

        // Listen for permission changes
        cameraPermission.onchange = () => {
          setPermissionStatus(prev => ({ ...prev, camera: cameraPermission.state }));
        };
        micPermission.onchange = () => {
          setPermissionStatus(prev => ({ ...prev, microphone: micPermission.state }));
        };
      } catch (error) {
        console.log('Permissions API not fully supported', error);
      }
    };

    checkPermissions();
  }, []);

  // Auto-initialize camera and microphone on mount
  useEffect(() => {
    const autoInitialize = async () => {
      if (user && !hasCameraPermission && !isRequestingCamera) {
        console.log('Auto-initializing camera...');
        await initializeCamera();
      }
      if (user && !hasMicPermission && !isRequestingMic) {
        console.log('Auto-initializing microphone for broadcasting...');
        await initializeMicrophone();
      }
    };
    
    // Immediate initialization for broadcasting
    autoInitialize();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [user]);

  // Persist brightness changes
  useEffect(() => {
    sessionStorage.setItem('stream_brightness', String(videoBrightness));
  }, [videoBrightness]);

  // Cleanup: End active stream on component unmount
  useEffect(() => {
    return () => {
      if (isStreaming && activeStreamId && user) {
        console.log('Component unmounting - ending active stream...');
        // End stream in database
        supabase
          .from('streaming_sessions')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            current_viewers: 0
          })
          .eq('id', activeStreamId)
          .eq('host_user_id', user.id)
          .eq('status', 'live')
          .then(({ error }) => {
            if (error) console.error('Error ending stream on unmount:', error);
            else console.log('✓ Stream ended on unmount');
          });
      }
    };
  }, [isStreaming, activeStreamId, user]);
  const initializeCamera = async (deviceId?: string) => {
    setIsRequestingCamera(true);
    try {
      console.log('Initializing camera with optimal constraints...');
      const savedDeviceId = deviceId || localStorage.getItem('preferred_cam_deviceId');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: getOptimalVideoConstraints(savedDeviceId || undefined)
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
        videoRef.current.muted = true;
        
        // Add event listeners for debugging
        videoRef.current.onloadedmetadata = () => {
          console.log('✓ Video metadata loaded', {
            readyState: videoRef.current?.readyState,
            videoWidth: videoRef.current?.videoWidth,
            videoHeight: videoRef.current?.videoHeight
          });
        };
        
        videoRef.current.onplaying = () => {
          console.log('✓ Video is playing');
        };
        
        videoRef.current.onerror = (e) => {
          console.error('❌ Video element error:', e);
        };
        
        // Ensure video plays
        try {
          await videoRef.current.play();
          console.log('✓ Video playback started');
          
          // Verify video track is active
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            console.log('Video track state:', {
              enabled: videoTrack.enabled,
              muted: videoTrack.muted,
              readyState: videoTrack.readyState
            });
          }

          // Analyze brightness after video starts playing
          setTimeout(() => {
            const brightness = analyzeVideoBrightness(videoRef.current);
            if (brightness !== null) {
              setDetectedBrightness(brightness);
              if (brightness < 30) {
                console.warn(`⚠️ Low camera brightness detected: ${brightness}%`);
                setShowBrightnessWarning(true);
              } else {
                setShowBrightnessWarning(false);
              }
            }
          }, 500);
        } catch (playError) {
          console.error('❌ Error playing video:', playError);
          toast({
            title: "Video playback issue",
            description: "Camera is on but preview may not display. Try refreshing.",
            variant: "destructive"
          });
        }
      }
      
      setHasCameraPermission(true);
      setIsCameraOn(true);
      toast({
        title: "✓ Camera enabled",
        description: "Camera is ready to stream."
      });
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      let errorMessage = "Please enable camera permissions in your browser settings.";
      if (error.name === 'NotAllowedError') {
        errorMessage = "Camera access denied. Click 'Allow' when prompted or check browser permissions.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera detected. Please connect a camera and try again.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Camera is in use by another app. Please close other apps and try again.";
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
  const initializeMicrophone = async (deviceId?: string) => {
    setIsRequestingMic(true);
    try {
      const savedDeviceId = deviceId || localStorage.getItem('preferred_mic_deviceId');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: savedDeviceId ? {
          deviceId: { exact: savedDeviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000
        } : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000
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
      
      // Verify audio track is active
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack && audioTrack.enabled) {
        console.log('✓ Microphone input detected and ready for broadcasting');
        setHasMicPermission(true);
        setIsMicOn(true);
        toast({
          title: "✓ Microphone enabled",
          description: "Audio input detected and ready for broadcasting."
        });
      }
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      setHasMicPermission(false);
      let errorMessage = "Please enable microphone permissions in your browser settings.";
      if (error.name === 'NotAllowedError') {
        errorMessage = "Microphone access denied. Click 'Allow' when prompted or check browser permissions.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No microphone detected. Please connect a microphone and try again.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Microphone is in use by another app. Please close other apps and try again.";
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
        if (!audioTrack.enabled) {
          setAudioDetected(false);
        }
      }
    }
  };

  const handleDeviceChange = async (videoDeviceId: string, audioDeviceId: string) => {
    console.log('Changing devices:', { videoDeviceId, audioDeviceId });
    
    // Stop current stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Reset states
    setHasCameraPermission(false);
    setHasMicPermission(false);
    setIsCameraOn(false);
    setIsMicOn(false);
    setAudioDetected(false);

    // Re-initialize with new devices
    await initializeCamera(videoDeviceId);
    await initializeMicrophone(audioDeviceId);
  };

  const resetDevices = async () => {
    const wasStreaming = isStreaming;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setHasCameraPermission(false);
    setHasMicPermission(false);
    setIsCameraOn(false);
    setIsMicOn(false);
    setAudioDetected(false);

    toast({
      title: "Devices reset",
      description: "Re-initializing camera and microphone..."
    });

    await initializeCamera();
    await initializeMicrophone();

    // If was streaming, reconnect to LiveKit with new devices
    if (wasStreaming && streamRef.current) {
      await liveKit.publishTracks(streamRef.current, videoRef.current || undefined);
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
    
    // Check permission status - block if denied
    if (permissionStatus.camera === 'denied' || permissionStatus.microphone === 'denied') {
      toast({
        title: "Permissions Denied",
        description: "Please allow camera and microphone access in your browser settings to stream.",
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

    // Pre-publish brightness validation
    console.log('Running pre-publish brightness check...');
    const brightness = analyzeVideoBrightness(videoRef.current);
    if (brightness !== null && brightness < 20) {
      toast({
        title: "Camera Too Dark",
        description: `Your camera brightness is ${brightness}%. Please improve lighting or adjust camera settings before going live.`,
        variant: "destructive"
      });
      setShowBrightnessWarning(true);
      return;
    }

    // Check video track health
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!isVideoTrackHealthy(videoTrack || null)) {
      toast({
        title: "Video Track Unhealthy",
        description: "Please reset your camera before going live",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    try {
      console.log('🎥 Starting LiveKit WebRTC broadcast...');

      // Verify stream tracks are active
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const audioTrack = streamRef.current.getAudioTracks()[0];
      
      if (!videoTrack || !videoTrack.enabled) {
        throw new Error('Video track not available or disabled');
      }
      
      if (!audioTrack || !audioTrack.enabled) {
        toast({
          title: "Audio not detected",
          description: "Please enable your microphone and ensure it's working before going live.",
          variant: "destructive"
        });
        throw new Error('Audio track not available or disabled');
      }
      
      console.log('✓ Video and audio tracks validated');
      setAudioDetected(true);

      // Create stream record in database
      const streamData = {
        title: streamTitle.trim(),
        description: `Live stream by ${user.user_metadata?.display_name || 'Anonymous'}`,
        host_user_id: user.id,
        status: 'live' as const,
        is_private: false,
        started_at: new Date().toISOString(),
        current_viewers: 0,
        max_viewers: 100,
        ar_space_data: {
          quality: streamQuality,
          enableChat,
          allowGifts
        }
      };
      
      console.log('Creating stream record in database...');
      const { data: newStream, error: streamError } = await supabase
        .from('streaming_sessions')
        .insert(streamData)
        .select()
        .single();

      if (streamError) {
        console.error('Database error:', streamError);
        throw new Error(streamError.message);
      }

      console.log('✓ Stream record created:', newStream.id);
      setActiveStreamId(newStream.id);

      // Connect to LiveKit room
      const roomName = `stream-${newStream.id}`;
      const participantName = user.user_metadata?.display_name || 'Streamer';
      
      console.log('Connecting to LiveKit room:', roomName);
      const connected = await liveKit.connect(roomName, participantName, true); // canPublish = true for streamer

      if (!connected) {
        throw new Error('Failed to connect to LiveKit room');
      }

      // Publish local media tracks and attach to preview
      console.log('Publishing media tracks...');
      await liveKit.publishTracks(streamRef.current, videoRef.current || undefined);

      // Update stream record with LiveKit URL
      await supabase
        .from('streaming_sessions')
        .update({ stream_url: roomName })
        .eq('id', newStream.id);

      setIsStreaming(true);
      
      toast({
        title: "🎉 You're live!",
        description: "Your stream is broadcasting to viewers.",
      });

      console.log('✓ Stream started successfully with LiveKit WebRTC');
    } catch (error: any) {
      console.error('Failed to start stream:', error);
      
      // Cleanup on error
      if (activeStreamId) {
        await supabase
          .from('streaming_sessions')
          .update({ status: 'ended', current_viewers: 0 })
          .eq('id', activeStreamId);
        setActiveStreamId(null);
      }
      
      await liveKit.disconnect();
      
      toast({
        title: "Failed to start stream",
        description: error.message || "Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const endStream = async () => {
    setIsLoading(true);
    try {
      console.log('Ending LiveKit stream...');
      
      // Disconnect from LiveKit
      await liveKit.disconnect();

      // Update stream status in database
      const {
        error
      } = await supabase.from('streaming_sessions').update({
        status: 'ended',
        ended_at: new Date().toISOString()
      }).eq('host_user_id', user?.id).eq('status', 'live');
      if (error) throw error;

      setIsStreaming(false);
      setActiveStreamId(null);
      setCurrentViewers(0);
      setStreamTitle('');
      
      toast({
        title: "Stream ended",
        description: `Your stream had ${currentViewers} viewers. Great job!`
      });
      
      console.log('✓ Stream ended successfully');
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
  const sendReaction = (reactionType: string) => {
    if (!viewingStream) return;
    const reactionId = `${Date.now()}-${Math.random()}`;
    const x = Math.random() * 80 + 10; // Random position between 10% and 90%

    // Add reaction locally
    setReactions(prev => [...prev, {
      id: reactionId,
      type: reactionType,
      x
    }]);

    // Broadcast reaction to all viewers
    const channel = supabase.channel(`stream:${viewingStream.id}`);
    channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: {
        type: reactionType,
        x,
        id: reactionId
      }
    });

    // Remove reaction after animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== reactionId));
    }, 3000);
  };
  const joinStream = async (stream: StreamData) => {
    let trackTimeout: ReturnType<typeof setTimeout> | null = null;
    let recheckInterval: ReturnType<typeof setInterval> | null = null;
    
    try {
      console.log('🎬 Joining LiveKit stream:', stream.id);
      setStreamLoadingState('connecting');
      
      // Increment viewer count
      const { error } = await supabase
        .from('streaming_sessions')
        .update({ current_viewers: stream.current_viewers + 1 })
        .eq('id', stream.id);
      if (error) throw error;

      // Connect to LiveKit room as viewer
      const roomName = `stream-${stream.id}`;
      const participantName = user?.user_metadata?.display_name || user?.email || 'Viewer';
      
      console.log('Connecting as viewer to room:', roomName);
      const connected = await liveKit.connect(roomName, participantName, false); // canPublish = false for viewer

      if (!connected) {
        throw new Error('Failed to connect to stream');
      }

      // Set viewing state immediately so video element is mounted
      setViewingStream(stream);
      setIsViewerMode(true);
      setStreamLoadingState('waiting');

      // Wait for video element to be mounted in DOM
      await new Promise(resolve => setTimeout(resolve, 100));

      // Subscribe to remote tracks
      if (liveKit.room && viewerVideoRef.current) {
        console.log('✓ Setting up track subscription...');
        console.log('Remote participants count:', liveKit.room.remoteParticipants.size);
        
        // Ensure viewer video is muted for autoplay
        viewerVideoRef.current.muted = true;
        viewerVideoRef.current.playsInline = true;
        viewerVideoRef.current.autoplay = true;
        
        // Function to check and attach existing tracks
        const attachExistingTracks = () => {
          let tracksFound = false;
          liveKit.room!.remoteParticipants.forEach((participant) => {
            console.log('📍 Checking participant:', {
              identity: participant.identity,
              trackCount: participant.trackPublications.size
            });
            
            participant.trackPublications.forEach((publication) => {
              console.log('📍 Track publication:', {
                kind: publication.kind,
                subscribed: publication.isSubscribed,
                enabled: publication.isEnabled,
                trackSid: publication.trackSid
              });
              
              if (publication.track && publication.track.kind === 'video' && viewerVideoRef.current) {
                const videoTrack = publication.track as RemoteTrack;
                videoTrack.attach(viewerVideoRef.current);
                console.log('✅ Existing video track attached from', participant.identity);
                
                // Verify track state
                const mediaTrack = videoTrack.mediaStreamTrack;
                console.log('📺 Video track state:', {
                  enabled: mediaTrack?.enabled,
                  readyState: mediaTrack?.readyState,
                  muted: mediaTrack?.muted
                });
                
                tracksFound = true;
                viewerVideoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
                
                // Check video dimensions after a delay
                setTimeout(() => {
                  if (viewerVideoRef.current) {
                    const dims = {
                      videoWidth: viewerVideoRef.current.videoWidth,
                      videoHeight: viewerVideoRef.current.videoHeight,
                      readyState: viewerVideoRef.current.readyState
                    };
                    console.log('📐 Video element dimensions:', dims);
                    
                    if (dims.videoWidth > 0 && dims.videoHeight > 0) {
                      console.log('✅ Video data is flowing correctly');
                      setStreamLoadingState('ready');
                      if (trackTimeout) clearTimeout(trackTimeout);
                      if (recheckInterval) clearInterval(recheckInterval);
                    } else {
                      console.warn('⚠️ Video track attached but no video data');
                      setStreamLoadingState('waiting');
                    }
                  }
                }, 1000);
              }
            });
          });
          return tracksFound;
        };
        
        // Check for existing tracks immediately
        const foundTracks = attachExistingTracks();
        if (!foundTracks) {
          console.log('⏳ No tracks found yet, will keep checking...');
        }
        
        // Set up track subscription listener for new tracks
        liveKit.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
          console.log('📺 NEW Track subscribed:', {
            kind: track.kind,
            participant: participant.identity,
            enabled: track.mediaStreamTrack?.enabled,
            readyState: track.mediaStreamTrack?.readyState
          });
          
          if (viewerVideoRef.current && track.kind === 'video') {
            track.attach(viewerVideoRef.current);
            console.log('✅ Video track attached to viewer element');
            
            // Handle autoplay with muted video
            viewerVideoRef.current.muted = true;
            viewerVideoRef.current.play().catch(error => {
              console.log('⚠️ Autoplay prevented, user interaction needed:', error);
            });
            
            // Verify video dimensions after attachment
            setTimeout(() => {
              if (viewerVideoRef.current) {
                const dims = {
                  videoWidth: viewerVideoRef.current.videoWidth,
                  videoHeight: viewerVideoRef.current.videoHeight,
                  readyState: viewerVideoRef.current.readyState
                };
                console.log('📐 Video element state after subscription:', dims);
                
                if (dims.videoWidth === 0 || dims.videoHeight === 0) {
                  console.error('❌ Video track attached but no video data flowing');
                  setStreamLoadingState('error');
                } else {
                  console.log('✅ Video data confirmed');
                  setStreamLoadingState('ready');
                  if (trackTimeout) clearTimeout(trackTimeout);
                  if (recheckInterval) clearInterval(recheckInterval);
                }
              }
            }, 1000);
          }
        });

        // Recheck for tracks every 2 seconds in case of race condition
        recheckInterval = setInterval(() => {
          if (streamLoadingState !== 'ready') {
            console.log('🔄 Rechecking for tracks...');
            const found = attachExistingTracks();
            if (found) {
              console.log('✅ Found tracks on recheck');
            }
          }
        }, 2000);
        
        // Set timeout for error state if no video after 15 seconds
        trackTimeout = setTimeout(() => {
          if (streamLoadingState !== 'ready') {
            console.error('⚠️ No video received after 15 seconds');
            setStreamLoadingState('error');
            toast({
              title: "Stream not available",
              description: "The host's video is not available. Please try again.",
              variant: "destructive"
            });
          }
        }, 15000);
      }
      
      toast({
        title: "Joined stream",
        description: `Watching ${stream.title}`,
      });
      
      console.log('✅ Successfully joined stream');
    } catch (error: any) {
      console.error('❌ Error joining stream:', error);
      
      // Cleanup on error
      if (trackTimeout) clearTimeout(trackTimeout);
      if (recheckInterval) clearInterval(recheckInterval);
      await liveKit.disconnect();
      setViewingStream(null);
      setIsViewerMode(false);
      setStreamLoadingState('connecting');
      
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
      console.log('Leaving LiveKit stream...');
      
      // Disconnect from LiveKit
      await liveKit.disconnect();
      
      // Decrement viewer count
      const {
        error
      } = await supabase.from('streaming_sessions').update({
        current_viewers: Math.max(0, viewingStream.current_viewers - 1)
      }).eq('id', viewingStream.id);
      if (error) console.error('Error leaving stream:', error);
      
      setViewingStream(null);
      setIsViewerMode(false);
      setHasLiked(false);
      setViewerVolumeMuted(true); // Reset for next stream
      setStreamLoadingState('connecting');
      
      toast({
        title: "Left stream",
        description: "You've left the stream"
      });
      
      console.log('✓ Left stream successfully');
    } catch (error: any) {
      console.error('Error leaving stream:', error);
    }
  };
  const handleLike = () => {
    if (!hasLiked) {
      setHasLiked(true);
      setTotalLikes(prev => prev + 1);
      toast({
        title: "Liked!",
        description: "Your appreciation has been sent to the host"
      });
    }
  };
  const handleGift = () => {
    toast({
      title: "Send Gift",
      description: "Gift sending feature coming soon!"
    });
  };
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/app/streaming?stream=${viewingStream?.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: viewingStream?.title,
          text: `Watch ${viewingStream?.host_name}'s live stream!`,
          url: shareUrl
        });
      } catch (error) {
        console.log('Share cancelled or failed:', error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copied!",
        description: "Stream link copied to clipboard"
      });
    }
  };
  // Stream viewer mode
  if (isViewerMode && viewingStream) {
    return <div className="min-h-screen dark bg-background">
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
              onLoadedMetadata={() => {
                console.log('✓ Viewer video metadata loaded');
                if (viewerVideoRef.current) {
                  console.log('Video dimensions:', {
                    videoWidth: viewerVideoRef.current.videoWidth,
                    videoHeight: viewerVideoRef.current.videoHeight
                  });
                }
              }}
              onPlay={() => console.log('✓ Viewer video playing')}
              onLoadedData={() => {
                console.log('✓ Viewer video data loaded');
                setStreamLoadingState('ready');
              }}
            />
            
            {/* Loading/Error States */}
            {streamLoadingState === 'connecting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-white text-lg">Connecting to stream...</p>
                </div>
              </div>
            )}

            {streamLoadingState === 'waiting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-white text-lg mb-2">Waiting for video...</p>
                  <p className="text-gray-400 text-sm">Host is setting up their stream</p>
                </div>
              </div>
            )}

            {streamLoadingState === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                  <p className="text-white text-lg mb-2">Unable to load stream</p>
                  <p className="text-gray-400 text-sm mb-4">The host's video is not available</p>
                  <Button 
                    onClick={() => {
                      leaveStream();
                      window.location.reload();
                    }}
                    variant="outline"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh & Retry
                  </Button>
                </div>
              </div>
            )}
            
            {/* Unmute Button Overlay */}
            {viewerVolumeMuted && streamLoadingState === 'ready' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Button 
                  size="lg"
                  className="pointer-events-auto bg-black/70 hover:bg-black/90 text-white backdrop-blur-sm"
                  onClick={() => {
                    if (viewerVideoRef.current) {
                      viewerVideoRef.current.muted = false;
                      setViewerVolumeMuted(false);
                    }
                  }}
                >
                  <Volume2 className="w-5 h-5 mr-2" />
                  Tap to Unmute
                </Button>
              </div>
            )}
            
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

            {/* Floating Reactions */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {reactions.map(reaction => <div key={reaction.id} className="absolute bottom-0 animate-[slide-up_3s_ease-out_forwards] opacity-0" style={{
              left: `${reaction.x}%`,
              animation: 'slide-up 3s ease-out forwards'
            }}>
                  {reaction.type === 'heart' && <Heart className="w-8 h-8 text-red-500 fill-red-500" />}
                  {reaction.type === 'thumbsup' && <ThumbsUp className="w-8 h-8 text-blue-500 fill-blue-500" />}
                  {reaction.type === 'laugh' && <Laugh className="w-8 h-8 text-yellow-500 fill-yellow-500" />}
                  {reaction.type === 'rose' && <Flower2 className="w-8 h-8 text-pink-500 fill-pink-500" />}
                </div>)}
            </div>

            {/* Reaction Buttons */}
            <div className="absolute bottom-20 right-4 flex flex-col gap-2">
              <Button size="icon" className="rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm border-0" onClick={() => sendReaction('heart')}>
                <Heart className="w-5 h-5 text-red-500" />
              </Button>
              <Button size="icon" className="rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm border-0" onClick={() => sendReaction('thumbsup')}>
                <ThumbsUp className="w-5 h-5 text-blue-500" />
              </Button>
              <Button size="icon" className="rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm border-0" onClick={() => sendReaction('laugh')}>
                <Laugh className="w-5 h-5 text-yellow-500" />
              </Button>
              <Button size="icon" className="rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm border-0" onClick={() => sendReaction('rose')}>
                <Flower2 className="w-5 h-5 text-pink-500" />
              </Button>
            </div>
          </div>

          {/* Stream Info and Actions */}
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">About this stream</h3>
              <p className="text-muted-foreground">{viewingStream.description}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant={hasLiked ? "default" : "outline"} size="sm" onClick={handleLike} disabled={hasLiked}>
                <Heart className={`w-4 h-4 mr-2 ${hasLiked ? 'fill-current' : ''}`} />
                {hasLiked ? 'Liked' : 'Like'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleGift}>
                <Gift className="w-4 h-4 mr-2" />
                Send Gift
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>;
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

            {!user ? <div className="text-center py-12">
                <p className="text-muted-foreground">Please log in to discover live streams</p>
              </div> : liveStreams.length === 0 ? <div className="text-center py-12 col-span-full">
                <p className="text-muted-foreground">No live streams at the moment. Check back soon!</p>
              </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {liveStreams.map(stream => <Card key={stream.id} className="cultural-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => joinStream(stream)}>
                  <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-accent/20">
                    <img 
                      src={stream.thumbnail} 
                      alt={stream.title}
                      className="w-full h-full object-cover"
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
                  
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={stream.thumbnail} />
                        <AvatarFallback>{stream.host_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                          {stream.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {stream.host_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {stream.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>)}
              </div>}

            {/* Premium Live Events */}
            <Card className="premium-gradient p-6 text-center mt-12">
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
                        <SelectItem value="gaming">Gaming</SelectItem>
                        <SelectItem value="anime">Anime</SelectItem>
                        <SelectItem value="luxury-vehicles">Luxury Vehicles</SelectItem>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="others">Others</SelectItem>
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
                    {isCameraOn ? <video 
                      ref={videoRef} 
                      autoPlay 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover" 
                      style={{ 
                        filter: `brightness(${videoBrightness}%)`,
                        visibility: 'visible',
                        opacity: 1
                      }}
                    /> : <div className="w-full h-full flex items-center justify-center text-white">
                        <VideoOff className="w-12 h-12" />
                      </div>}
                    
                    {isStreaming && <Badge className="absolute top-2 left-2 bg-red-500 text-white">
                        <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                        LIVE
                      </Badge>}
                  </div>

                   {/* Brightness Control */}
                  {isCameraOn && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="brightness" className="text-xs">Preview Brightness</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs max-w-xs">Adjusts your preview only. Viewers see the original brightness.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-center gap-2">
                          {detectedBrightness !== null && (
                            <span className={`text-xs font-medium ${
                              detectedBrightness < 30 ? 'text-destructive' : 
                              detectedBrightness < 50 ? 'text-yellow-500' : 
                              'text-green-500'
                            }`}>
                              Detected: {detectedBrightness}%
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">Filter: {videoBrightness}%</span>
                          {videoBrightness !== 100 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 text-xs"
                              onClick={() => setVideoBrightness(100)}
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>
                      <input
                        id="brightness"
                        type="range"
                        min="80"
                        max="150"
                        value={videoBrightness}
                        onChange={(e) => setVideoBrightness(Number(e.target.value))}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                      {showBrightnessWarning && detectedBrightness !== null && detectedBrightness < 30 && (
                        <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
                          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-destructive font-medium">Low brightness detected ({detectedBrightness}%)</p>
                            <p className="text-muted-foreground">Improve room lighting or adjust camera settings before going live</p>
                          </div>
                        </div>
                      )}
                      {videoBrightness < 90 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          ⚠️ Preview may look too dark
                        </p>
                      )}
                    </div>
                  )}

                  {/* Controls */}
                  <div className="mt-4 space-y-3">
                    {/* Permissions Status */}
                    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Camera:</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            permissionStatus.camera === 'granted' ? "default" : 
                            permissionStatus.camera === 'denied' ? "destructive" : 
                            "secondary"
                          }>
                            {permissionStatus.camera === 'granted' && hasCameraPermission && isCameraOn ? "✓ Ready" : 
                             permissionStatus.camera === 'denied' ? "Blocked" : 
                             hasCameraPermission && !isCameraOn ? "Off" :
                             "Not Ready"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Microphone:</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            permissionStatus.microphone === 'granted' ? "default" : 
                            permissionStatus.microphone === 'denied' ? "destructive" : 
                            "secondary"
                          }>
                            {permissionStatus.microphone === 'granted' && hasMicPermission && isMicOn ? "✓ Ready" : 
                             permissionStatus.microphone === 'denied' ? "Blocked" : 
                             hasMicPermission && !isMicOn ? "Off" :
                             "Not Ready"}
                          </Badge>
                        </div>
                      </div>
                      {(permissionStatus.camera === 'denied' || permissionStatus.microphone === 'denied') && (
                        <p className="text-xs text-destructive mt-2">
                          Open your browser settings and allow camera/microphone access
                        </p>
                      )}
                      {isStreaming && audioDetected && (
                        <div className="flex items-center gap-2 text-sm text-success">
                          <CheckCircle className="w-4 h-4" />
                          <span>Audio detected ✓</span>
                        </div>
                      )}
                    </div>

                    {/* VU Meter */}
                    {hasMicPermission && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <AudioVUMeter stream={streamRef.current} isEnabled={isMicOn} />
                      </div>
                    )}

                    {/* Device Selector */}
                    {(hasCameraPermission || hasMicPermission) && (
                      <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Device Selection</Label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 text-xs"
                            onClick={resetDevices}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Reset
                          </Button>
                        </div>
                        <DeviceSelector onDeviceChange={handleDeviceChange} />
                      </div>
                    )}
                    
                    {/* Permission Buttons */}
                    {(!hasCameraPermission || !hasMicPermission) && <div className="grid grid-cols-2 gap-2">
                        {!hasCameraPermission && <Button onClick={() => initializeCamera()} disabled={isRequestingCamera} variant="outline" size="sm">
                            <Video className="w-4 h-4 mr-2" />
                            {isRequestingCamera ? 'Enabling...' : 'Enable Camera'}
                          </Button>}
                        {!hasMicPermission && <Button onClick={() => initializeMicrophone()} disabled={isRequestingMic} variant="outline" size="sm">
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
                  <div className="mt-6 space-y-2">
                    {!isStreaming ? (
                      <>
                        <Button 
                          onClick={startStream} 
                          disabled={!streamTitle.trim() || isLoading || !hasCameraPermission || !hasMicPermission || !isCameraOn || !isMicOn} 
                          className="w-full bg-red-500 hover:bg-red-600 text-white" 
                          size="lg"
                        >
                          {isLoading ? 'Starting...' : '🔴 Go Live'}
                        </Button>
                        {(!hasCameraPermission || !hasMicPermission) && (
                          <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                            ⚠️ Please enable camera and microphone to go live
                          </p>
                        )}
                        {hasCameraPermission && hasMicPermission && (!isCameraOn || !isMicOn) && (
                          <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                            ⚠️ Please turn on camera and microphone
                          </p>
                        )}
                        {!streamTitle.trim() && hasCameraPermission && hasMicPermission && (
                          <p className="text-sm text-muted-foreground text-center">
                            Enter a stream title to continue
                          </p>
                        )}
                      </>
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