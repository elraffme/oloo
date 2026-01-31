import React, { useEffect, useRef, useCallback, useState } from 'react';

interface ViewerStream {
  id: string;
  stream: MediaStream;
}

interface ViewerAudioPlayerProps {
  viewerStreams: ViewerStream[];
}

/**
 * Hidden component that plays audio from all viewer streams for the host.
 * This ensures the host can hear all viewers regardless of the visual layout.
 * Audio is played through invisible video elements to handle both audio and video tracks.
 * 
 * CRITICAL: This component is essential for two-way audio in livestreams.
 * It works independently of participant count and visual layout.
 */
export const ViewerAudioPlayer: React.FC<ViewerAudioPlayerProps> = ({ viewerStreams }) => {
  // Track which viewers we're playing audio for
  const [activeViewers, setActiveViewers] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log(`[ViewerAudioPlayer] Rendering for ${viewerStreams.length} viewer stream(s)`);
    viewerStreams.forEach((viewer, idx) => {
      const audioTracks = viewer.stream?.getAudioTracks() || [];
      const videoTracks = viewer.stream?.getVideoTracks() || [];
      console.log(`[ViewerAudioPlayer] Viewer ${idx}: id=${viewer.id}, audio=${audioTracks.length}, video=${videoTracks.length}`);
    });
  }, [viewerStreams]);

  return (
    <div 
      aria-hidden="true" 
      style={{ 
        position: 'absolute', 
        width: 0, 
        height: 0, 
        overflow: 'hidden',
        pointerEvents: 'none'
      }}
    >
      {viewerStreams.map((viewer) => (
        <ViewerAudioElement 
          key={`${viewer.id}-${viewer.stream?.id || 'no-stream'}`} 
          viewer={viewer}
          onPlayStateChange={(playing) => {
            setActiveViewers(prev => {
              const next = new Set(prev);
              if (playing) {
                next.add(viewer.id);
              } else {
                next.delete(viewer.id);
              }
              return next;
            });
          }}
        />
      ))}
    </div>
  );
};

/**
 * Individual audio element for a single viewer stream.
 * Uses video element to properly handle MediaStream with both audio and video tracks.
 */
const ViewerAudioElement: React.FC<{ 
  viewer: ViewerStream;
  onPlayStateChange?: (playing: boolean) => void;
}> = ({ viewer, onPlayStateChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const streamIdRef = useRef<string | null>(null);

  const playAudio = useCallback(async () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    try {
      // Ensure unmuted and full volume
      videoElement.muted = false;
      videoElement.volume = 1.0;
      
      await videoElement.play();
      console.log(`[ViewerAudioPlayer] ✅ Playing audio for viewer ${viewer.id}`);
      onPlayStateChange?.(true);
      retryCountRef.current = 0;
    } catch (error: any) {
      console.error(`[ViewerAudioPlayer] ❌ Failed to play audio for ${viewer.id}:`, error.name);
      onPlayStateChange?.(false);
      
      // Retry with exponential backoff for autoplay policy issues
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.min(500 * Math.pow(2, retryCountRef.current - 1), 5000);
        console.log(`[ViewerAudioPlayer] Retrying play for ${viewer.id} in ${delay}ms (attempt ${retryCountRef.current})`);
        
        setTimeout(() => {
          if (videoRef.current && videoRef.current.paused) {
            playAudio();
          }
        }, delay);
      }
    }
  }, [viewer.id, onPlayStateChange]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !viewer.stream) {
      console.log(`[ViewerAudioPlayer] No element or stream for viewer ${viewer.id}`);
      onPlayStateChange?.(false);
      return;
    }

    // Skip if same stream
    if (streamIdRef.current === viewer.stream.id) {
      console.log(`[ViewerAudioPlayer] Same stream for ${viewer.id}, skipping re-attach`);
      return;
    }
    streamIdRef.current = viewer.stream.id;

    console.log(`[ViewerAudioPlayer] Setting up audio for viewer ${viewer.id}`, {
      streamId: viewer.stream.id,
      audioTracks: viewer.stream.getAudioTracks().length,
      videoTracks: viewer.stream.getVideoTracks().length
    });

    // Attach the stream to the video element
    videoElement.srcObject = viewer.stream;

    // Force-enable all audio tracks and setup monitoring
    viewer.stream.getAudioTracks().forEach((track, index) => {
      console.log(`[ViewerAudioPlayer] Audio track ${index} for ${viewer.id}:`, {
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        id: track.id
      });
      
      // Force enable if disabled
      if (!track.enabled) {
        track.enabled = true;
        console.log(`[ViewerAudioPlayer] Force-enabled audio track ${index} for ${viewer.id}`);
      }

      // Handle track being muted by system (common on mobile)
      track.onmute = () => {
        console.warn(`[ViewerAudioPlayer] Audio track ${index} muted for ${viewer.id}, re-enabling...`);
        track.enabled = true;
        // Try to resume playback
        if (videoElement.paused) {
          playAudio();
        }
      };

      track.onunmute = () => {
        console.log(`[ViewerAudioPlayer] Audio track ${index} unmuted for ${viewer.id}`);
      };
      
      track.onended = () => {
        console.log(`[ViewerAudioPlayer] Audio track ${index} ended for ${viewer.id}`);
        onPlayStateChange?.(false);
      };
    });

    // Start playing
    playAudio();

    // Listen for new tracks being added (dynamic track addition)
    const handleTrackAdded = (event: MediaStreamTrackEvent) => {
      console.log(`[ViewerAudioPlayer] Track added for ${viewer.id}:`, event.track.kind);
      if (event.track.kind === 'audio') {
        event.track.enabled = true;
        
        // Re-attach and play
        videoElement.srcObject = viewer.stream;
        playAudio();
      }
    };

    const handleTrackRemoved = (event: MediaStreamTrackEvent) => {
      console.log(`[ViewerAudioPlayer] Track removed for ${viewer.id}:`, event.track.kind);
    };

    viewer.stream.addEventListener('addtrack', handleTrackAdded);
    viewer.stream.addEventListener('removetrack', handleTrackRemoved);

    return () => {
      console.log(`[ViewerAudioPlayer] Cleaning up audio for viewer ${viewer.id}`);
      viewer.stream.removeEventListener('addtrack', handleTrackAdded);
      viewer.stream.removeEventListener('removetrack', handleTrackRemoved);
      
      // Clean up track event handlers
      viewer.stream.getAudioTracks().forEach(track => {
        track.onmute = null;
        track.onunmute = null;
        track.onended = null;
      });

      if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
      }
      
      onPlayStateChange?.(false);
      streamIdRef.current = null;
    };
  }, [viewer.id, viewer.stream, playAudio, onPlayStateChange]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={false}
      style={{ display: 'none' }}
      data-viewer-id={viewer.id}
    />
  );
};

export default ViewerAudioPlayer;
