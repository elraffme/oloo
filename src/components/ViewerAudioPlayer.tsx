import React, { useEffect, useRef, useCallback, useState } from 'react';

interface ViewerStream {
  id: string;
  stream: MediaStream;
}

interface ViewerAudioPlayerProps {
  viewerStreams: ViewerStream[];
}

/**
 * CRITICAL COMPONENT: Ensures the host can hear all viewer audio.
 * 
 * This component renders hidden video elements for each viewer stream
 * and manages audio playback with comprehensive error recovery.
 * 
 * Key features:
 * - Plays audio independently of visual layout
 * - Handles dynamic viewer join/leave
 * - Recovers from autoplay restrictions
 * - Re-enables muted tracks
 * - Works on mobile and desktop
 */
export const ViewerAudioPlayer: React.FC<ViewerAudioPlayerProps> = ({ viewerStreams }) => {
  const [playingStreams, setPlayingStreams] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log(`[ViewerAudioPlayer] Rendering for ${viewerStreams.length} viewer stream(s)`);
    viewerStreams.forEach((viewer, idx) => {
      const audioTracks = viewer.stream?.getAudioTracks() || [];
      const videoTracks = viewer.stream?.getVideoTracks() || [];
      console.log(`[ViewerAudioPlayer] Viewer ${idx}: id=${viewer.id}, audio=${audioTracks.length}, video=${videoTracks.length}`);
      
      // Log audio track details
      audioTracks.forEach((track, i) => {
        console.log(`  Audio track ${i}: enabled=${track.enabled}, state=${track.readyState}, muted=${track.muted}`);
      });
    });
  }, [viewerStreams]);

  const handlePlayStateChange = useCallback((viewerId: string, isPlaying: boolean) => {
    setPlayingStreams(prev => {
      const next = new Set(prev);
      if (isPlaying) {
        next.add(viewerId);
      } else {
        next.delete(viewerId);
      }
      return next;
    });
  }, []);

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
          key={`audio-${viewer.id}-${viewer.stream?.id || 'no-stream'}`} 
          viewer={viewer}
          onPlayStateChange={(playing) => handlePlayStateChange(viewer.id, playing)}
        />
      ))}
    </div>
  );
};

/**
 * Individual audio element for a single viewer.
 * Uses video element to properly handle MediaStream with both audio and video tracks.
 */
const ViewerAudioElement: React.FC<{ 
  viewer: ViewerStream;
  onPlayStateChange?: (playing: boolean) => void;
}> = ({ viewer, onPlayStateChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 10;
  const streamIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Attempt to play audio with retry logic
  const playAudio = useCallback(async () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    try {
      // Ensure unmuted and full volume
      videoElement.muted = false;
      videoElement.volume = 1.0;
      
      // Check if already playing
      if (!videoElement.paused && !videoElement.ended) {
        console.log(`[ViewerAudioPlayer] ✅ Already playing for ${viewer.id}`);
        if (!isPlayingRef.current) {
          isPlayingRef.current = true;
          onPlayStateChange?.(true);
        }
        return;
      }
      
      await videoElement.play();
      console.log(`[ViewerAudioPlayer] ✅ Playing audio for ${viewer.id}`);
      isPlayingRef.current = true;
      onPlayStateChange?.(true);
      retryCountRef.current = 0;
    } catch (error: any) {
      console.warn(`[ViewerAudioPlayer] ⚠️ Play failed for ${viewer.id}:`, error.name);
      
      if (!isPlayingRef.current) {
        onPlayStateChange?.(false);
      }
      
      // Retry with exponential backoff
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.min(300 * Math.pow(1.5, retryCountRef.current - 1), 5000);
        console.log(`[ViewerAudioPlayer] Retry ${retryCountRef.current}/${maxRetries} in ${delay}ms for ${viewer.id}`);
        
        retryTimeoutRef.current = setTimeout(() => {
          if (videoRef.current && videoRef.current.paused) {
            playAudio();
          }
        }, delay);
      } else {
        console.error(`[ViewerAudioPlayer] ❌ Max retries reached for ${viewer.id}`);
      }
    }
  }, [viewer.id, onPlayStateChange]);

  // Setup and manage stream
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !viewer.stream) {
      console.log(`[ViewerAudioPlayer] No element or stream for ${viewer.id}`);
      onPlayStateChange?.(false);
      return;
    }

    // Skip if same stream (prevent unnecessary re-attachments)
    if (streamIdRef.current === viewer.stream.id && !videoElement.paused) {
      return;
    }
    
    streamIdRef.current = viewer.stream.id;
    isPlayingRef.current = false;
    retryCountRef.current = 0;

    console.log(`[ViewerAudioPlayer] Setting up audio for ${viewer.id}`, {
      streamId: viewer.stream.id,
      audioTracks: viewer.stream.getAudioTracks().length,
      videoTracks: viewer.stream.getVideoTracks().length
    });

    // Attach stream
    videoElement.srcObject = viewer.stream;

    // Force-enable and monitor all audio tracks
    const audioTracks = viewer.stream.getAudioTracks();
    audioTracks.forEach((track, index) => {
      // Force enable
      if (!track.enabled) {
        track.enabled = true;
        console.log(`[ViewerAudioPlayer] Force-enabled track ${index} for ${viewer.id}`);
      }

      // Monitor mute events
      track.onmute = () => {
        console.warn(`[ViewerAudioPlayer] Track ${index} muted for ${viewer.id}, re-enabling...`);
        track.enabled = true;
        // Retry play if needed
        if (videoElement.paused) {
          playAudio();
        }
      };

      track.onunmute = () => {
        console.log(`[ViewerAudioPlayer] Track ${index} unmuted for ${viewer.id}`);
      };
      
      track.onended = () => {
        console.log(`[ViewerAudioPlayer] Track ${index} ended for ${viewer.id}`);
        isPlayingRef.current = false;
        onPlayStateChange?.(false);
      };
    });

    // Start playing
    playAudio();

    // Handle dynamically added tracks
    const handleTrackAdded = (event: MediaStreamTrackEvent) => {
      console.log(`[ViewerAudioPlayer] Track added for ${viewer.id}:`, event.track.kind);
      if (event.track.kind === 'audio') {
        event.track.enabled = true;
        
        // Setup monitoring
        event.track.onmute = () => {
          event.track.enabled = true;
          if (videoElement.paused) playAudio();
        };
        
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

    // Cleanup function
    return () => {
      console.log(`[ViewerAudioPlayer] Cleaning up for ${viewer.id}`);
      
      // Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      // Remove event listeners
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
      
      isPlayingRef.current = false;
      onPlayStateChange?.(false);
      streamIdRef.current = null;
    };
  }, [viewer.id, viewer.stream, playAudio, onPlayStateChange]);

  // Handle visibility changes (mobile backgrounding)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && videoRef.current?.paused) {
        console.log(`[ViewerAudioPlayer] Page visible, resuming audio for ${viewer.id}`);
        playAudio();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [viewer.id, playAudio]);

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
