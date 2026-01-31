import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';

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
 * - Triggers user-interaction-based playback on first interaction
 */
export const ViewerAudioPlayer: React.FC<ViewerAudioPlayerProps> = ({ viewerStreams }) => {
  const [playingStreams, setPlayingStreams] = useState<Set<string>>(new Set());
  const [userInteracted, setUserInteracted] = useState(false);
  const pendingPlaybackRef = useRef<Set<string>>(new Set());

  // Filter to only streams with audio tracks
  const streamsWithAudio = useMemo(() => {
    return viewerStreams.filter(v => {
      const audioTracks = v.stream?.getAudioTracks() || [];
      return audioTracks.length > 0;
    });
  }, [viewerStreams]);

  // Log stream composition on every update
  useEffect(() => {
    console.log(`[ViewerAudioPlayer] 🎧 Total streams: ${viewerStreams.length}, with audio: ${streamsWithAudio.length}`);
    
    viewerStreams.forEach((viewer, idx) => {
      const audioTracks = viewer.stream?.getAudioTracks() || [];
      const videoTracks = viewer.stream?.getVideoTracks() || [];
      
      if (audioTracks.length > 0) {
        console.log(`[ViewerAudioPlayer] ✅ Viewer ${idx} (${viewer.id.slice(0,8)}): ${audioTracks.length} audio track(s)`);
        audioTracks.forEach((track, i) => {
          console.log(`  └─ Audio track ${i}: id=${track.id.slice(0,8)}, enabled=${track.enabled}, state=${track.readyState}, muted=${track.muted}`);
        });
      } else {
        console.log(`[ViewerAudioPlayer] ⚠️ Viewer ${idx} (${viewer.id.slice(0,8)}): NO audio tracks (video: ${videoTracks.length})`);
      }
    });
  }, [viewerStreams, streamsWithAudio]);

  // Listen for user interaction to enable audio playback
  useEffect(() => {
    if (userInteracted) return;

    const enablePlayback = () => {
      console.log('[ViewerAudioPlayer] 🖱️ User interaction detected, enabling audio playback');
      setUserInteracted(true);
    };

    // Add multiple event listeners for user interaction
    window.addEventListener('click', enablePlayback, { once: true });
    window.addEventListener('touchstart', enablePlayback, { once: true });
    window.addEventListener('keydown', enablePlayback, { once: true });

    return () => {
      window.removeEventListener('click', enablePlayback);
      window.removeEventListener('touchstart', enablePlayback);
      window.removeEventListener('keydown', enablePlayback);
    };
  }, [userInteracted]);

  const handlePlayStateChange = useCallback((viewerId: string, isPlaying: boolean) => {
    setPlayingStreams(prev => {
      const next = new Set(prev);
      if (isPlaying) {
        next.add(viewerId);
        console.log(`[ViewerAudioPlayer] 🔊 Now playing audio for viewer: ${viewerId.slice(0,8)}`);
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
      data-viewer-count={viewerStreams.length}
      data-audio-count={streamsWithAudio.length}
      data-playing-count={playingStreams.size}
    >
      {/* Only render audio elements for streams that have audio tracks */}
      {streamsWithAudio.map((viewer) => (
        <ViewerAudioElement 
          key={`audio-${viewer.id}-${viewer.stream?.id || 'no-stream'}`} 
          viewer={viewer}
          userInteracted={userInteracted}
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
  userInteracted: boolean;
  onPlayStateChange?: (playing: boolean) => void;
}> = ({ viewer, userInteracted, onPlayStateChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 15; // Increased retries
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

    // If user hasn't interacted yet, queue for later
    if (!userInteracted) {
      console.log(`[ViewerAudioPlayer] ⏳ Waiting for user interaction to play ${viewer.id.slice(0,8)}`);
      return;
    }

    try {
      // Ensure unmuted and full volume
      videoElement.muted = false;
      videoElement.volume = 1.0;
      
      // Check if already playing
      if (!videoElement.paused && !videoElement.ended) {
        console.log(`[ViewerAudioPlayer] ✅ Already playing for ${viewer.id.slice(0,8)}`);
        if (!isPlayingRef.current) {
          isPlayingRef.current = true;
          onPlayStateChange?.(true);
        }
        return;
      }
      
      await videoElement.play();
      console.log(`[ViewerAudioPlayer] ✅ Successfully playing audio for viewer ${viewer.id.slice(0,8)}`);
      isPlayingRef.current = true;
      onPlayStateChange?.(true);
      retryCountRef.current = 0;
    } catch (error: any) {
      console.warn(`[ViewerAudioPlayer] ⚠️ Play failed for ${viewer.id.slice(0,8)}:`, error.name, error.message);
      
      if (!isPlayingRef.current) {
        onPlayStateChange?.(false);
      }
      
      // Retry with exponential backoff
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.min(200 * Math.pow(1.3, retryCountRef.current - 1), 3000);
        console.log(`[ViewerAudioPlayer] 🔄 Retry ${retryCountRef.current}/${maxRetries} in ${delay}ms for ${viewer.id.slice(0,8)}`);
        
        retryTimeoutRef.current = setTimeout(() => {
          if (videoRef.current && videoRef.current.paused) {
            playAudio();
          }
        }, delay);
      } else {
        console.error(`[ViewerAudioPlayer] ❌ Max retries reached for ${viewer.id.slice(0,8)} - audio may require user interaction`);
      }
    }
  }, [viewer.id, userInteracted, onPlayStateChange]);

  // Retry playback when user interaction is detected
  useEffect(() => {
    if (userInteracted && videoRef.current?.paused) {
      console.log(`[ViewerAudioPlayer] 🖱️ User interacted, attempting playback for ${viewer.id.slice(0,8)}`);
      playAudio();
    }
  }, [userInteracted, playAudio, viewer.id]);

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
