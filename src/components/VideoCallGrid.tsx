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
  isFullscreen?: boolean;
}

// Priority layout: host always gets prominent positioning
const getLayoutConfig = (count: number, hasHost: boolean) => {
  if (count === 1) {
    return { type: 'single', gridClass: 'grid-cols-1' };
  }
  if (count === 2) {
    // 2 participants: side by side on desktop, stacked on mobile with equal sizing
    return { type: 'duo', gridClass: 'grid-cols-1 md:grid-cols-2' };
  }
  // 3+ participants: host featured layout
  return { type: 'featured', gridClass: '' };
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
  isFullscreen = false,
}) => {
  const tiles: VideoTile[] = [];
  const seenSessionTokens = new Set<string>();

  // CRITICAL: Log stream state for debugging participant-count audio issues
  useEffect(() => {
    console.log('🎥 VideoCallGrid render:', {
      hasHostStream: !!hostStream,
      hostAudioTracks: hostStream?.getAudioTracks().length || 0,
      hostVideoTracks: hostStream?.getVideoTracks().length || 0,
      viewerCamerasCount: viewerCameras.size,
      viewerStreamExists: !!viewerStream,
      relayedCount: relayedViewerCameras?.size || 0
    });
    
    // Log each audio track status
    if (hostStream) {
      const audioTracks = hostStream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log('🔊 Host audio tracks in grid:', audioTracks.map(t => ({
          id: t.id,
          enabled: t.enabled,
          muted: t.muted,
          state: t.readyState
        })));
      } else {
        console.warn('⚠️ VideoCallGrid: Host stream has NO audio tracks!');
      }
    }
  }, [hostStream, viewerCameras, viewerStream, relayedViewerCameras]);

  // Add host tile only if host stream is available
  // IMPORTANT: Audio is part of hostStream, layout changes should NOT affect audio
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

  // Log tile count for debugging
  console.log(`📊 VideoCallGrid tiles: ${tiles.length} (host: ${tiles.some(t => t.isHost)}, viewers: ${tiles.filter(t => !t.isHost && !t.isYou).length})`);

  const layoutConfig = getLayoutConfig(tiles.length, tiles.some(t => t.isHost));

  // Featured layout for 3+ participants with host priority
  if (layoutConfig.type === 'featured' && tiles.length >= 3) {
    const hostTile = tiles.find(t => t.isHost);
    const otherTiles = tiles.filter(t => !t.isHost);
    
    return (
      <div 
        className="flex flex-col h-full w-full p-2 gap-2"
        style={{
          backgroundColor: isFullscreen ? '#000' : 'hsl(var(--background))',
          display: 'flex',
          visibility: 'visible',
          width: isFullscreen ? '100vw' : '100%',
          height: isFullscreen ? '100vh' : '100%',
        }}
      >
        {/* Host takes 60% of vertical space with fixed aspect ratio */}
        {hostTile && (
          <div className="flex-[3] min-h-0">
            <VideoTile key={hostTile.id} tile={hostTile} isFeatureHost />
          </div>
        )}
        {/* Viewers share remaining 40% in a scrollable row */}
        <div className="flex-[2] min-h-0 flex gap-2 overflow-x-auto">
          {otherTiles.map((tile) => (
            <div key={tile.id} className="flex-shrink-0 h-full aspect-video">
              <VideoTile tile={tile} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Standard grid for 1-2 participants
  return (
    <div 
      className={`grid ${layoutConfig.gridClass} gap-2 p-2 h-full w-full`}
      style={{
        backgroundColor: isFullscreen ? '#000' : 'hsl(var(--background))',
        display: 'grid',
        visibility: 'visible',
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : '100%',
      }}
    >
      {tiles.map((tile) => (
        <VideoTile key={tile.id} tile={tile} isFeatureHost={tile.isHost && tiles.length === 2} />
      ))}
    </div>
  );
};

interface VideoTileProps {
  tile: VideoTile;
  isFeatureHost?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({ tile, isFeatureHost = false }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = tile.videoRef || localVideoRef;
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  // CRITICAL: Track stream ID to detect when stream object changes
  const lastStreamIdRef = useRef<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    if (!tile.stream || !videoRef.current) {
      console.log(`⚠️ VideoTile: Missing stream or ref for ${tile.displayName}`);
      setIsConnecting(true);
      return;
    }

    const currentStreamId = tile.stream.id;
    const isNewStream = lastStreamIdRef.current !== currentStreamId;
    lastStreamIdRef.current = currentStreamId;

    const audioTracks = tile.stream.getAudioTracks();
    const videoTracks = tile.stream.getVideoTracks();
    
    console.log(`📹 VideoTile: ${isNewStream ? 'NEW' : 'EXISTING'} stream for ${tile.displayName}`, {
      streamId: currentStreamId,
      audioTrackCount: audioTracks.length,
      videoTrackCount: videoTracks.length,
      audioTracks: audioTracks.map(t => ({ 
        id: t.id, 
        kind: t.kind, 
        enabled: t.enabled, 
        readyState: t.readyState,
        muted: t.muted 
      })),
      isHost: tile.isHost,
      isYou: tile.isYou
    });
    
    // CRITICAL: Force-enable ALL audio tracks before attaching to video element
    // This ensures audio works regardless of participant count or layout
    audioTracks.forEach(track => {
      // ALWAYS enable audio tracks, don't just check if disabled
      track.enabled = true;
      setAudioReady(true);
      
      console.log(`🔊 VideoTile: Audio track enabled for ${tile.displayName}:`, {
        id: track.id,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted
      });
      
      // Add track event listeners for debugging
      track.onmute = () => {
        console.log(`🔇 VideoTile: Audio track muted for ${tile.displayName}`);
        // CRITICAL: Re-enable on mute (mobile/participant change fix)
        setTimeout(() => {
          if (track.readyState === 'live') {
            track.enabled = true;
            console.log(`🔊 VideoTile: Re-enabled muted audio track`);
          }
        }, 50);
      };
      track.onunmute = () => {
        console.log(`🔊 VideoTile: Audio track unmuted for ${tile.displayName}`);
      };
      track.onended = () => {
        console.log(`❌ VideoTile: Audio track ended for ${tile.displayName}`);
        setAudioReady(false);
      };
    });
    
    // CRITICAL: Attach stream to video element
    // Always re-attach on stream change to ensure audio is picked up
    videoRef.current.srcObject = tile.stream;
    setIsConnecting(false);
    
    // Mobile-friendly play with retry and user interaction prompt
    const playWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          if (videoRef.current) {
            // Ensure video element is not muted for host audio (but muted for self)
            if (!tile.isYou) {
              videoRef.current.muted = false;
            }
            
            await videoRef.current.play();
            setPlaybackBlocked(false);
            console.log(`✅ Video playback started for ${tile.displayName} on attempt ${i + 1}`);
            
            // Log audio output state after successful play
            const currentAudioTracks = tile.stream?.getAudioTracks() || [];
            if (currentAudioTracks.length > 0 && !tile.isYou) {
              console.log(`🔊 Audio should be playing for ${tile.displayName}:`, {
                videoMuted: videoRef.current?.muted,
                audioTrackEnabled: currentAudioTracks[0].enabled,
                audioTrackState: currentAudioTracks[0].readyState,
                audioTrackMuted: currentAudioTracks[0].muted
              });
            }
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
    // CRITICAL: This ensures audio works even if video arrives first
    const handleTrackAdded = (event: MediaStreamTrackEvent) => {
      console.log(`🎬 VideoTile: Track added to stream for ${tile.displayName}:`, {
        kind: event.track.kind,
        enabled: event.track.enabled,
        readyState: event.track.readyState
      });
      
      // Force-enable newly added audio tracks
      if (event.track.kind === 'audio') {
        event.track.enabled = true;
        setAudioReady(true);
        console.log(`🔊 VideoTile: Force-enabled newly added audio track for ${tile.displayName}`);
        
        // Re-attach stream and play to pick up new audio
        if (videoRef.current) {
          videoRef.current.srcObject = tile.stream;
          playWithRetry();
        }
      }
    };
    tile.stream.addEventListener('addtrack', handleTrackAdded);
    
    // Also listen for track removal
    const handleTrackRemoved = (event: MediaStreamTrackEvent) => {
      console.log(`❌ VideoTile: Track removed from stream for ${tile.displayName}:`, {
        kind: event.track.kind
      });
      if (event.track.kind === 'audio') {
        setAudioReady(false);
      }
    };
    tile.stream.addEventListener('removetrack', handleTrackRemoved);

    return () => {
      tile.stream?.removeEventListener('addtrack', handleTrackAdded);
      tile.stream?.removeEventListener('removetrack', handleTrackRemoved);
      
      // Cleanup track event listeners
      tile.stream?.getAudioTracks().forEach(track => {
        track.onmute = null;
        track.onunmute = null;
        track.onended = null;
      });
      
      if (videoRef.current) {
        console.log(`🧹 VideoTile: Cleaning up stream for ${tile.displayName}`);
        videoRef.current.srcObject = null;
      }
    };
  }, [tile.stream, tile.stream?.id, tile.displayName, tile.isYou, tile.isHost]);
  
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

  // Use object-contain for consistent framing - no cropping/zooming
  // This ensures host and viewer cameras display identically regardless of container size
  const objectFitClass = 'object-contain';

  return (
    <div className={`relative w-full h-full min-h-[150px] md:min-h-[200px] rounded-lg overflow-hidden bg-muted border border-border shadow-lg ${isFeatureHost ? 'ring-2 ring-primary' : ''}`}>
      {hasStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          webkit-playsinline="true"
          x-webkit-airplay="allow"
          muted={tile.isYou}
          className={`w-full h-full ${objectFitClass} bg-muted ${tile.isYou ? 'scale-x-[-1]' : ''}`}
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
          className="absolute inset-0 flex items-center justify-center bg-background/50 cursor-pointer z-10"
          onClick={handleTapToPlay}
        >
          <div className="text-center">
            <Volume2 className="w-8 h-8 mx-auto mb-2 text-foreground" />
            <span className="text-sm text-foreground font-medium">Tap to hear audio</span>
          </div>
        </div>
      )}
      
      {/* Name Label and Badges - Always Visible */}
      <div className="absolute bottom-0 left-0 right-0 bg-background/90 p-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-semibold truncate drop-shadow-lg">
            {tile.displayName}
          </span>
          
          {/* Show mic icon when viewer has active audio */}
          {hasAudioTrack && !tile.isYou && !tile.isHost && (
            <Mic className="w-3 h-3 text-primary drop-shadow-lg" />
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
            <MicOff className="w-3 h-3 text-muted-foreground drop-shadow-lg" />
          )}
        </div>
      </div>
    </div>
  );
};
