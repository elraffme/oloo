import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  X, Heart, MessageCircle, Gift, Share2, 
  Eye, Volume2, VolumeX, ArrowLeft, Video, VideoOff, Loader2,
  Mic, MicOff, LogOut, Minimize2, Maximize2, RefreshCw, AlertCircle, Home
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VideoCallGrid } from '@/components/VideoCallGrid';
import LivestreamGiftSelector from './LivestreamGiftSelector';
import LivestreamGiftAnimation, { GiftAnimation } from './LivestreamGiftAnimation';
import { LiveStreamChat } from './LiveStreamChat';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useStream, ConnectionPhase, STALE_STREAM_THRESHOLD_SECONDS } from '@/hooks/useStream';

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
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  
  const [floatingMessages, setFloatingMessages] = useState<ChatMessage[]>([]);
  const [showFullChat, setShowFullChat] = useState(false);
  
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

  // UI is always visible - no auto-hide for standard livestream experience

  useEffect(() => {
    const initViewer = async () => {
      if (!videoRef.current) return;
      
      const videoEl = videoRef.current;
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;

      // STEP 1: Check if host is still actively streaming (stale detection)
      console.log('🔍 Checking stream freshness before joining...');
      const { data: streamStatus, error: streamStatusError } = await supabase
        .from('streaming_sessions')
        .select('status, last_activity_at, host_user_id')
        .eq('id', streamId)
        .single();

      if (streamStatusError) {
        console.error('❌ Error checking stream status:', streamStatusError);
        toast.error('Stream not found');
        onClose();
        return;
      }

      if (streamStatus.status !== 'live') {
        console.log('⚠️ Stream is no longer live, status:', streamStatus.status);
        toast.error('This stream has ended');
        onClose();
        return;
      }

      // Check staleness - warn if host hasn't sent heartbeat recently
      const lastActivityTime = new Date(streamStatus.last_activity_at).getTime();
      const currentTime = Date.now();
      const inactiveSeconds = (currentTime - lastActivityTime) / 1000;
      
      console.log('📊 Stream activity check:', {
        lastActivity: streamStatus.last_activity_at,
        inactiveSeconds: Math.floor(inactiveSeconds),
        threshold: STALE_STREAM_THRESHOLD_SECONDS
      });

      if (inactiveSeconds > STALE_STREAM_THRESHOLD_SECONDS) {
        console.warn(`⚠️ Stream appears stale - no host activity for ${Math.floor(inactiveSeconds)}s`);
        toast.warning('Host may have disconnected. Stream might not be available.', {
          duration: 5000
        });
        // Continue anyway - let the SFU connection determine if stream is truly dead
      }

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

  // Chat is handled by LiveStreamChat component directly

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
        const existingVideoTrack = localStream?.getVideoTracks()[0];
        const canReuseExistingVideo = !!existingVideoTrack && existingVideoTrack.readyState === 'live';

        if (canReuseExistingVideo && localStream) {
            toggleVideo();
        } else {
            if (existingVideoTrack) {
                console.warn('⚠️ Existing viewer video track is stale, requesting a fresh camera stream', {
                    id: existingVideoTrack.id,
                    enabled: existingVideoTrack.enabled,
                    readyState: existingVideoTrack.readyState,
                });
            }
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
      hasLocalStream: !!localStream,
      connectionPhase
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
          // Start audio only stream with retry logic
          console.log('🎤 Starting audio-only stream for viewer...');
          
          let stream: MediaStream | null = null;
          let attempts = 0;
          const maxAttempts = 3;
          
          while (!stream && attempts < maxAttempts) {
            attempts++;
            console.log(`🎤 Publish attempt ${attempts}/${maxAttempts}...`);
            stream = await publishStream('mic');
            
            if (!stream || stream.getAudioTracks().length === 0) {
              console.warn(`⚠️ Attempt ${attempts} failed - no audio track`);
              stream = null;
              
              if (attempts < maxAttempts) {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          }
          
          if (stream && stream.getAudioTracks().length > 0) {
            const audioTrack = stream.getAudioTracks()[0];
            
            // Ensure track is enabled
            audioTrack.enabled = true;
            
            console.log('✅ Viewer mic stream started and published to SFU:', {
              trackId: audioTrack.id,
              enabled: audioTrack.enabled,
              readyState: audioTrack.readyState,
              label: audioTrack.label
            });
            
            setViewerMicEnabled(true);
            toast.success('Microphone enabled - Host can hear you!');
          } else {
            console.error('❌ Failed to start microphone after all attempts');
            toast.error('Failed to start microphone - please try again');
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

  // Report/block handlers removed - now using standard layout

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
      ref={containerRef}
      className="fixed inset-0 bg-black z-50 flex flex-col"
    >
      {/* Header - Always visible */}
      <div className="bg-black/80 px-3 py-2 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Avatar className="w-8 h-8 border border-white/30 shrink-0">
            <AvatarImage src={hostAvatar} />
            <AvatarFallback>{hostName[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold truncate">{streamTitle}</h2>
            <p className="text-xs text-white/70 truncate">{hostName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className="bg-destructive text-white px-2 py-0.5 text-xs flex items-center gap-1.5 animate-pulse">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
            LIVE
          </Badge>
          <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
            <Eye className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-medium">{viewers}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
        {/* Video Container */}
        <div 
          ref={videoContainerRef}
          className="video-fullscreen-container flex-1 relative bg-black"
          data-fullscreen={isFullscreen ? "true" : "false"}
          style={{
            backgroundColor: '#000',
            ...(isFullscreen ? {
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
            } : {}),
          }}
        >
          <video
            ref={videoRef}
            className="hidden"
            playsInline
            autoPlay
            muted={isMuted}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.muted = isMuted;
                videoRef.current.volume = 1.0;
              }
            }}
          />

          {/* Connection Status Overlay */}
          {connectionPhase !== 'streaming' && connectionPhase !== 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center flex-col space-y-3 bg-black/80 z-20 p-4">
              {connectionPhase === 'timeout' || connectionPhase === 'error' || connectionPhase === 'stale_host' ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <h3 className="text-white font-semibold text-lg">
                    {connectionPhase === 'timeout' ? 'Connection Timed Out' : 
                     connectionPhase === 'stale_host' ? 'Host Disconnected' : 
                     'Connection Error'}
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    {connectionError || 'The host may have ended their stream or lost connection.'}
                  </p>
                  <div className="flex gap-3 mt-2">
                    <Button variant="outline" onClick={onClose} className="gap-2">
                      <Home className="w-4 h-4" /> Leave
                    </Button>
                    {connectionPhase !== 'stale_host' && (
                      <Button onClick={retryConnection} className="gap-2">
                        <RefreshCw className="w-4 h-4" /> Retry
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-white" />
                  <p className="text-white font-medium text-sm">
                    {connectionPhase === 'connecting' && 'Connecting to server...'}
                    {connectionPhase === 'health_check' && 'Checking server availability...'}
                    {connectionPhase === 'device_loading' && 'Loading media device...'}
                    {connectionPhase === 'joining_room' && 'Joining stream...'}
                    {connectionPhase === 'awaiting_producers' && `Waiting for host video... (${elapsedTime}s)`}
                    {connectionPhase === 'consuming' && 'Receiving video stream...'}
                  </p>
                </>
              )}
            </div>
          )}

          {/* VideoCallGrid - always visible, shows all participants */}
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

          {/* Floating Chat Messages - always visible overlay */}
          <div className="absolute bottom-4 left-3 right-3 space-y-1.5 z-20 pointer-events-none max-h-[30%] overflow-hidden">
            {floatingMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-black/50 backdrop-blur-sm rounded-xl px-3 py-1.5 animate-slide-in-right max-w-[85%]"
              >
                <span className="text-white font-medium text-xs">{msg.username}: </span>
                <span className="text-white/90 text-xs">{msg.message}</span>
              </div>
            ))}
          </div>

          {/* Fullscreen exit button */}
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

        {/* Desktop Chat Panel - always visible on desktop */}
        <div className="hidden md:flex flex-col w-80 border-l border-white/10 bg-black/90">
          <LiveStreamChat streamId={streamId} isMobile={false} />
        </div>
      </div>

      {/* Bottom Controls Bar - Always visible, works on all devices */}
      <div className="bg-black/90 border-t border-white/10 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2 shrink-0 z-50">
        <div className="flex items-center gap-2">
          {/* Mute/Unmute Speaker */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isMuted ? "destructive" : "ghost"}
                size="icon"
                onClick={async () => {
                  const newMutedState = !isMuted;
                  setIsMuted(newMutedState);
                  if (videoRef.current) {
                    videoRef.current.muted = newMutedState;
                    videoRef.current.volume = 1.0;
                    if (!newMutedState) {
                      try { await videoRef.current.play(); } catch (e) {}
                    }
                  }
                }}
                className="h-9 w-9 rounded-full"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{isMuted ? 'Unmute' : 'Mute'}</p></TooltipContent>
          </Tooltip>

          {/* Camera Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewerCameraEnabled ? "default" : "ghost"}
                size="icon"
                onClick={toggleViewerCamera}
                disabled={isCameraRequesting}
                className="h-9 w-9 rounded-full"
              >
                {isCameraRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : viewerCameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{viewerCameraEnabled ? 'Disable Camera' : 'Enable Camera'}</p></TooltipContent>
          </Tooltip>

          {/* Mic Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewerMicEnabled ? "default" : "ghost"}
                size="icon"
                onClick={toggleViewerMic}
                disabled={isMicRequesting}
                className="h-9 w-9 rounded-full"
              >
                {isMicRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : viewerMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{viewerMicEnabled ? 'Disable Mic' : 'Enable Mic'}</p></TooltipContent>
          </Tooltip>

          {/* Fullscreen */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-9 w-9 rounded-full">
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</p></TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          {/* Like */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={cn("gap-1.5 rounded-full", isLiked && "text-destructive")}
          >
            <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
            <span className="text-xs">{likes}</span>
          </Button>

          {/* Gift */}
          <Button variant="ghost" size="icon" onClick={() => setShowGiftSelector(true)} className="h-9 w-9 rounded-full">
            <Gift className="w-4 h-4" />
          </Button>

          {/* Chat (mobile only - opens sheet) */}
          <Button variant="ghost" size="icon" onClick={() => setShowFullChat(!showFullChat)} className="h-9 w-9 rounded-full md:hidden">
            <MessageCircle className="w-4 h-4" />
          </Button>

          {/* Share */}
          <Button variant="ghost" size="icon" onClick={handleShare} className="h-9 w-9 rounded-full">
            <Share2 className="w-4 h-4" />
          </Button>

          {/* Leave */}
          <Button variant="destructive" size="sm" onClick={onClose} className="gap-1.5 rounded-full">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>
      </div>

      {/* Gift animations */}
      <LivestreamGiftAnimation animations={giftAnimations} />

      {/* Gift selector */}
      <LivestreamGiftSelector
        open={showGiftSelector}
        onOpenChange={setShowGiftSelector}
        hostUserId={hostUserId}
        hostName={hostName}
        streamId={streamId}
        onGiftSent={(gift) => console.log('Gift sent:', gift)}
      />

      {/* Mobile Chat Sheet */}
      <Sheet open={showFullChat} onOpenChange={setShowFullChat}>
        <SheetContent side="bottom" className="h-[60vh] p-0">
          <LiveStreamChat streamId={streamId} isMobile={true} />
        </SheetContent>
      </Sheet>

      <style>{`
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
    </TooltipProvider>
  );
};
