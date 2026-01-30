import React, { useEffect, useRef, useState } from 'react';
import { useStream, ConnectionPhase } from '@/hooks/useStream';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Volume2, VolumeX, Gift, MessageCircle, ChevronRight, ChevronLeft, Users, UserCircle, Loader2, Play, RefreshCw, Router, Zap, Video, VideoOff, LogOut, Mic, MicOff, Maximize2, Minimize2, AlertCircle, Home } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
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
import { cn } from '@/lib/utils';

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
  const { 
    initialize, 
    remoteStream, 
    cleanup, 
    isConnected: isSFUConnected, 
    isReconnecting, 
    publishStream, 
    unpublishStream, 
    viewerStreams, 
    toggleMute: toggleSFUMute, 
    toggleVideo, 
    localStream,
    connectionPhase,
    connectionError,
    elapsedTime,
    retryConnection
  } = useStream();
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
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

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

  const getConnectionMessage = (phase: ConnectionPhase): string => {
    switch (phase) {
      case 'connecting': return 'Connecting to server...';
      case 'device_loading': return 'Loading media device...';
      case 'joining_room': return 'Joining stream room...';
      case 'awaiting_producers': return `Waiting for host video... (${elapsedTime}s)`;
      case 'consuming': return 'Receiving video stream...';
      case 'streaming': return 'Live';
      case 'timeout': return 'Connection timed out';
      case 'error': return connectionError || 'Connection error';
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
      // connectionPhase is now managed by useStream hook
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
      // Connection phase is now managed by useStream hook
      await initialize('viewer', {}, streamId);

      setIsConnected(true);
      // Connection phase is now managed by useStream hook

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
      // connectionPhase is now managed by useStream hook
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

  // Handle remote stream updates with audio logging
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      console.log('🎥 Setting remote stream', remoteStream.id);
      
      // Log audio track state for debugging
      const audioTracks = remoteStream.getAudioTracks();
      console.log('🔊 Remote stream audio state:', {
        trackCount: audioTracks.length,
        tracks: audioTracks.map(t => ({
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState
        }))
      });
      
      // Ensure audio tracks are enabled
      audioTracks.forEach(track => {
        if (!track.enabled) {
          console.log('⚠️ Remote audio track was disabled, enabling...');
          track.enabled = true;
        }
      });
      
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(e => console.error('Error playing remote stream:', e));
      setHasVideo(true);
      // connectionPhase is now managed by useStream hook
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
      toast.info('Reconnecting to stream...');
    }
    // connectionPhase is now managed by useStream hook
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
        // connectionPhase is now managed by useStream hook
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

  // Monitor connection phase changes and show user feedback
  useEffect(() => {
    if (connectionPhase === 'consuming') {
      toast.success('Connected to stream!');
    } else if (connectionPhase === 'error') {
      toast.error('Connection error');
    } else if (connectionPhase === 'timeout') {
      toast.warning('Connection timeout - Click retry to try again');
    } else if (connectionPhase === 'streaming') {
      toast.success('Stream playing!');
    }
  }, [connectionPhase]);

  // Toggle fullscreen - uses native API where supported, CSS fallback for iOS Safari
  const toggleFullscreen = async () => {
    const targetEl = videoContainerRef.current;
    if (!targetEl) {
      console.error('Video container ref not found');
      return;
    }

    // Check if we're currently in browser fullscreen
    const fullscreenEl = document.fullscreenElement || 
                         (document as any).webkitFullscreenElement ||
                         (document as any).mozFullScreenElement ||
                         (document as any).msFullscreenElement;

    if (isFullscreen || fullscreenEl) {
      // Exit fullscreen
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      } catch (e) {
        // Ignore errors on exit
      }
      setIsFullscreen(false);
    } else {
      // Enter fullscreen - try native API first
      try {
        if (targetEl.requestFullscreen) {
          await targetEl.requestFullscreen();
        } else if ((targetEl as any).webkitRequestFullscreen) {
          await (targetEl as any).webkitRequestFullscreen();
        } else if ((targetEl as any).mozRequestFullScreen) {
          await (targetEl as any).mozRequestFullScreen();
        } else if ((targetEl as any).msRequestFullscreen) {
          await (targetEl as any).msRequestFullscreen();
        }
      } catch (error) {
        console.log('Native fullscreen not available, using CSS fallback');
      }

      // Always set isFullscreen to true - CSS styles will handle the visual fullscreen
      // This ensures mobile devices (especially iOS) still get a fullscreen-like experience
      setIsFullscreen(true);
    }
  };

  // Listen for fullscreen changes (e.g., user presses Escape or swipes down on mobile)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!(
        document.fullscreenElement || 
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      // Only sync state if browser fullscreen state changed
      if (!isNowFullscreen && document.fullscreenElement === null) {
        setIsFullscreen(false);
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const showConnectionControls = ['timeout', 'error'].includes(connectionPhase);

  return (
    <TooltipProvider>
    <div ref={containerRef} className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black/80 p-3 md:p-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm md:text-lg font-semibold truncate">{streamTitle}</h2>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{hostName}</p>
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
        {/* Video Container - This is the ONLY fullscreen target */}
        {/* Using inline styles to ensure visibility on mobile where :fullscreen pseudo-class may not work */}
        <div 
          ref={videoContainerRef}
          className="video-fullscreen-container flex-1 flex flex-col relative"
          data-fullscreen={isFullscreen ? "true" : "false"}
          style={{
            backgroundColor: '#000',
            display: 'flex',
            visibility: 'visible',
            opacity: 1,
            width: isFullscreen ? '100vw' : '100%',
            height: isFullscreen ? '100vh' : '100%',
            position: isFullscreen ? 'fixed' : 'relative',
            top: isFullscreen ? 0 : undefined,
            left: isFullscreen ? 0 : undefined,
            right: isFullscreen ? 0 : undefined,
            bottom: isFullscreen ? 0 : undefined,
            zIndex: isFullscreen ? 9999 : 10,
          }}
        >
          {/* Hidden Video Element for Host Stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            className="hidden"
          />
          
          {/* Connection Status Overlay */}
          {connectionPhase !== 'streaming' && (
            <div className="absolute inset-0 flex items-center justify-center flex-col space-y-3 bg-black/80 z-20 p-4">
              {connectionPhase === 'timeout' || connectionPhase === 'error' ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <h3 className="text-white font-semibold text-lg">
                    {connectionPhase === 'timeout' ? 'Connection Timed Out' : 'Connection Error'}
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    {connectionError || 'The host may not be streaming yet, or there was a network issue.'}
                  </p>
                  <p className="text-muted-foreground/60 text-xs">
                    Waited {elapsedTime} seconds
                  </p>
                  <div className="flex gap-3 mt-2">
                    <Button
                      variant="outline"
                      onClick={handleLeaveStream}
                      className="gap-2"
                    >
                      <Home className="w-4 h-4" />
                      Leave
                    </Button>
                    <Button
                      onClick={retryConnection}
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry Connection
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-white" />
                  <p className="text-white font-medium text-sm md:text-base">{getConnectionMessage(connectionPhase)}</p>
                  {connectionPhase === 'awaiting_producers' && (
                    <p className="text-muted-foreground text-xs">
                      Searching for host video stream...
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* LIVE Badge */}
          {connectionPhase === 'streaming' && (
            <Badge 
              variant="destructive"
              className="absolute top-4 left-4 z-30 animate-pulse"
            >
              <div className="w-2 h-2 bg-white rounded-full mr-2" />
              LIVE
            </Badge>
          )}

          {/* Leave Stream Button - Desktop */}
          {connectionPhase === 'streaming' && (
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
            isFullscreen={isFullscreen}
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
          
          {/* Mobile fullscreen exit button - clickable for mobile users */}
          {isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 z-[10000] bg-black/70 hover:bg-black/90 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2 transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
              Exit Fullscreen
            </button>
          )}
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
        onFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
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
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isMuted ? "destructive" : "ghost"}
                size="icon"
                onClick={toggleMute}
                className="h-10 w-10"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isMuted ? 'Unmute' : 'Mute'}</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-10 w-10"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        
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
    </TooltipProvider>
  );
};

export default StreamViewer;
