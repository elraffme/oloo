import React, { useEffect, useRef, useState } from 'react';
import { ViewerConnection, ConnectionState } from '@/utils/ViewerConnection';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Volume2, VolumeX, Gift, MessageCircle, ChevronRight, ChevronLeft, Users, UserCircle, Loader2, Play, RefreshCw, Router, Zap } from 'lucide-react';
import { GiftSelector } from '@/components/GiftSelector';
import { CurrencyWallet } from '@/components/CurrencyWallet';
import { LiveStreamChat } from '@/components/LiveStreamChat';
import { FloatingActionButtons } from '@/components/FloatingActionButtons';
import { LikeAnimation } from '@/components/LikeAnimation';
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
  const [iceType, setICEType] = useState<string>('unknown');
  const [showDebugInfo, setShowDebugInfo] = useState(true); // Show by default for debugging
  const { viewers, isLoading: viewersLoading } = useStreamViewers(streamId);

  const getConnectionMessage = (state: ConnectionState): string => {
    switch (state) {
      case 'checking_broadcaster': return 'Checking if broadcaster is online...';
      case 'joining': return 'Joining stream...';
      case 'awaiting_offer': return 'Waiting for connection...';
      case 'processing_offer': return 'Processing connection...';
      case 'awaiting_ice': return 'Establishing connection...';
      case 'connected': return 'Connected! Loading video...';
      case 'streaming': return 'Streaming';
      case 'awaiting_user_interaction': return 'Click to play';
      case 'failed': return 'Connection failed';
      case 'timeout': return 'Connection timed out';
      default: return 'Connecting...';
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

  // Initialize viewer and load like status
  useEffect(() => {
    const initViewer = async () => {
      if (!videoRef.current) return;
      
      // Prevent multiple simultaneous initializations
      if (viewerConnectionRef.current) {
        console.log('⚠️ Connection already exists, skipping re-init');
        return;
      }
      
      // Ensure video element is properly configured
      const videoEl = videoRef.current;
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;
      console.log('📹 Video element configured: autoplay, playsInline, muted');

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
        (state) => setConnectionState(state),
        (type) => setICEType(type)
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
          event: '*',
          schema: 'public',
          table: 'streaming_sessions',
          filter: `id=eq.${streamId}`
        },
        (payload) => {
          if (payload.new && 'total_likes' in payload.new) {
            setTotalLikes(payload.new.total_likes || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

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
  const handleHardReconnect = async () => {
    if (!viewerConnectionRef.current) return;
    
    try {
      setConnectionState('checking_broadcaster');
      await viewerConnectionRef.current.hardReconnect(supabase);
      toast.info('Reconnecting with fresh connection...');
    } catch (error) {
      console.error('Hard reconnect failed:', error);
      toast.error('Reconnection failed');
    }
  };
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
              
              {/* Enhanced Debug Panel */}
              <div className="absolute bottom-4 left-4 right-4 p-4 bg-black/90 rounded-lg text-left max-h-64 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-xs text-gray-400">Connection State</p>
                    <p className="text-sm text-white font-semibold">{connectionState}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">ICE Type</p>
                    <p className="text-sm text-white font-semibold">{iceType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Session Token</p>
                    <p className="text-sm text-white font-mono">{sessionToken?.substring(0, 12)}...</p>
                  </div>
                  {videoRef.current && (
                    <div>
                      <p className="text-xs text-gray-400">Video Resolution</p>
                      <p className="text-sm text-white">{videoRef.current.videoWidth}x{videoRef.current.videoHeight}</p>
                    </div>
                  )}
                </div>
                
                {viewerConnectionRef.current && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-1">Signaling Log (last 10):</p>
                    <div className="space-y-1">
                      {viewerConnectionRef.current.getDebugLog().slice(-10).map((log, i) => (
                        <p key={i} className="text-xs text-gray-300 font-mono leading-tight">{log}</p>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button 
                  onClick={handleHardReconnect}
                  size="sm"
                  variant="secondary"
                  className="mt-3 w-full"
                >
                  Force Reconnect
                </Button>
              </div>
            </div>
          )}
          
          {connectionState === 'streaming' && (
            <>
              <Badge 
                className="absolute top-2 left-2 md:top-4 md:left-4 bg-green-500 text-white text-xs cursor-pointer"
                onClick={() => setShowDebugInfo(!showDebugInfo)}
              >
                <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                <span className="hidden md:inline">Live via WebRTC</span>
                <span className="md:hidden">LIVE</span>
              </Badge>
              {showDebugInfo && (
                <>
                  {iceType !== 'unknown' && (
                    <Badge className="absolute top-10 left-2 md:top-14 md:left-4 bg-blue-500/80 text-white text-xs">
                      ICE: {iceType}
                    </Badge>
                  )}
                  <div className="absolute top-20 left-2 md:top-24 md:left-4 bg-black/90 text-white text-xs p-3 rounded-lg max-w-xs border border-border/20">
                    <div className="font-semibold mb-2 text-primary">Connection Info</div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">State:</span>
                        <span className="font-medium">{connectionState}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ICE Type:</span>
                        <span className="font-medium">{iceType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Session:</span>
                        <span className="font-mono text-[10px]">{sessionToken?.slice(0, 8)}...</span>
                      </div>
                    </div>
                    {showConnectionControls && (
                      <div className="mt-2 pt-2 border-t border-border/20 space-y-1">
                        <Button
                          onClick={handleRequestOfferAgain}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-7 text-xs"
                        >
                          <Router className="w-3 h-3 mr-1" />
                          Request Offer
                        </Button>
                        <Button
                          onClick={handleTryTURNOnly}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-7 text-xs"
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          Force TURN
                        </Button>
                        <Button
                          onClick={handleHardReconnect}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-7 text-xs"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Reconnect
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Chat Below Video - Desktop Only */}
        {showChat && !isMobile && (
          <div className="h-[300px] md:h-[350px] border-t border-border bg-background">
            <LiveStreamChat streamId={streamId} isMobile={false} />
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
