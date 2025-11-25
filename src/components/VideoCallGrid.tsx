import React, { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff } from 'lucide-react';

interface VideoTile {
  id: string;
  displayName: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  stream?: MediaStream;
  isHost?: boolean;
  isYou?: boolean;
  isMuted?: boolean;
}

interface VideoCallGridProps {
  hostVideoRef: React.RefObject<HTMLVideoElement>;
  hostName: string;
  viewerCameras: Map<string, { stream: MediaStream; displayName: string; avatarUrl?: string }>;
  viewerStream?: MediaStream;
  viewerCameraEnabled: boolean;
  viewerName?: string;
  isMuted?: boolean;
}

const getGridClass = (count: number): string => {
  if (count === 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-1 md:grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
  return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
};

export const VideoCallGrid: React.FC<VideoCallGridProps> = ({
  hostVideoRef,
  hostName,
  viewerCameras,
  viewerStream,
  viewerCameraEnabled,
  viewerName = 'You',
  isMuted = false,
}) => {
  const tiles: VideoTile[] = [];

  // Add host tile
  tiles.push({
    id: 'host',
    displayName: hostName,
    videoRef: hostVideoRef,
    isHost: true,
  });

  // Add other viewers' cameras
  viewerCameras.forEach((camera, sessionToken) => {
    tiles.push({
      id: sessionToken,
      displayName: camera.displayName,
      stream: camera.stream,
    });
  });

  // Add local viewer's camera if enabled
  if (viewerCameraEnabled && viewerStream) {
    tiles.push({
      id: 'self',
      displayName: viewerName,
      stream: viewerStream,
      isYou: true,
      isMuted,
    });
  }

  const gridClass = getGridClass(tiles.length);

  return (
    <div className={`grid ${gridClass} gap-2 p-2 h-full w-full bg-background`}>
      {tiles.map((tile) => (
        <VideoTile key={tile.id} tile={tile} />
      ))}
    </div>
  );
};

const VideoTile: React.FC<{ tile: VideoTile }> = ({ tile }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = tile.videoRef || localVideoRef;

  useEffect(() => {
    if (!tile.stream || !videoRef.current) return;

    console.log(`📹 Connecting stream for ${tile.displayName}`);
    videoRef.current.srcObject = tile.stream;
    
    videoRef.current.play().catch(err => {
      console.warn(`⚠️ Video autoplay failed for ${tile.displayName}:`, err);
    });

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [tile.stream, tile.displayName]);

  return (
    <div className="relative w-full h-full min-h-[150px] md:min-h-[200px] rounded-lg overflow-hidden bg-black border border-border shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={tile.isYou || tile.isHost}
        className={`w-full h-full object-cover ${tile.isYou ? 'scale-x-[-1]' : ''}`}
      />
      
      {/* Name Label and Badges */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium truncate">
            {tile.displayName}
          </span>
          
          {tile.isHost && (
            <Badge variant="destructive" className="text-xs px-2 py-0">
              Host
            </Badge>
          )}
          
          {tile.isYou && (
            <Badge variant="secondary" className="text-xs px-2 py-0">
              You
            </Badge>
          )}
          
          {tile.isMuted && (
            <MicOff className="w-3 h-3 text-white" />
          )}
        </div>
      </div>
    </div>
  );
};
