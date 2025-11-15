import React, { useEffect, useRef, useState } from 'react';
import { ViewerConnection, ConnectionState } from '@/utils/ViewerConnection';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Volume2, VolumeX, Gift, MessageCircle, ChevronRight, ChevronLeft, Users, UserCircle, Loader2 } from 'lucide-react';
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
      case 'failed': return 'Connection failed';
      case 'timeout': return 'Connection timed out';
      default: return 'Connecting...';
    }
  };

  // Initialize viewer and load like status
  useEffect(() => {
    const initViewer = async () => {
      if (!videoRef.current) return;

      const videoEl = videoRef.current;
      // Ensure video is muted for autoplay
      videoEl.muted = true;

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
        setHasVideo(true);
      };
      video.onplay = () => {
        setHasVideo(true);
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

    return () => {
      const cleanup = async () => {
        viewerConnectionRef.current?.disconnect();
        
        // Leave stream
        if (sessionToken) {
          await supabase.rpc('leave_stream_viewer', {
            p_session_token: sessionToken
          });
        }
      };
      cleanup();
    };
  }, [streamId, user]);

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

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
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
            <div className="absolute inset-0 flex items-center justify-center flex-col space-y-3 bg-black">
              <Loader2 className="h-12 w-12 animate-spin text-white" />
              <p className="text-white font-medium text-sm md:text-base">{getConnectionMessage(connectionState)}</p>
              {(connectionState === 'failed' || connectionState === 'timeout') && (
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={handleHardReconnect}
                    variant="outline"
                    className="text-white border-white hover:bg-white hover:text-black"
                  >
                    Retry Connection
                  </Button>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="text-white border-white/50 hover:bg-white/10"
                  >
                    Hard Reset
                  </Button>
                </div>
              )}
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
                  {viewerConnectionRef.current && (
                    <div className="absolute top-20 left-2 md:top-24 md:left-4 bg-black/70 text-white text-xs p-2 rounded max-w-xs max-h-32 overflow-y-auto">
                      <div className="font-bold mb-1">Debug Log:</div>
                      {viewerConnectionRef.current.getDebugLog().map((log, i) => (
                        <div key={i} className="font-mono text-[10px]">{log}</div>
                      ))}
                    </div>
                  )}
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
