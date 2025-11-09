import React, { useEffect, useRef, useState } from 'react';
import { ViewerConnection } from '@/utils/ViewerConnection';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, Volume2, VolumeX } from 'lucide-react';

interface StreamViewerProps {
  streamId: string;
  streamTitle: string;
  hostName: string;
  onClose: () => void;
}

const StreamViewer: React.FC<StreamViewerProps> = ({
  streamId,
  streamTitle,
  hostName,
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerConnectionRef = useRef<ViewerConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

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

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-black/80 p-4 flex items-center justify-between text-white">
        <div>
          <h2 className="text-lg font-semibold">{streamTitle}</h2>
          <p className="text-sm text-gray-300">{hostName}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 relative bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />
        
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse text-white">Connecting to stream...</div>
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
      </div>
    </div>
  );
};

export default StreamViewer;
