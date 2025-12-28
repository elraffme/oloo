import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2 } from 'lucide-react';

interface VideoTile {
  id: string;
  displayName: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  stream?: MediaStream;
  isHost?: boolean;
  isYou?: boolean;
  isMuted?: boolean;
  hasMic?: boolean;
}

interface VideoCallGridProps {
  hostStream: MediaStream | null;
  hostName: string;
  viewerCameras: Map<string, { stream: MediaStream; displayName: string; avatarUrl?: string }>;
  viewerStream?: MediaStream;
  viewerCameraEnabled: boolean;
  viewerName?: string;
  isMuted?: boolean;
  relayedViewerCameras?: Map<string, { stream: MediaStream; displayName: string; avatarUrl?: string }>;
  isHost: boolean;
}

const getGridClass = (count: number): string => {
  if (count === 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-1 md:grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
  return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
};

export const VideoCallGrid: React.FC<VideoCallGridProps> = ({
  hostStream,
  hostName,
  viewerCameras,
  viewerStream,
  viewerCameraEnabled,
  viewerName = 'You',
  isMuted = false,
  relayedViewerCameras,
}) => {
  const tiles: VideoTile[] = [];
  const seenSessionTokens = new Set<string>();

  // Add host tile only if host stream is available
  if (hostStream) {
    tiles.push({
      id: 'host',
      displayName: hostName,
      stream: hostStream,
      isHost: true,
      isYou: hostName === 'You (Host)' ? true : false
    });
  }

  // Add other viewers' cameras (direct connections)
  viewerCameras.forEach((camera, sessionToken) => {
    if (!seenSessionTokens.has(sessionToken)) {
      seenSessionTokens.add(sessionToken);
      tiles.push({
        id: sessionToken,
        displayName: camera.displayName,
        stream: camera.stream,
      });
    }
  });

  // Add relayed viewer cameras (forwarded by host)
  relayedViewerCameras?.forEach((camera, sessionToken) => {
    if (!seenSessionTokens.has(sessionToken)) {
      seenSessionTokens.add(sessionToken);
      tiles.push({
        id: `relay-${sessionToken}`,
        displayName: camera.displayName,
        stream: camera.stream,
      });
    }
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
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    if (!tile.stream || !videoRef.current) {
      console.log(`⚠️ VideoTile: Missing stream or ref for ${tile.displayName}`);
      setIsConnecting(true);
      return;
    }

    console.log(`📹 VideoTile: Attaching stream for ${tile.displayName}`, {
      streamId: tile.stream.id,
      tracks: tile.stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
      isHost: tile.isHost,
      isYou: tile.isYou
    });
    
    videoRef.current.srcObject = tile.stream;
    setIsConnecting(false);
    
    // Mobile-friendly play with retry and user interaction prompt
    const playWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          if (videoRef.current) {
            await videoRef.current.play();
            setPlaybackBlocked(false);
            console.log(`✅ Video playback started for ${tile.displayName} on attempt ${i + 1}`);
            return;
          }
        } catch (err) {
          console.warn(`⚠️ Video autoplay attempt ${i + 1} failed for ${tile.displayName}:`, err);
          if (i === retries - 1 && !tile.isYou) {
            setPlaybackBlocked(true);
          }
          await new Promise(r => setTimeout(r, 200 * (i + 1)));
        }
      }
    };
    
    playWithRetry();

    // Listen for track additions (for streams that add tracks later)
    const handleTrackAdded = () => {
      console.log(`🎬 VideoTile: Track added to stream for ${tile.displayName}`);
      playWithRetry();
    };
    tile.stream.addEventListener('addtrack', handleTrackAdded);

    return () => {
      tile.stream?.removeEventListener('addtrack', handleTrackAdded);
      if (videoRef.current) {
        console.log(`🧹 VideoTile: Cleaning up stream for ${tile.displayName}`);
        videoRef.current.srcObject = null;
      }
    };
  }, [tile.stream, tile.displayName, tile.isYou, tile.isHost]);
  
  const handleTapToPlay = async () => {
    if (videoRef.current) {
      try {
        videoRef.current.muted = false; // Unmute on user tap
        await videoRef.current.play();
        setPlaybackBlocked(false);
        console.log(`✅ Audio playback started after user tap for ${tile.displayName}`);
      } catch (err) {
        console.error('Play failed after tap:', err);
      }
    }
  };

  // Show placeholder if no stream or stream has no video tracks
  const hasStream = tile.stream && tile.stream.getVideoTracks().length > 0;
  const hasActiveVideoTrack = tile.stream?.getVideoTracks().some(t => t.enabled && t.readyState === 'live') || false;
  
  // Check if stream has active audio track
  const hasAudioTrack = tile.stream?.getAudioTracks().some(t => t.enabled) || false;

  return (
    <div className="relative w-full h-full min-h-[150px] md:min-h-[200px] rounded-lg overflow-hidden bg-black border border-border shadow-lg">
      {hasStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          webkit-playsinline="true"
          x-webkit-airplay="allow"
          muted={tile.isYou}
          className={`w-full h-full object-contain ${tile.isYou ? 'scale-x-[-1]' : ''}`}
          onLoadedMetadata={() => {
            console.log(`📺 VideoTile: Metadata loaded for ${tile.displayName}`);
            videoRef.current?.play().catch(e => console.warn('Play after metadata failed:', e));
          }}
          onCanPlay={() => {
            console.log(`▶️ VideoTile: Can play for ${tile.displayName}`);
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <div className="text-center">
            <div className={`w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2 ${isConnecting ? 'animate-pulse' : ''}`}>
              <span className="text-2xl text-primary">{tile.displayName[0]}</span>
            </div>
            <p className="text-sm text-muted-foreground">{isConnecting ? 'Connecting...' : 'No video'}</p>
          </div>
        </div>
      )}
      
      {/* Show tap to play overlay on mobile if blocked */}
      {playbackBlocked && !tile.isYou && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer z-10"
          onClick={handleTapToPlay}
        >
          <div className="text-center">
            <Volume2 className="w-8 h-8 mx-auto mb-2 text-white" />
            <span className="text-sm text-white font-medium">Tap to hear audio</span>
          </div>
        </div>
      )}
      
      {/* Name Label and Badges - Always Visible */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/90 p-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold truncate drop-shadow-lg">
            {tile.displayName}
          </span>
          
          {/* Show mic icon when viewer has active audio */}
          {hasAudioTrack && !tile.isYou && !tile.isHost && (
            <Mic className="w-3 h-3 text-green-400 drop-shadow-lg" />
          )}
          
          {tile.isHost && (
            <Badge variant="destructive" className="text-xs px-2 py-0 shadow-lg">
              Host
            </Badge>
          )}
          
          {tile.isYou && (
            <Badge variant="secondary" className="text-xs px-2 py-0 shadow-lg">
              You
            </Badge>
          )}
          
          {tile.isMuted && (
            <MicOff className="w-3 h-3 text-white drop-shadow-lg" />
          )}
        </div>
      </div>
    </div>
  );
};
