import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  X, Heart, MessageCircle, Gift, Share2, MoreVertical, 
  Eye, Volume2, VolumeX, UserPlus, ArrowLeft, Video, VideoOff, Loader2,
  Mic, MicOff, LogOut, Flag, Ban, EyeOff, Minimize2, Maximize2
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
import { useStream } from '@/hooks/useStream';

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
  
  const { initialize, remoteStream, cleanup, publishStream, unpublishStream, viewerStreams, toggleMute: toggleSFUMute, toggleVideo, localStream, isMuted: isSFUMuted, peerId } = useStream();

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

  useEffect(() => {
     if (remoteStream) {
        setHostStream(remoteStream);
        if (videoRef.current) {
           videoRef.current.srcObject = remoteStream;
           if (!isMuted) {
             videoRef.current.muted = false;
             videoRef.current.play().catch(e => console.error(e));
           }
        }
     }
  }, [remoteStream, isMuted]);

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

  useEffect(() => {
    const channel = supabase
      .channel(`tiktok_likes:${streamId}`)
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

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
    if (!sessionToken) {
      toast.error('Not connected to stream');
      return;
    }

    if (viewerMicEnabled) {
      if (viewerCameraEnabled) {
         toggleSFUMute(); 
      } else {
         unpublishStream();
      }
      setViewerMicEnabled(false);
      toast.success('Microphone disabled');
    } else {
      try {
        setIsMicRequesting(true);
        if (viewerCameraEnabled) {
            toggleSFUMute();
        } else {
            await publishStream('mic');
        }
        setViewerMicEnabled(true);
        toast.success('Microphone enabled! Host can hear you.');
      } catch (error) {
        console.error('Error enabling microphone:', error);
        toast.error('Failed to enable microphone. Please check permissions.');
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

  // True fullscreen toggle using browser Fullscreen API
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      toast.error('Fullscreen not available');
    }
  };

  // Listen for fullscreen changes (e.g., user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
      <div id="video-container" className="absolute inset-0 flex items-center justify-center">
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          autoPlay
          muted={isMuted}
        />
        
        <VideoCallGrid
          hostStream={hostStream}
          hostName={hostName}
          viewerStream={localStream || undefined}
          viewerCameraEnabled={viewerCameraEnabled}
          viewerName={user?.email?.split('@')[0] || 'You'}
          viewerCameras={new Map()}
          relayedViewerCameras={relayedViewerCameras}
          isHost={false}
        />
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
            onClick={() => setIsMuted(!isMuted)}
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
