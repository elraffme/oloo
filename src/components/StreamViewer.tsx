import React, { useEffect, useRef, useState } from 'react';
import { useStream } from '@/hooks/useStream';

type ConnectionState = 'disconnected' | 'checking_broadcaster' | 'joining' | 'awaiting_offer' | 'processing_offer' | 'awaiting_ice' | 'connected' | 'streaming' | 'awaiting_user_interaction' | 'failed' | 'timeout';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Volume2, VolumeX, Gift, MessageCircle, ChevronRight, ChevronLeft, Users, UserCircle, Loader2, Play, RefreshCw, Router, Zap, Video, VideoOff, LogOut, Mic, MicOff } from 'lucide-react';
import { GiftSelector } from '@/components/GiftSelector';
import { CurrencyWallet } from '@/components/CurrencyWallet';
import { LiveStreamChat } from '@/components/LiveStreamChat';
import { FloatingActionButtons } from '@/components/FloatingActionButtons';
import { LikeAnimation } from '@/components/LikeAnimation';
import { VideoCallGrid } from '@/components/VideoCallGrid';
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
  const { initialize, remoteStream, cleanup, isConnected: isSFUConnected, isReconnecting, publishStream, unpublishStream, viewerStreams, toggleMute: toggleSFUMute, toggleVideo, localStream } = useStream();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isLeavingRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [showGiftSelector, setShowGiftSelector] = useState(false);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [showChat, setShowChat] = useState(false); // Chat closed by default on all devices
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
  const [isCameraRequesting, setIsCameraRequesting] = useState(false);
  const [confirmedViewerStream, setConfirmedViewerStream] = useState<MediaStream | null>(null);
  
  // Viewer microphone states
  const [viewerMicEnabled, setViewerMicEnabled] = useState(false);
  const [isMicRequesting, setIsMicRequesting] = useState(false);
  
  // Host stream state
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);

  // Debug logging for stream states
  useEffect(() => {
    console.log('👥 StreamViewer: viewerStreams changed', {
      count: viewerStreams.length,
      streams: viewerStreams.map(vs => ({
        id: vs.id,
        displayName: vs.displayName,
        tracks: vs.stream?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled }))
      }))
    });
  }, [viewerStreams]);

  useEffect(() => {
    console.log('📹 StreamViewer: Local stream state', {
      hasConfirmedStream: !!confirmedViewerStream,
      hasLocalStream: !!localStream,
      videoTracks: (confirmedViewerStream || localStream)?.getVideoTracks().length || 0,
      viewerCameraEnabled
    });
  }, [confirmedViewerStream, localStream, viewerCameraEnabled]);

  useEffect(() => {
    console.log('🎬 StreamViewer: Host stream state', {
      hasHostStream: !!hostStream,
      tracks: hostStream?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
    });
  }, [hostStream]);

  // Floating chat messages for viewer
  const [floatingMessages, setFloatingMessages] = useState<Array<{
    id: string;
    username: string;
    message: string;
  }>>([]);

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
        
        // Capture the host's stream for the VideoCallGrid
        setHostStream(stream);
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

      // Join stream and get session token
      const displayName = user?.email?.split('@')[0] || 'Guest';
      
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

      const token = (joinData as any)?.session_token as string;
      if (!token) return;
      
      setSessionToken(token);

      // Initialize SFU connection
      console.log('🔌 Connecting to SFU stream...');
      await initialize('viewer', {}, streamId);

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

    initViewer();
    
    // Cleanup on unmount - CRITICAL for rejoin to work
    return () => {
      console.log('🧹 StreamViewer unmounting, cleaning up...');
      
      // Always cleanup stream resources
      cleanup();
      
      // Reset local state
      setIsConnected(false);
      setHasVideo(false);
      setViewerCameraEnabled(false);
      setViewerMicEnabled(false);
      setHostStream(null);
      setConfirmedViewerStream(null);
      setConnectionState('disconnected');
      isLeavingRef.current = false;
      
      // Stop video element
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      
      // Leave stream in database
      if (sessionToken) {
        (async () => {
          try {
            await supabase.rpc('leave_stream_viewer', {
              p_session_token: sessionToken
            });
            console.log('Left stream successfully');
          } catch (error) {
            console.error('Error leaving stream:', error);
          }
        })();
      }
    };
  }, [streamId, user]);

  // Handle remote stream updates
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      console.log('🎥 Setting remote stream', remoteStream.id);
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(e => console.error('Error playing remote stream:', e));
      setHasVideo(true);
      setConnectionState('streaming');
    }
  }, [remoteStream]);



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
              cleanup();
              
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

  // Subscribe to chat messages for floating display
  useEffect(() => {
    const channel = supabase
      .channel(`viewer_chat_${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'stream_chat_messages',
        filter: `stream_id=eq.${streamId}`
      }, (payload) => {
        const newMsg = payload.new as any;
        setFloatingMessages(prev => [...prev.slice(-4), newMsg]);
        
        setTimeout(() => {
          setFloatingMessages(prev => prev.filter(m => m.id !== newMsg.id));
        }, 5000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Connection watchdog - monitors and shows reconnection status
  useEffect(() => {
    if (isReconnecting) {
      setConnectionState('failed');
      toast.info('Reconnecting to stream...');
    } else if (isSFUConnected && remoteStream) {
      setConnectionState('streaming');
    }
  }, [isSFUConnected, isReconnecting, remoteStream]);

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

  const handleLeaveStream = async () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    console.log('🚪 User manually leaving stream...');
    toast.info('Leaving stream...');

    try {


      // Stop viewer stream tracks (handled by cleanup())



      // Disconnect viewer connection
      cleanup();

      // Leave stream in database
      if (sessionToken) {
        await supabase.rpc('leave_stream_viewer', {
          p_session_token: sessionToken
        });
        console.log('✓ Left stream successfully');
      }

      // Stop video playback
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }

      // Reset states
      setViewerCameraEnabled(false);
      setViewerMicEnabled(false);
      setIsConnected(false);
      setHasVideo(false);

      toast.success('Left stream successfully');
    } catch (error) {
      console.error('❌ Error leaving stream:', error);
      toast.error('Failed to leave stream properly');
    } finally {
      // Always call onClose to return to stream list
      onClose();
    }
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
      cleanup();
      await initialize('viewer', {}, streamId);
      toast.info('Reconnecting to stream...');
  };

  const handleRequestOfferAgain = () => {
      toast.info('Connection is handled automatically.');
  };

  const handleTryTURNOnly = async () => {
      toast.info('Connection is handled automatically.');
  };

  const toggleViewerCamera = async () => {
    if (viewerCameraEnabled) {
      // Disable camera - just toggle the track
      toggleVideo();
      setViewerCameraEnabled(false);
      setConfirmedViewerStream(null);
      toast.success('Camera disabled');
    } else {
      // Enable camera
      setIsCameraRequesting(true);
      try {
         if (localStream && localStream.getVideoTracks().length > 0) {
            // Re-enable existing video track
            toggleVideo();
            setConfirmedViewerStream(localStream);
            setViewerCameraEnabled(true);
            setViewerMicEnabled(true);
            toast.success('Camera enabled! Host can now see you');
         } else {
             // First time publishing or valid stream not present
             const displayName = user?.email?.split('@')[0] || 'Viewer';
             const stream = await publishStream('camera', displayName);
             
             // Only enable camera state if stream was successfully created
             if (stream && stream.getVideoTracks().length > 0) {
               setConfirmedViewerStream(stream);
               setViewerCameraEnabled(true);
               setViewerMicEnabled(true);
               toast.success('Camera enabled! Host can now see you');
             } else {
               toast.error('Failed to access camera');
             }
          }
      } catch (error: any) {
        console.error('Error enabling camera:', error);
        toast.error('Failed to enable camera');
      } finally {
        setIsCameraRequesting(false);
      }
    }
  };

  // Toggle viewer microphone
  const toggleViewerMic = async () => {
    if (viewerMicEnabled) {
      if (viewerCameraEnabled) {
         // If camera is on, just mute audio tracks
         toggleSFUMute(); 
      } else {
         // If only mic was on, stop fully
         unpublishStream();
      }
      setViewerMicEnabled(false);
      toast.success('Microphone disabled');
    } else {
       // Enable microphone
       setIsMicRequesting(true);
       try {
         if (viewerCameraEnabled) {
            // Unmute
            toggleSFUMute();
         } else {
             // Start audio only
             const displayName = user?.email?.split('@')[0] || 'Viewer';
             await publishStream('mic', displayName);
          }
         setViewerMicEnabled(true);
         toast.success('Microphone enabled');
       } catch (error) {
          console.error('Error enabling mic:', error);
          toast.error('Failed to enable microphone');
       } finally {
          setIsMicRequesting(false);
       }
    }
  };

  // Cleanup viewer camera on unmount
  // Viewer stream cleanup is now handled by useStream's cleanup()

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
          <Button variant="ghost" size="icon" onClick={handleLeaveStream} className="flex-shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 flex flex-col relative bg-black overflow-hidden">
        <div className="flex-1 relative">
          {/* Hidden Video Element for Host Stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            className="hidden"
          />
          
          {/* Connection Status Overlay */}
          {connectionState !== 'streaming' && (
            <div className="absolute inset-0 flex items-center justify-center flex-col space-y-3 bg-black/80 z-20 p-4">
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
              
              {/* Connection timeout modal hidden - auto-reconnection runs in background */}

              {/* Manual connection controls hidden - auto-reconnection runs in background */}
            </div>
          )}
          
          {/* LIVE Badge */}
          {connectionState === 'streaming' && (
            <Badge 
              variant="destructive"
              className="absolute top-4 left-4 z-30 animate-pulse"
            >
              <div className="w-2 h-2 bg-white rounded-full mr-2" />
              LIVE
            </Badge>
          )}

          {/* Leave Stream Button - Desktop */}
          {connectionState === 'streaming' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLeaveStream}
              className="absolute top-4 right-4 z-30 gap-2 hidden md:flex"
            >
              <LogOut className="w-4 h-4" />
              Leave Stream
            </Button>
          )}

          {/* Mobile floating buttons moved to FloatingActionButtons component */}

          {/* Video Call Grid */}
          <VideoCallGrid
            hostStream={hostStream}
            hostName={hostName}
            viewerCameras={new Map()}
            relayedViewerCameras={new Map(viewerStreams.map(vs => [vs.id, { stream: vs.stream, displayName: vs.displayName || 'Viewer' }]))}
            viewerStream={confirmedViewerStream || localStream}
            viewerCameraEnabled={viewerCameraEnabled}
            viewerName={user?.email?.split('@')[0] || 'You'}
            isMuted={isMuted}
            isHost={false}
          />

          {/* Floating Chat Messages */}
          <div className="absolute bottom-20 left-4 right-16 space-y-2 z-20 pointer-events-none">
            {floatingMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-black/60 backdrop-blur-sm rounded-2xl px-3 py-2 animate-slide-in-right max-w-xs"
              >
                <span className="text-white font-semibold text-sm">{msg.username}: </span>
                <span className="text-white text-sm">{msg.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Below Video - Desktop Only */}
        {showChat && !isMobile && (
          <div className="h-48 border-t border-border bg-background">
            <LiveStreamChat streamId={streamId} isMobile={false} />
          </div>
        )}
      </div>

      {/* Mobile FABs - Horizontal Bottom Bar */}
      <FloatingActionButtons
        isLiked={isLiked}
        totalLikes={totalLikes}
        onLike={handleLike}
        onGift={() => setShowGiftSelector(true)}
        onChat={handleChatToggle}
        onLeave={handleLeaveStream}
        onMute={toggleMute}
        isMuted={isMuted}
        onMic={toggleViewerMic}
        onCamera={toggleViewerCamera}
        micEnabled={viewerMicEnabled}
        cameraEnabled={viewerCameraEnabled}
        isMicRequesting={isMicRequesting}
        isCameraRequesting={isCameraRequesting}
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

      {/* Bottom Controls - Desktop Only (mobile uses FloatingActionButtons) */}
      <div className="bg-black/80 p-3 md:p-4 hidden md:flex items-center justify-between gap-2">
        <Button
          variant={isMuted ? "destructive" : "ghost"}
          size="icon"
          onClick={toggleMute}
          className="h-10 w-10"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </Button>
        
        <div className="flex items-center gap-2">
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
