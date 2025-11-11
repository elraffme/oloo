import React, { useEffect, useRef, useState } from 'react';
import { ViewerConnection } from '@/utils/ViewerConnection';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Volume2, VolumeX, Gift, MessageCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { GiftSelector } from '@/components/GiftSelector';
import { CurrencyWallet } from '@/components/CurrencyWallet';
import { LiveStreamChat } from '@/components/LiveStreamChat';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

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
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showGiftSelector, setShowGiftSelector] = useState(false);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    const initViewer = async () => {
      if (!videoRef.current) return;

      const viewerId = crypto.randomUUID();
      viewerConnectionRef.current = new ViewerConnection(
        streamId,
        viewerId,
        videoRef.current
      );

      await viewerConnectionRef.current.connect(supabase);
      setIsConnected(true);
    };

    initViewer();

    return () => {
      viewerConnectionRef.current?.disconnect();
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

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-black/80 p-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-4 flex-1">
          <div>
            <h2 className="text-lg font-semibold">{streamTitle}</h2>
            <p className="text-sm text-gray-300">{hostName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSendMessage}
            className="gap-2 text-white hover:bg-white/20"
          >
            <MessageCircle className="w-4 h-4" />
            Message
          </Button>
          <CurrencyWallet onBuyCoins={() => setShowCoinShop(true)} />
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex relative bg-black overflow-hidden">
        <div className={`flex-1 relative transition-all duration-300 ${showChat ? 'mr-80' : ''}`}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center flex-col space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              <p className="text-white font-medium">Establishing WebRTC connection...</p>
              <p className="text-white/70 text-sm">Connecting peer-to-peer</p>
            </div>
          )}
          
          {isConnected && (
            <Badge className="absolute top-4 left-4 bg-green-500 text-white">
              <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
              Connected via WebRTC
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowChat(!showChat)}
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white"
          >
            {showChat ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </Button>
        </div>

        {showChat && (
          <div className="w-80 h-full border-l border-border">
            <LiveStreamChat streamId={streamId} />
          </div>
        )}
      </div>

      <div className="bg-black/80 p-4 flex items-center justify-center gap-4">
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
