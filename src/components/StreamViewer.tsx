import React, { useEffect, useRef, useState } from 'react';
import { ViewerConnection } from '@/utils/ViewerConnection';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Volume2, VolumeX, Gift, MessageCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { GiftSelector } from '@/components/GiftSelector';
import { CurrencyWallet } from '@/components/CurrencyWallet';
import { LiveStreamChat } from '@/components/LiveStreamChat';
import { FloatingActionButtons } from '@/components/FloatingActionButtons';
import { LikeAnimation } from '@/components/LikeAnimation';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

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
  const [isMuted, setIsMuted] = useState(false);
  const [showGiftSelector, setShowGiftSelector] = useState(false);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [showChat, setShowChat] = useState(!isMobile); // Hide chat by default on mobile
  const [isLiked, setIsLiked] = useState(false);
  const [totalLikes, setTotalLikes] = useState(0);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [likeAnimationTrigger, setLikeAnimationTrigger] = useState(0);

  // Initialize viewer and load like status
  useEffect(() => {
    const initViewer = async () => {
      if (!videoRef.current) return;

      const viewerId = crypto.randomUUID();
      viewerConnectionRef.current = new ViewerConnection(
        streamId,
        viewerId,
        videoRef.current
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
      viewerConnectionRef.current?.disconnect();
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
      return;
    }
    navigate('/app/messages', { state: { selectedUserId: hostUserId } });
  };

  const handleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like streams');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('toggle_stream_like', {
        p_stream_id: streamId
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'liked' in data && 'total_likes' in data) {
        setIsLiked(data.liked as boolean);
        setTotalLikes(data.total_likes as number);
        
        if (data.liked) {
          setShowLikeAnimation(true);
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like stream');
    }
  };

  const handleChatToggle = () => {
    setShowChat(!showChat);
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
      <div className="flex-1 flex relative bg-black overflow-hidden">
        <div className={`flex-1 relative transition-all duration-300 ${showChat && !isMobile ? 'md:mr-80' : ''}`}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center flex-col space-y-3 bg-black">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              <p className="text-white font-medium text-sm md:text-base">Establishing WebRTC connection...</p>
              <p className="text-white/70 text-xs md:text-sm">Connecting peer-to-peer</p>
            </div>
          )}
          
          {isConnected && !hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center flex-col space-y-3 bg-black">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              <p className="text-white font-medium text-sm md:text-base">Waiting for video stream...</p>
              <p className="text-white/70 text-xs md:text-sm">The broadcaster may not be live yet</p>
            </div>
          )}
          
          {isConnected && (
            <Badge className="absolute top-2 left-2 md:top-4 md:left-4 bg-green-500 text-white text-xs">
              <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
              <span className="hidden md:inline">Connected via WebRTC</span>
              <span className="md:hidden">LIVE</span>
            </Badge>
          )}

          {/* Desktop Chat Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleChatToggle}
            className="absolute top-2 right-2 md:top-4 md:right-4 bg-black/50 hover:bg-black/70 text-white hidden md:flex"
          >
            {showChat ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </Button>
        </div>

        {/* Desktop Chat Sidebar */}
        {showChat && !isMobile && (
          <div className="w-80 h-full border-l border-border hidden md:block">
            <LiveStreamChat streamId={streamId} />
          </div>
        )}

        {/* Mobile Chat Overlay */}
        {showChat && isMobile && (
          <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-background border-t border-border md:hidden animate-slide-in-bottom">
            <div className="relative h-full">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-muted-foreground/30 rounded-full" />
              <LiveStreamChat streamId={streamId} isMobile />
            </div>
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

      {/* Like Animation */}
      <LikeAnimation 
        key={likeAnimationTrigger}
        show={showLikeAnimation} 
        onComplete={() => setShowLikeAnimation(false)} 
      />

      {/* Bottom Controls - Desktop Only */}
      <div className="bg-black/80 p-3 md:p-4 flex items-center justify-center gap-2 md:gap-4 hidden md:flex">
        <Button
          variant={isMuted ? "destructive" : "default"}
          size="lg"
          onClick={toggleMute}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </Button>
        <Button
          variant="default"
          size="lg"
          onClick={() => setShowGiftSelector(true)}
          className="gap-2"
        >
          <Gift className="w-5 h-5" />
          Send Gift
        </Button>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="bg-black/80 p-3 flex items-center justify-between md:hidden">
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
          className="gap-2 text-white"
        >
          <MessageCircle className="w-4 h-4" />
          Message Host
        </Button>
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
