import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  X, Heart, MessageCircle, Gift, Share2, MoreVertical, 
  Eye, Volume2, VolumeX, UserPlus, ArrowLeft, Video, VideoOff, Loader2,
  Mic, MicOff, LogOut, Flag, Ban, EyeOff, Minimize2, Maximize2, RefreshCw, AlertCircle, Home
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VideoCallGrid } from '@/components/VideoCallGrid';
import LivestreamGiftSelector from './LivestreamGiftSelector';
import LivestreamGiftAnimation, { GiftAnimation } from './LivestreamGiftAnimation';
import { LiveStreamChat } from './LiveStreamChat';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useStream, ConnectionPhase } from '@/hooks/useStream';

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  created_at: string;
}

interface TikTokStreamViewerProps {
  streamId: string;
  streamTitle: string;
  hostName: string;
  hostUserId: string;
  hostAvatar?: string;
  currentViewers: number;
  totalLikes: number;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export const TikTokStreamViewer: React.FC<TikTokStreamViewerProps> = ({
  streamId,
  streamTitle,
  hostName,
  hostUserId,
  hostAvatar,
  currentViewers,
  totalLikes,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { initialize, remoteStream, cleanup, publishStream, unpublishStream, viewerStreams, toggleMute: toggleSFUMute, toggleVideo, localStream, isMuted: isSFUMuted, peerId, connectionPhase, connectionError, elapsedTime, retryConnection } = useStream();

  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(totalLikes);
  const [viewers, setViewers] = useState(currentViewers);
  const [showUI, setShowUI] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  
  const [floatingMessages, setFloatingMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showFullChat, setShowFullChat] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  const [showGiftSelector, setShowGiftSelector] = useState(false);
  const [giftAnimations, setGiftAnimations] = useState<GiftAnimation[]>([]);

  const [viewerCameraEnabled, setViewerCameraEnabled] = useState(false);
  const [isCameraRequesting, setIsCameraRequesting] = useState(false);
  
  const [viewerMicEnabled, setViewerMicEnabled] = useState(false);
  const [isMicRequesting, setIsMicRequesting] = useState(false);
  
  const [relayedViewerCameras, setRelayedViewerCameras] = useState<Map<string, any>>(new Map());
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const swipeRef = useSwipeGesture({
    onSwipeUp: () => {
      if (hasNext && onNext) {
        onNext();
      }
    },
    onSwipeDown: () => {
      if (hasPrevious && onPrevious) {
        onPrevious();
      }
    },
    minDistance: 50,
    velocityThreshold: 0.3
  });

  useEffect(() => {
    const timeout = setTimeout(() => setShowUI(false), 3000);
    return () => clearTimeout(timeout);
  }, [showUI]);

  useEffect(() => {
    const initViewer = async () => {
      if (!videoRef.current) return;
      
      const videoEl = videoRef.current;
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;

      const displayName = user?.email?.split('@')[0] || 'Guest';
      
      const { data: joinData, error: joinError } = await supabase.rpc('join_stream_as_viewer', {
        p_stream_id: streamId,
        p_display_name: displayName,
        p_is_guest: !user
      });

      if (joinError) {
        console.error('Error joining stream:', joinError);
        toast.error('Failed to join stream');
        return;
      }

      const token = (joinData as any)?.session_token as string;
      if (!token) {
        toast.error('Failed to establish viewer session');
        return;
      }
      
      setSessionToken(token);

      console.log('🔌 Connecting to SFU stream...');
      await initialize('viewer', {}, streamId);
      setIsConnected(true);
      console.log('✅ Connected to stream');

      if (user) {
        const { data: likeData } = await supabase
          .from('stream_likes')
          .select('id')
          .eq('stream_id', streamId)
          .eq('user_id', user.id)
          .single();
        
        setIsLiked(!!likeData);
      }
    };

    initViewer();
    
    // Cleanup on unmount - CRITICAL for rejoin to work
    return () => {
      console.log('🧹 TikTokStreamViewer unmounting, cleaning up...');
      
      // Always cleanup stream resources first
      cleanup();
      
      // Reset local state
      setIsConnected(false);
      setViewerCameraEnabled(false);
      setViewerMicEnabled(false);
      setHostStream(null);
      setRelayedViewerCameras(new Map());
      
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
          } catch (err) {
            console.error('Error leaving stream:', err);
          }
        })();
      }
    };
  }, [streamId, user]);

  // Handle remote stream updates with audio logging
  // CRITICAL: This effect runs when remoteStream changes (new object reference from useStream fix)
  useEffect(() => {
     if (remoteStream) {
        console.log('🎥 TikTok: Setting remote stream (new reference):', remoteStream.id);
        
        // Log audio track state for debugging
        const audioTracks = remoteStream.getAudioTracks();
        const videoTracks = remoteStream.getVideoTracks();
        
        console.log('🔊 TikTok: Remote stream audio state:', {
          streamId: remoteStream.id,
          audioTrackCount: audioTracks.length,
          videoTrackCount: videoTracks.length,
          tracks: audioTracks.map(t => ({
            id: t.id,
            label: t.label,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          }))
        });
        
        // CRITICAL: Force-enable ALL audio tracks
        audioTracks.forEach(track => {
          track.enabled = true;
          console.log(`🔊 TikTok: Ensured audio track enabled: ${track.id}`);
          
          // Monitor and recover from system-level muting
          track.onmute = () => {
            console.log(`🔇 TikTok: Audio track muted by system: ${track.id}`);
            setTimeout(() => {
              if (track.readyState === 'live') {
                track.enabled = true;
                console.log(`🔊 TikTok: Re-enabled audio track after mute`);
                // Force video element to resume if paused
                if (videoRef.current?.paused) {
                  videoRef.current.play().catch(e => console.error('Resume failed:', e));
                }
              }
            }, 50);
          };
        });
        
        // Update host stream for VideoCallGrid
        setHostStream(remoteStream);
        
        // Attach to video element
        if (videoRef.current) {
           videoRef.current.srcObject = remoteStream;
           
           // CRITICAL: Unmute and play with retry for reliable audio
           const playWithAudio = async () => {
             if (!videoRef.current) return;
             
             // Set audio state based on user preference
             videoRef.current.muted = isMuted;
             videoRef.current.volume = 1.0;
             
             try {
               await videoRef.current.play();
               console.log('🔊 TikTok: Video playing, muted:', videoRef.current.muted);
             } catch (e: any) {
               console.warn('TikTok: Autoplay failed, will retry:', e.name);
               // Retry after user interaction or after delay
               setTimeout(async () => {
                 try {
                   if (videoRef.current) {
                     await videoRef.current.play();
                   }
                 } catch (retryError) {
                   console.error('TikTok: Retry play failed:', retryError);
                 }
               }, 500);
             }
           };
           
           playWithAudio();
        }
     }
  }, [remoteStream, remoteStream?.id, isMuted]); // CRITICAL: Also depend on stream ID for new reference detection

  useEffect(() => {
      const viewerMap = new Map<string, any>();
      viewerStreams.forEach(v => {
          if (v.id !== peerId) {
             viewerMap.set(v.id, { stream: v.stream, displayName: 'Viewer' });
          }
      });
      setRelayedViewerCameras(viewerMap);
  }, [viewerStreams, peerId]);

  useEffect(() => {
    if (!streamId || !hostUserId) return;

    const channel = supabase
      .channel(`stream_gifts_${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gift_transactions',
          filter: `receiver_id=eq.${hostUserId}`
        },
        async (payload) => {
          const transaction = payload.new;
          
          const { data: gift } = await supabase
            .from('gifts')
            .select('name, asset_url')
            .eq('id', transaction.gift_id)
            .single();

          const { data: sender } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', transaction.sender_id)
            .single();

          if (gift) {
            const senderName = sender?.display_name || `User-${transaction.sender_id.slice(0, 8)}`;
            const newAnimation: GiftAnimation = {
              id: transaction.id,
              giftEmoji: gift.asset_url || '🎁',
              giftName: gift.name,
              senderName: senderName,
              timestamp: Date.now()
            };

            setGiftAnimations(prev => [...prev, newAnimation]);

            setTimeout(() => {
              setGiftAnimations(prev => prev.filter(a => a.id !== newAnimation.id));
            }, 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, hostUserId]);

  useEffect(() => {
    const channel = supabase
      .channel(`tiktok_chat:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_chat_messages',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setFloatingMessages(prev => [...prev.slice(-4), newMsg]);
          
          setTimeout(() => {
            setFloatingMessages(prev => prev.filter(m => m.id !== newMsg.id));
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Stream status subscription - notify viewer when host ends stream
  useEffect(() => {
    const channel = supabase
      .channel(`tiktok_stream_status:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streaming_sessions',
          filter: `id=eq.${streamId}`
        },
        (payload) => {
          if (payload.new && 'total_likes' in payload.new) {
            setLikes(payload.new.total_likes || 0);
          }
          if (payload.new && 'current_viewers' in payload.new) {
            setViewers(payload.new.current_viewers || 0);
          }
          
          // Monitor stream status - if host ends stream, close viewer automatically
          if (payload.new && 'status' in payload.new) {
            const newStatus = (payload.new as any).status;
            if (newStatus === 'ended' || newStatus === 'archived') {
              console.log('🔴 Stream has ended by host, cleaning up viewer...');
              
              // Cleanup SFU connection
              cleanup();
              
              // Stop video element
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
  }, [streamId, cleanup, onClose]);

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
      } else {
        await supabase
          .from('stream_likes')
          .insert({ stream_id: streamId, user_id: user.id });
        
        setIsLiked(true);
        
        const heartEl = document.createElement('div');
        heartEl.className = 'absolute animate-float-up';
        heartEl.style.left = `${Math.random() * 80 + 10}%`;
        heartEl.style.bottom = '20%';
        heartEl.innerHTML = '❤️';
        heartEl.style.fontSize = '48px';
        document.getElementById('video-container')?.appendChild(heartEl);
        
        setTimeout(() => heartEl.remove(), 2000);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like stream');
    }
  };

  const handleSendMessage = async () => {
    if (!user || !chatInput.trim()) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      await supabase
        .from('stream_chat_messages')
        .insert({
          stream_id: streamId,
          user_id: user.id,
          username: profile?.display_name || 'Anonymous',
          message: chatInput.trim()
        });

      setChatInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleFollow = async () => {
    if (!user) {
      toast.error('Please sign in to follow');
      return;
    }

    setIsFollowing(!isFollowing);
    toast.success(isFollowing ? 'Unfollowed' : 'Following!');
  };

  const toggleViewerCamera = async () => {
    if (!sessionToken) {
      toast.error('Not connected to stream');
      return;
    }

    if (viewerCameraEnabled) {
      toggleVideo();
      setViewerCameraEnabled(false);
      toast.success('Camera disabled');
    } else {
      try {
        setIsCameraRequesting(true);
        if (localStream && localStream.getVideoTracks().length > 0) {
            toggleVideo();
        } else {
            await publishStream('camera');
        }
        
        setViewerCameraEnabled(true);
        setViewerMicEnabled(true);
        toast.success('Camera enabled! Host can now see you.');
      } catch (error) {
        console.error('Error enabling camera:', error);
        toast.error('Failed to enable camera. Please check permissions.');
      } finally {
        setIsCameraRequesting(false);
      }
    }
  };

  const toggleViewerMic = async () => {
    console.log('🎤 Toggle viewer mic called:', { 
      viewerMicEnabled, 
      viewerCameraEnabled,
      hasLocalStream: !!localStream 
    });
    
    if (!sessionToken) {
      toast.error('Not connected to stream');
      return;
    }

    if (viewerMicEnabled) {
      // DISABLE microphone
      if (viewerCameraEnabled) {
        // Camera is on, just mute the audio track
        toggleSFUMute();
        console.log('🔇 Muted audio track (camera still on)');
      } else {
        // Only mic was on, stop fully
        unpublishStream();
        console.log('🛑 Unpublished stream (no camera)');
      }
      setViewerMicEnabled(false);
      toast.success('Microphone disabled');
    } else {
      // ENABLE microphone
      setIsMicRequesting(true);
      try {
        if (viewerCameraEnabled && localStream) {
          // Camera already on, just unmute
          toggleSFUMute();
          console.log('🔊 Unmuted audio track');
          setViewerMicEnabled(true);
          toast.success('Microphone enabled - Host can hear you!');
        } else {
          // Start audio only stream
          console.log('🎤 Starting audio-only stream for viewer...');
          const stream = await publishStream('mic');
          
          if (stream && stream.getAudioTracks().length > 0) {
            const audioTrack = stream.getAudioTracks()[0];
            console.log('✅ Viewer mic stream started:', {
              trackId: audioTrack.id,
              enabled: audioTrack.enabled,
              readyState: audioTrack.readyState
            });
            setViewerMicEnabled(true);
            toast.success('Microphone enabled - Host can hear you!');
          } else {
            console.error('❌ No audio track acquired');
            toast.error('Failed to start microphone');
          }
        }
      } catch (error: any) {
        console.error('❌ Error enabling microphone:', error);
        
        let errorMessage = 'Failed to enable microphone';
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Microphone permission denied. Please allow access.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found on this device.';
        }
        
        toast.error(errorMessage);
      } finally {
        setIsMicRequesting(false);
      }
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/streaming?stream=${streamId}`;
    const shareData = {
      title: `Live: ${streamTitle}`,
      text: `Watch ${hostName}'s livestream!`,
      url: shareUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Stream link copied to clipboard!');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast.success('Stream link copied to clipboard!');
        } catch (clipboardError) {
          toast.error('Failed to copy link');
        }
      }
    }
  };

  const handleReport = async () => {
    toast.info('Report submitted. Thank you for keeping our community safe!');
    setShowMoreOptions(false);
  };

  const handleBlock = async () => {
    if (!user) {
      toast.error('Please sign in to block users');
      return;
    }
    toast.success(`You will no longer see streams from ${hostName}`);
    setShowMoreOptions(false);
  };

  const handleNotInterested = () => {
    toast.info("We'll show you fewer streams like this");
    setShowMoreOptions(false);
  };

  const handlePiP = async () => {
    try {
      if (videoRef.current && document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      toast.error('Picture-in-Picture not available');
    }
  };

  // Check if browser supports fullscreen API on non-video elements
  const supportsFullscreenAPI = () => {
    const el = document.documentElement;
    return !!(
      el.requestFullscreen ||
      (el as any).webkitRequestFullscreen ||
      (el as any).mozRequestFullScreen ||
      (el as any).msRequestFullscreen
    );
  };

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
      let nativeFullscreenSucceeded = false;
      
      try {
        if (targetEl.requestFullscreen) {
          await targetEl.requestFullscreen();
          nativeFullscreenSucceeded = true;
        } else if ((targetEl as any).webkitRequestFullscreen) {
          await (targetEl as any).webkitRequestFullscreen();
          nativeFullscreenSucceeded = true;
        } else if ((targetEl as any).mozRequestFullScreen) {
          await (targetEl as any).mozRequestFullScreen();
          nativeFullscreenSucceeded = true;
        } else if ((targetEl as any).msRequestFullscreen) {
          await (targetEl as any).msRequestFullscreen();
          nativeFullscreenSucceeded = true;
        }
      } catch (error) {
        console.log('Native fullscreen not available, using CSS fallback');
        nativeFullscreenSucceeded = false;
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
      // Don't set to false if we're using CSS-only fullscreen on mobile
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

  // CRITICAL: Resume audio playback when page becomes visible (mobile backgrounding fix)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && videoRef.current) {
        console.log('🎥 TikTok: Page visible, resuming playback...');
        
        // Re-sync audio state
        videoRef.current.muted = isMuted;
        videoRef.current.volume = 1.0;
        
        // Resume if paused
        if (videoRef.current.paused && videoRef.current.srcObject) {
          try {
            await videoRef.current.play();
            console.log('🎥 TikTok: Resumed playback after visibility change');
          } catch (e) {
            console.warn('TikTok: Resume playback failed:', e);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isMuted]);

  return (
    <TooltipProvider>
    <div 
      ref={(node) => {
        // Merge refs: swipeRef and containerRef
        (swipeRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className="fixed inset-0 bg-black z-50 overflow-hidden"
      onClick={() => setShowUI(true)}
    >
      {/* Video Container - This is the ONLY fullscreen target */}
      {/* Using inline styles to ensure visibility on mobile where :fullscreen pseudo-class may not work */}
      <div 
        ref={videoContainerRef}
        id="video-container" 
        className="video-fullscreen-container absolute inset-0 flex items-center justify-center"
        data-fullscreen={isFullscreen ? "true" : "false"}
        style={{
          backgroundColor: '#000',
          display: 'flex',
          visibility: 'visible',
          opacity: 1,
          width: isFullscreen ? '100vw' : '100%',
          height: isFullscreen ? '100vh' : '100%',
          position: isFullscreen ? 'fixed' : 'absolute',
          top: isFullscreen ? 0 : undefined,
          left: isFullscreen ? 0 : undefined,
          right: isFullscreen ? 0 : undefined,
          bottom: isFullscreen ? 0 : undefined,
          zIndex: isFullscreen ? 9999 : 10,
        }}
      >
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          autoPlay
          muted={isMuted}
          onLoadedMetadata={() => {
            console.log('🎥 TikTok: Video metadata loaded');
            // Ensure proper audio state after metadata loads
            if (videoRef.current) {
              videoRef.current.muted = isMuted;
              videoRef.current.volume = 1.0;
            }
          }}
          onPlay={() => {
            console.log('🎥 TikTok: Video playing, muted:', videoRef.current?.muted);
          }}
          onPause={() => {
            console.log('🎥 TikTok: Video paused');
          }}
        />
        
        {/* Connection Status Overlay */}
        {connectionPhase !== 'streaming' && connectionPhase !== 'idle' && (
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
                    onClick={onClose}
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
                    Retry
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-white" />
                <p className="text-white font-medium text-sm">
                  {connectionPhase === 'connecting' && 'Connecting to server...'}
                  {connectionPhase === 'device_loading' && 'Loading media device...'}
                  {connectionPhase === 'joining_room' && 'Joining stream...'}
                  {connectionPhase === 'awaiting_producers' && `Waiting for host video... (${elapsedTime}s)`}
                  {connectionPhase === 'consuming' && 'Receiving video stream...'}
                </p>
                {connectionPhase === 'awaiting_producers' && (
                  <p className="text-muted-foreground text-xs">
                    Searching for host video stream...
                  </p>
                )}
              </>
            )}
          </div>
        )}
        
        <VideoCallGrid
          hostStream={hostStream}
          hostName={hostName}
          viewerStream={localStream || undefined}
          viewerCameraEnabled={viewerCameraEnabled}
          viewerName={user?.email?.split('@')[0] || 'You'}
          viewerCameras={new Map()}
          relayedViewerCameras={relayedViewerCameras}
          isHost={false}
          isFullscreen={isFullscreen}
        />
        
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
        
        {/* Mobile fullscreen exit button - appears inside the fullscreen container */}
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

      <div 
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          showUI ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="text-white"
              onClick={onClose}
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>

            <Badge className="bg-destructive text-white px-3 py-1 flex items-center gap-2 animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              LIVE
            </Badge>

            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
              <Eye className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">{viewers}</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-20 left-4 right-20 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 border-2 border-white">
              <AvatarImage src={hostAvatar} />
              <AvatarFallback>{hostName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold truncate">{hostName}</h3>
              <p className="text-white/80 text-sm truncate">{streamTitle}</p>
            </div>
            <Button
              size="sm"
              onClick={handleFollow}
              className={cn(
                "rounded-full",
                isFollowing ? "bg-white/20" : "bg-primary"
              )}
            >
              {isFollowing ? 'Following' : <UserPlus className="w-4 h-4" />}
            </Button>
          </div>

          <div className="space-y-2">
            {floatingMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-black/60 backdrop-blur-sm rounded-2xl px-3 py-2 animate-slide-in-right max-w-xs"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-semibold text-sm">{msg.username}</span>
                </div>
                <p className="text-white text-sm break-words">{msg.message}</p>
              </div>
            ))}
          </div>

          {user && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Add a comment..."
                className="flex-1 bg-black/40 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white placeholder:text-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            </div>
          )}
        </div>

        <div className="absolute bottom-32 right-4 flex flex-col items-center gap-6">
          {/* Camera Toggle */}
          <button
            onClick={toggleViewerCamera}
            disabled={isCameraRequesting}
            className="flex flex-col items-center gap-1 transition-transform active:scale-90"
          >
            <div className={cn(
              "w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center",
              viewerCameraEnabled ? "bg-primary" : "bg-black/40"
            )}>
              {isCameraRequesting ? (
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              ) : viewerCameraEnabled ? (
                <Video className="w-7 h-7 text-white" />
              ) : (
                <VideoOff className="w-7 h-7 text-white" />
              )}
            </div>
            <span className="text-white text-xs font-medium">Camera</span>
          </button>

          {/* Mic Toggle */}
          <button
            onClick={toggleViewerMic}
            disabled={isMicRequesting}
            className="flex flex-col items-center gap-1 transition-transform active:scale-90"
          >
            <div className={cn(
              "w-12 h-12 rounded-full backdrop-blur-sm flex items-center justify-center",
              viewerMicEnabled ? "bg-primary" : "bg-black/40"
            )}>
              {isMicRequesting ? (
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              ) : viewerMicEnabled ? (
                <Mic className="w-7 h-7 text-white" />
              ) : (
                <MicOff className="w-7 h-7 text-white" />
              )}
            </div>
            <span className="text-white text-xs font-medium">Mic</span>
          </button>

          {/* Like Button */}
          <button
            onClick={handleLike}
            className="flex flex-col items-center gap-1 transition-transform active:scale-90"
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Heart 
                className={cn(
                  "w-7 h-7 transition-colors",
                  isLiked ? "fill-destructive text-destructive" : "text-white"
                )}
              />
            </div>
            <span className="text-white text-xs font-medium">{likes}</span>
          </button>

          <button
            onClick={() => setShowFullChat(!showFullChat)}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            <span className="text-white text-xs font-medium">Chat</span>
          </button>

          <button 
            onClick={() => setShowGiftSelector(true)}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Gift className="w-7 h-7 text-white" />
            </div>
            <span className="text-white text-xs font-medium">Gift</span>
          </button>

          {/* Fullscreen Button - Clearly labeled */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={toggleFullscreen}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  {isFullscreen ? (
                    <Minimize2 className="w-7 h-7 text-white" />
                  ) : (
                    <Maximize2 className="w-7 h-7 text-white" />
                  )}
                </div>
                <span className="text-white text-xs font-medium">
                  {isFullscreen ? 'Exit' : 'Fullscreen'}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</p>
            </TooltipContent>
          </Tooltip>

          <button 
            onClick={handleShare}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Share2 className="w-7 h-7 text-white" />
            </div>
          </button>

          <DropdownMenu open={showMoreOptions} onOpenChange={setShowMoreOptions}>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <MoreVertical className="w-7 h-7 text-white" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-sm">
              <DropdownMenuItem onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <><Minimize2 className="w-4 h-4 mr-2" /> Exit Fullscreen</>
                ) : (
                  <><Maximize2 className="w-4 h-4 mr-2" /> Fullscreen</>
                )}
              </DropdownMenuItem>
              {document.pictureInPictureEnabled && (
                <DropdownMenuItem onClick={handlePiP}>
                  <Minimize2 className="w-4 h-4 mr-2" /> Picture-in-Picture
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleReport}>
                <Flag className="w-4 h-4 mr-2" /> Report Stream
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBlock}>
                <Ban className="w-4 h-4 mr-2" /> Block Host
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleNotInterested}>
                <EyeOff className="w-4 h-4 mr-2" /> Not Interested
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={async () => {
              const newMutedState = !isMuted;
              setIsMuted(newMutedState);
              
              // CRITICAL: Actively control audio on video element
              if (videoRef.current) {
                videoRef.current.muted = newMutedState;
                videoRef.current.volume = 1.0;
                
                // If unmuting, ensure playback
                if (!newMutedState) {
                  try {
                    await videoRef.current.play();
                    console.log('🔊 TikTok: Audio unmuted and playing');
                  } catch (e: any) {
                    console.warn('TikTok: Play after unmute failed:', e.name);
                    // On mobile, we may need to mute first then try again
                    if (e.name === 'NotAllowedError') {
                      toast.info('Tap again to unmute audio');
                    }
                  }
                } else {
                  console.log('🔇 TikTok: Audio muted');
                }
              }
            }}
            className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
          >
            {isMuted ? (
              <VolumeX className="w-7 h-7 text-white" />
            ) : (
              <Volume2 className="w-7 h-7 text-white" />
            )}
          </button>

          <button
            onClick={onClose}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full bg-destructive/80 backdrop-blur-sm flex items-center justify-center">
              <LogOut className="w-7 h-7 text-white" />
            </div>
            <span className="text-white text-xs font-medium">Leave</span>
          </button>
        </div>

      </div>

      <LivestreamGiftAnimation animations={giftAnimations} />

      <LivestreamGiftSelector
        open={showGiftSelector}
        onOpenChange={setShowGiftSelector}
        hostUserId={hostUserId}
        hostName={hostName}
        streamId={streamId}
        onGiftSent={(gift) => {
          console.log('Gift sent:', gift);
        }}
      />

      <Sheet open={showFullChat} onOpenChange={setShowFullChat}>
        <SheetContent side="bottom" className="h-[60vh] p-0">
          <LiveStreamChat streamId={streamId} isMobile={true} />
        </SheetContent>
      </Sheet>

      <style>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-200px);
          }
        }
        
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-float-up {
          animation: float-up 2s ease-out forwards;
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
    </TooltipProvider>
  );
};
