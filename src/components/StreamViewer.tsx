import React, { useEffect, useRef, useState } from 'react';
import { ViewerConnection, ConnectionState } from '@/utils/ViewerConnection';
import { ViewerToHostBroadcast } from '@/utils/ViewerToHostBroadcast';
import { ViewerCameraReceiver } from '@/utils/ViewerCameraReceiver';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Volume2, VolumeX, Gift, MessageCircle, ChevronRight, ChevronLeft, Users, UserCircle, Loader2, Play, RefreshCw, Router, Zap, Video, VideoOff } from 'lucide-react';
import { GiftSelector } from '@/components/GiftSelector';
import { CurrencyWallet } from '@/components/CurrencyWallet';
import { LiveStreamChat } from '@/components/LiveStreamChat';
import { FloatingActionButtons } from '@/components/FloatingActionButtons';
import { LikeAnimation } from '@/components/LikeAnimation';
import { ViewerCameraThumbnails } from '@/components/ViewerCameraThumbnails';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useStreamViewers } from '@/hooks/useStreamViewers';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface StreamViewerProps {
  streamId: string;
  streamTitle: string;
  hostName: string;
  hostUserId: string;
  onClose: () => void;
}

const StreamViewer: React.FC<StreamViewerProps> = ({
  streamId,
  streamTitle,
  hostName,
  hostUserId,
  onClose
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);
  const viewerConnectionRef = useRef<ViewerConnection | null>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isConnected, setIsConnected] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [showGiftSelector, setShowGiftSelector] = useState(false);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [showChat, setShowChat] = useState(!isMobile); // Hide chat by default on mobile
  const [isLiked, setIsLiked] = useState(false);
  const [totalLikes, setTotalLikes] = useState(0);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [likeAnimationTrigger, setLikeAnimationTrigger] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const { viewers, isLoading: viewersLoading } = useStreamViewers(streamId);
  
  // Viewer camera states
  const [viewerCameraEnabled, setViewerCameraEnabled] = useState(false);
  const [viewerStream, setViewerStream] = useState<MediaStream | null>(null);
  const viewerBroadcastRef = useRef<ViewerToHostBroadcast | null>(null);
  const [isCameraRequesting, setIsCameraRequesting] = useState(false);
  
  // Viewer camera receiver (for seeing other viewers' cameras)
  const viewerCameraReceiverRef = useRef<ViewerCameraReceiver | null>(null);
  const [viewerCameras, setViewerCameras] = useState<Map<string, any>>(new Map());

  const getConnectionMessage = (state: ConnectionState): string => {
    switch (state) {
      case 'checking_broadcaster': return 'Verifying broadcaster online...';
      case 'joining': return 'Joining stream via database...';
      case 'awaiting_offer': return 'Requesting WebRTC connection...';
      case 'processing_offer': return 'Establishing peer connection...';
      case 'awaiting_ice': return 'Negotiating optimal route...';
      case 'connected': return 'Connected! Loading video stream...';
      case 'streaming': return 'Live';
      case 'awaiting_user_interaction': return 'Click to unmute and play';
      case 'failed': return 'Connection lost - Reconnecting automatically...';
      case 'timeout': return 'Connection timeout - Trying alternate route...';
      default: return 'Initializing...';
    }
  };

  // Setup video element event listeners early
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    console.log('📹 Setting up video element event listeners');
    
    const handleLoadedMetadata = () => {
      console.log(`📹 Video metadata loaded: ${videoEl.videoWidth}x${videoEl.videoHeight}, readyState: ${videoEl.readyState}`);
      
      // Log all tracks when metadata loads
      if (videoEl.srcObject && videoEl.srcObject instanceof MediaStream) {
        const stream = videoEl.srcObject;
        console.log('📹 Stream tracks at metadata:');
        stream.getTracks().forEach(track => {
          console.log(`  ${track.kind}: enabled=${track.enabled}, state=${track.readyState}, muted=${track.muted}`);
          
          // Setup track event listeners
          track.onended = () => console.log(`❌ ${track.kind} track ended`);
          track.onmute = () => console.log(`🔇 ${track.kind} track muted`);
          track.onunmute = () => console.log(`🔊 ${track.kind} track unmuted`);
        });
        
        const hasAudio = stream.getAudioTracks().length > 0;
        const hasVideo = stream.getVideoTracks().length > 0;
        console.log(`✓ Stream has: ${hasVideo ? '✅ Video' : '❌ Video'} ${hasAudio ? '✅ Audio' : '❌ Audio'}`);
      }
    };
    
    const handleCanPlay = () => {
      console.log('📹 Video can play - buffered enough data');
    };
    
    const handlePlaying = () => {
      console.log('📹 Video is playing!');
      setHasVideo(true);
      setConnectionState('streaming');
    };
    
    const handlePlay = () => {
      console.log('📹 Video play event fired');
    };
    
    const handleWaiting = () => {
      console.log('⏳ Video is buffering/waiting for data');
    };
    
    const handleStalled = () => {
      console.warn('⚠️ Video playback stalled');
    };
    
    const handleError = (e: Event) => {
      console.error('❌ Video error:', {
        error: videoEl.error,
        networkState: videoEl.networkState,
        readyState: videoEl.readyState
      });
    };

    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoEl.addEventListener('canplay', handleCanPlay);
    videoEl.addEventListener('playing', handlePlaying);
    videoEl.addEventListener('play', handlePlay);
    videoEl.addEventListener('waiting', handleWaiting);
    videoEl.addEventListener('stalled', handleStalled);
    videoEl.addEventListener('error', handleError);

    return () => {
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.removeEventListener('canplay', handleCanPlay);
      videoEl.removeEventListener('playing', handlePlaying);
      videoEl.removeEventListener('play', handlePlay);
      videoEl.removeEventListener('waiting', handleWaiting);
      videoEl.removeEventListener('stalled', handleStalled);
      videoEl.removeEventListener('error', handleError);
    };
  }, []);

  // Initialize viewer and load like status - AUTO-CONNECT immediately
  useEffect(() => {
    const initViewer = async () => {
      if (!videoRef.current) return;
      
      // Ensure video element is properly configured for immediate playback
      const videoEl = videoRef.current;
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;
      console.log('📹 Video element configured for auto-connection: autoplay, playsInline, muted');

      // Join stream and get session token
      const displayName = user?.email?.split('@')[0] || 'Guest';
      
      console.log('Attempting to join stream:', { streamId, displayName, isGuest: !user });
      
      const { data: joinData, error: joinError } = await supabase.rpc('join_stream_as_viewer', {
        p_stream_id: streamId,
        p_display_name: displayName,
        p_is_guest: !user
      });

      if (joinError) {
        console.error('Error joining stream:', joinError);
        toast.error('Failed to join stream: ' + joinError.message);
        return;
      }

      console.log('Join stream response:', joinData);

      const token = (joinData as any)?.session_token as string;
      if (!token) {
        console.error('No session token received from join stream');
        toast.error('Failed to establish viewer session');
        return;
      }
      
      setSessionToken(token);

      viewerConnectionRef.current = new ViewerConnection(
        streamId,
        token,
        videoRef.current,
        displayName,
        !user,
        (state) => setConnectionState(state)
      );

      // Listen for video tracks to confirm we're receiving video
      const video = videoRef.current;
      video.onloadedmetadata = () => {
        console.log('✓ Video metadata loaded:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          duration: video.duration,
          readyState: video.readyState
        });
        setHasVideo(true);
      };
      
      video.oncanplay = () => {
        console.log('✓ Video can play');
      };

      video.onplaying = () => {
        console.log('✓ Video is playing');
      };

      video.onplay = () => {
        console.log('✓ Video play event fired');
        setHasVideo(true);
      };

      video.onerror = (e) => {
        console.error('❌ Video element error:', video.error);
      };

      video.onstalled = () => {
        console.warn('⚠️ Video playback stalled');
      };

      video.onwaiting = () => {
        console.warn('⚠️ Video waiting for data');
      };

      await viewerConnectionRef.current.connect(supabase);
      setIsConnected(true);

      // Load initial like status and count
      if (user) {
        const { data: likeData } = await supabase
          .from('stream_likes')
          .select('id')
          .eq('stream_id', streamId)
          .eq('user_id', user.id)
          .single();
        
        setIsLiked(!!likeData);
      }

      const { data: sessionData } = await supabase
        .from('streaming_sessions')
        .select('total_likes')
        .eq('id', streamId)
        .single();
      
      if (sessionData) {
        setTotalLikes(sessionData.total_likes || 0);
      }
    };

    const hardResetViewerConnection = async () => {
      console.log('♻️ Hard resetting viewer connection');

      const token = sessionToken;
      if (viewerConnectionRef.current) {
        viewerConnectionRef.current.disconnect();
        viewerConnectionRef.current = null;
      }

      if (token) {
        try {
          await supabase.rpc('leave_stream_viewer', { p_session_token: token });
          console.log('✓ Left stream as part of hard reset');
        } catch (err) {
          console.error('❌ Error leaving stream during hard reset:', err);
        }
      }

      setSessionToken(null);
      setConnectionState('disconnected');
      setHasVideo(false);
      setIsConnected(false);

      // Re-run the join flow
      await initViewer();
    };

    // Expose reset function globally for testing
    (window as any).hardResetViewerConnection = hardResetViewerConnection;

    initViewer();
    
    // Cleanup on unmount
    return () => {
      console.log('🧹 StreamViewer unmounting, cleaning up...');
      
      // Only cleanup if we actually have a connection
      const hasActiveConnection = viewerConnectionRef.current !== null;
      
      // Disconnect viewer connection
      if (hasActiveConnection) {
        viewerConnectionRef.current.disconnect();
        viewerConnectionRef.current = null;
      }
      
      // Cleanup viewer camera receiver
      if (viewerCameraReceiverRef.current) {
        viewerCameraReceiverRef.current.cleanup();
        viewerCameraReceiverRef.current = null;
      }
      
      // Leave stream - only if we successfully joined
      (async () => {
        if (sessionToken && hasActiveConnection) {
          try {
            await supabase.rpc('leave_stream_viewer', {
              p_session_token: sessionToken
            });
            console.log('✓ Left stream successfully');
          } catch (err) {
            console.error('❌ Error leaving stream:', err);
          }
        }
      })();
      
      // Stop video playback
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  }, [streamId, user, hostUserId]);

  // Initialize viewer camera receiver to see other viewers' cameras
  useEffect(() => {
    const initViewerCameraReceiver = async () => {
      if (!streamId) return;
      
      console.log('📹 Initializing viewer camera receiver for stream', streamId);
      
      const receiver = new ViewerCameraReceiver(streamId, (cameras) => {
        console.log('📹 Viewer cameras updated, count:', cameras.size);
        setViewerCameras(new Map(cameras));
      });
      
      try {
        await receiver.initialize();
        viewerCameraReceiverRef.current = receiver;
        console.log('✅ Viewer camera receiver initialized');
      } catch (error) {
        console.error('❌ Failed to initialize viewer camera receiver:', error);
      }
    };
    
    initViewerCameraReceiver();
    
    return () => {
      if (viewerCameraReceiverRef.current) {
        viewerCameraReceiverRef.current.cleanup();
        viewerCameraReceiverRef.current = null;
      }
    };
  }, [streamId]);

  // Real-time likes subscription - show animation when anyone likes
  useEffect(() => {
    const channel = supabase
      .channel(`viewer_stream_likes_${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_likes',
          filter: `stream_id=eq.${streamId}`
        },
        () => {
          // Trigger animation for any like from any viewer
          setShowLikeAnimation(true);
          setLikeAnimationTrigger(prev => prev + 1);
          setTotalLikes(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streaming_sessions',
          filter: `id=eq.${streamId}`
        },
        (payload) => {
          if (payload.new && 'total_likes' in payload.new) {
            setTotalLikes(payload.new.total_likes || 0);
          }
          
          // Monitor stream status - if host ends stream, close viewer automatically
          if (payload.new && 'status' in payload.new) {
            const newStatus = (payload.new as any).status;
            if (newStatus === 'ended' || newStatus === 'archived') {
              console.log('🔴 Stream has ended by host, cleaning up viewer...');
              
              // Cleanup connection
              if (viewerConnectionRef.current) {
                viewerConnectionRef.current.disconnect();
                viewerConnectionRef.current = null;
              }
              
              // Stop video
              if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.srcObject = null;
              }
              
              // Show notification and close
              toast.error('Stream has ended');
              setTimeout(() => onClose(), 500);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Connection watchdog - monitors and auto-reconnects if needed
  useEffect(() => {
    if (!viewerConnectionRef.current) return;

    const watchdogInterval = setInterval(() => {
      // Auto-reconnect if stuck in failed or disconnected state for too long
      if (connectionState === 'disconnected' || connectionState === 'failed') {
        console.log('🔍 Watchdog: Detected disconnected/failed state, triggering reconnection');
        handleHardReconnect();
      }
    }, 10000); // Check every 10 seconds

    return () => {
      clearInterval(watchdogInterval);
    };
  }, [connectionState]);

  // Connect viewer's own camera stream to self-view video element
  useEffect(() => {
    const videoEl = viewerVideoRef.current;
    if (!videoEl || !viewerStream) return;

    console.log('📹 Connecting viewer stream to self-view video element');
    videoEl.srcObject = viewerStream;
    
    // Ensure video plays
    videoEl.play().catch(err => {
      console.warn('⚠️ Self-view video autoplay failed:', err);
    });

    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [viewerStream]);

  const toggleMute = async () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
      
      // Try to play video if unmuting and video is paused
      if (!videoRef.current.muted && videoRef.current.paused) {
        try {
          await videoRef.current.play();
          console.log('✅ Video started playing after unmute');
        } catch (err) {
          console.warn('⚠️ Could not play after unmute:', err);
        }
      }
    }
  };

  const handlePlayVideo = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.play();
        console.log('✅ Manual play succeeded');
        setConnectionState('streaming');
      } catch (err) {
        console.error('❌ Manual play failed:', err);
        toast.error('Failed to start video playback');
      }
    }
  };

  const handleSendMessage = () => {
    if (!user) {
      toast.error('Please sign in to message the host');
      return;
    }
    navigate('/app/messages', { state: { selectedUser: hostUserId } });
  };

  const handleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like');
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from('stream_likes')
          .delete()
          .eq('stream_id', streamId)
          .eq('user_id', user.id);
        
        setIsLiked(false);
        setTotalLikes(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('stream_likes')
          .insert({ stream_id: streamId, user_id: user.id });
        
        setIsLiked(true);
        setTotalLikes(prev => prev + 1);
        setShowLikeAnimation(true);
        setLikeAnimationTrigger(prev => prev + 1);
        
        setTimeout(() => setShowLikeAnimation(false), 2000);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like stream');
    }
  };

  const handleChatToggle = () => {
    if (isMobile) {
      setShowChat(!showChat);
    } else {
      setShowChat(!showChat);
    }
  };

  const handleHardReconnect = async () => {
    if (viewerConnectionRef.current) {
      await viewerConnectionRef.current.hardReconnect(supabase);
      toast.info('Reconnecting to stream...');
    }
  };

  const handleRequestOfferAgain = () => {
    if (viewerConnectionRef.current) {
      viewerConnectionRef.current.requestOfferManually();
      toast.info('Requesting connection offer...');
    }
  };

  const handleTryTURNOnly = async () => {
    if (viewerConnectionRef.current) {
      await viewerConnectionRef.current.tryTURNOnly(supabase);
      toast.info('Switching to TURN relay...');
    }
  };

  const toggleViewerCamera = async () => {
    if (viewerCameraEnabled) {
      // Disable camera
      if (viewerBroadcastRef.current) {
        viewerBroadcastRef.current.cleanup();
        viewerBroadcastRef.current = null;
      }
      if (viewerStream) {
        viewerStream.getTracks().forEach(track => track.stop());
        setViewerStream(null);
      }
      setViewerCameraEnabled(false);
      toast.success('Camera disabled');
    } else {
      // Enable camera
      setIsCameraRequesting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false
        });
        
        setViewerStream(stream);
        
        if (sessionToken) {
          const broadcast = new ViewerToHostBroadcast(
            streamId,
            sessionToken,
            stream,
            (state) => {
              console.log('Viewer camera connection state:', state);
            }
          );
          
          await broadcast.initialize();
          await broadcast.updateCameraStatus(true);
          viewerBroadcastRef.current = broadcast;
          
          setViewerCameraEnabled(true);
          toast.success('Camera enabled! Host can now see you');
        }
      } catch (error: any) {
        console.error('Error enabling camera:', error);
        if (error.name === 'NotAllowedError') {
          toast.error('Camera permission denied');
        } else if (error.name === 'NotFoundError') {
          toast.error('No camera found');
        } else {
          toast.error('Failed to enable camera');
        }
      } finally {
        setIsCameraRequesting(false);
      }
    }
  };

  // Cleanup viewer camera on unmount
  useEffect(() => {
    return () => {
      if (viewerBroadcastRef.current) {
        viewerBroadcastRef.current.cleanup();
      }
      if (viewerStream) {
        viewerStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Monitor connection state changes and show user feedback
  useEffect(() => {
    if (connectionState === 'connected') {
      toast.success('Connected to stream!');
    } else if (connectionState === 'failed') {
      toast.error('Connection lost - Auto-reconnecting...');
    } else if (connectionState === 'timeout') {
      toast.warning('Connection timeout - Retrying...');
    } else if (connectionState === 'streaming') {
      toast.success('Stream playing!');
    }
  }, [connectionState]);
  useEffect(() => {
    if (connectionState === 'timeout' || connectionState === 'failed') {
      toast.error('Connection lost - Auto-reconnecting...', { duration: 3000 });
    } else if (connectionState === 'streaming') {
      toast.success('Connected successfully!', { duration: 2000 });
    }
  }, [connectionState]);

  const showConnectionControls = ['awaiting_offer', 'awaiting_ice', 'failed', 'timeout'].includes(connectionState);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black/80 p-3 md:p-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm md:text-lg font-semibold truncate">{streamTitle}</h2>
            <p className="text-xs md:text-sm text-gray-300 truncate">{hostName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {/* Camera Toggle Button */}
          <Button
            variant={viewerCameraEnabled ? "default" : "ghost"}
            size="sm"
            onClick={toggleViewerCamera}
            disabled={isCameraRequesting}
            className={viewerCameraEnabled ? "gap-2 bg-primary hover:bg-primary/90" : "gap-2 text-white hover:bg-white/20"}
          >
            {isCameraRequesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : viewerCameraEnabled ? (
              <Video className="w-4 h-4" />
            ) : (
              <VideoOff className="w-4 h-4" />
            )}
            <span className="hidden md:inline">Camera</span>
          </Button>
          
          {/* Desktop Message Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSendMessage}
            className="gap-2 text-white hover:bg-white/20 hidden md:flex"
          >
            <MessageCircle className="w-4 h-4" />
            Message
          </Button>
          <CurrencyWallet onBuyCoins={() => setShowCoinShop(true)} />
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 flex flex-col relative bg-black overflow-hidden">
        <div className="flex-1 relative flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain md:max-w-md md:mx-auto"
          />
          
          {connectionState !== 'streaming' && (
            <div className="absolute inset-0 flex items-center justify-center flex-col space-y-3 bg-black p-4">
              {connectionState === 'awaiting_user_interaction' ? (
                <div className="flex flex-col items-center gap-4">
                  <Button
                    onClick={handlePlayVideo}
                    size="lg"
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Play className="w-6 h-6 mr-2" />
                    Tap to Play Video
                  </Button>
                  <p className="text-white text-sm">Autoplay was blocked. Click to start.</p>
                </div>
              ) : (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-white" />
                  <p className="text-white font-medium text-sm md:text-base">{getConnectionMessage(connectionState)}</p>
                </>
              )}
              
              {(connectionState === 'failed' || connectionState === 'timeout') && (
                <div className="flex flex-col gap-2 mt-4 w-full max-w-xs">
                  <p className="text-white/70 text-sm text-center mb-2">
                    Auto-reconnecting... or try manually:
                  </p>
                  <Button
                    onClick={handleRequestOfferAgain}
                    variant="outline"
                    className="text-white border-white hover:bg-white hover:text-black w-full"
                  >
                    <Router className="w-4 h-4 mr-2" />
                    Request Connection
                  </Button>
                  <Button
                    onClick={handleTryTURNOnly}
                    variant="outline"
                    className="text-white border-white hover:bg-white hover:text-black w-full"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Try TURN Relay
                  </Button>
                  <Button
                    onClick={handleHardReconnect}
                    variant="default"
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Full Reconnect
                  </Button>
                </div>
              )}

              {showConnectionControls && connectionState !== 'failed' && connectionState !== 'timeout' && (
                <div className="flex flex-col gap-2 mt-4 w-full max-w-xs">
                  <Button
                    onClick={handleRequestOfferAgain}
                    variant="outline"
                    size="sm"
                    className="text-white border-white/50 hover:bg-white/10 w-full"
                  >
                    <Router className="w-4 h-4 mr-2" />
                    Request Connection
                  </Button>
                  <Button
                    onClick={handleTryTURNOnly}
                    variant="outline"
                    size="sm"
                    className="text-white border-white/50 hover:bg-white/10 w-full"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Try TURN Relay
                  </Button>
                </div>
              )}
              
            </div>
          )}
          
          {connectionState === 'streaming' && (
            <>
              <Badge 
                className="absolute top-2 left-2 md:top-4 md:left-4 bg-green-500 text-white text-xs"
              >
                <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                <span className="hidden md:inline">LIVE</span>
                <span className="md:hidden">LIVE</span>
              </Badge>
            </>
          )}

          {/* Self-View Camera Preview */}
          {viewerCameraEnabled && viewerStream && (
            <div className="absolute bottom-4 left-4 w-32 h-24 md:w-40 md:h-30 rounded-lg overflow-hidden border-2 border-primary shadow-lg bg-black">
              <video
                ref={viewerVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute top-1 left-1 bg-black/70 px-2 py-0.5 rounded text-white text-xs font-medium">
                You
              </div>
            </div>
          )}
        </div>

        {/* Chat Below Video - Desktop Only */}
        {showChat && !isMobile && (
          <div className="h-48 border-t border-border bg-background">
            <LiveStreamChat streamId={streamId} isMobile={false} />
          </div>
        )}
        
        {/* Viewer Cameras Thumbnails */}
        {viewerCameras.size > 0 && (
          <div className="border-t border-border bg-background p-4">
            <ViewerCameraThumbnails viewerCameras={viewerCameras} />
          </div>
        )}
      </div>

      {/* Mobile FABs */}
      <FloatingActionButtons
        isLiked={isLiked}
        totalLikes={totalLikes}
        onLike={handleLike}
        onGift={() => setShowGiftSelector(true)}
        onChat={handleChatToggle}
      />

      {/* Mobile Chat Sheet */}
      <Sheet open={showChat && isMobile} onOpenChange={(open) => isMobile && setShowChat(open)}>
        <SheetContent side="bottom" className="h-[80vh] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Live Chat</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-64px)]">
            <LiveStreamChat streamId={streamId} isMobile={true} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Like Animation */}
      <LikeAnimation
        key={likeAnimationTrigger}
        show={showLikeAnimation} 
        onComplete={() => setShowLikeAnimation(false)} 
      />

      {/* Bottom Controls */}
      <div className="bg-black/80 p-3 md:p-4 flex items-center justify-between gap-2">
        <Button
          variant={isMuted ? "destructive" : "ghost"}
          size="icon"
          onClick={toggleMute}
          className="h-10 w-10"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSendMessage}
          className="gap-2 text-white md:hidden"
        >
          <MessageCircle className="w-4 h-4" />
          Message Host
        </Button>
        
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="default"
            size="lg"
            onClick={() => setShowGiftSelector(true)}
            className="gap-2"
          >
            <Gift className="w-5 h-5" />
            Send Gift
          </Button>
          <Button
            variant="default"
            size="lg"
            onClick={handleSendMessage}
            className="gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            Message Host
          </Button>
        </div>
      </div>

      {user && (
        <GiftSelector
          open={showGiftSelector}
          onOpenChange={setShowGiftSelector}
          receiverId={hostUserId}
          receiverName={hostName}
        />
      )}
    </div>
  );
};

export default StreamViewer;
