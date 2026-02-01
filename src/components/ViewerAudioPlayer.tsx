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
 * - Recovers from autoplay restrictions via user interaction
 * - Re-enables muted tracks automatically
 * - Works on mobile and desktop
 */
export const ViewerAudioPlayer: React.FC<ViewerAudioPlayerProps> = ({ viewerStreams }) => {
  const [playingStreams, setPlayingStreams] = useState<Set<string>>(new Set());
  const [userInteracted, setUserInteracted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Filter to only streams with audio tracks
  const streamsWithAudio = useMemo(() => {
    return viewerStreams.filter(v => {
      const audioTracks = v.stream?.getAudioTracks() || [];
      return audioTracks.length > 0;
    });
  }, [viewerStreams]);

  // Log stream composition on every update
  useEffect(() => {
    console.log(`[ViewerAudioPlayer] 🎧 Total: ${viewerStreams.length}, with audio: ${streamsWithAudio.length}`);
    
    streamsWithAudio.forEach((viewer, idx) => {
      const audioTracks = viewer.stream.getAudioTracks();
      audioTracks.forEach((track, i) => {
        console.log(`[ViewerAudioPlayer] ✅ Viewer ${viewer.id.slice(0,8)} audio[${i}]: enabled=${track.enabled}, state=${track.readyState}`);
      });
    });
  }, [viewerStreams, streamsWithAudio]);

  // Listen for user interaction to enable audio playback (autoplay bypass)
  useEffect(() => {
    if (userInteracted) return;

    const enablePlayback = () => {
      console.log('[ViewerAudioPlayer] 🖱️ User interaction detected, unlocking audio');
      setUserInteracted(true);
      
      // Resume audio context if suspended
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(console.error);
      }
    };

    const events = ['click', 'touchstart', 'keydown', 'touchend', 'mousedown'];
    events.forEach(event => {
      window.addEventListener(event, enablePlayback, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, enablePlayback);
      });
    };
  }, [userInteracted]);

  // Initialize AudioContext for reliable playback
  useEffect(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('[ViewerAudioPlayer] AudioContext created:', audioContextRef.current.state);
      } catch (e) {
        console.warn('[ViewerAudioPlayer] AudioContext creation failed:', e);
      }
    }

    return () => {
      audioContextRef.current?.close().catch(console.error);
      audioContextRef.current = null;
    };
  }, []);

  const handlePlayStateChange = useCallback((viewerId: string, isPlaying: boolean) => {
    setPlayingStreams(prev => {
      const next = new Set(prev);
      if (isPlaying) {
        next.add(viewerId);
        console.log(`[ViewerAudioPlayer] 🔊 Now playing: ${viewerId.slice(0,8)}`);
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
      {streamsWithAudio.map((viewer) => (
        <ViewerAudioElement 
          key={`audio-${viewer.id}`} 
          viewer={viewer}
          userInteracted={userInteracted}
          audioContext={audioContextRef.current}
          onPlayStateChange={(playing) => handlePlayStateChange(viewer.id, playing)}
        />
      ))}
    </div>
  );
};

/**
 * Individual audio element for a single viewer with robust playback handling.
 */
/**
 * Individual audio element for a single viewer with enhanced audio processing.
 * Applies gain boosting and ensures crystal-clear playback for the host.
 */
const ViewerAudioElement: React.FC<{ 
  viewer: ViewerStream;
  userInteracted: boolean;
  audioContext: AudioContext | null;
  onPlayStateChange?: (playing: boolean) => void;
}> = ({ viewer, userInteracted, audioContext, onPlayStateChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const localContextRef = useRef<AudioContext | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 20;
  const streamIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  
  // AUDIO GAIN BOOST for viewer clarity (1.5x = 50% louder)
  const VIEWER_GAIN_BOOST = 1.5;
  
  /**
   * Setup Web Audio API processing for enhanced playback quality.
   * Adds gain boost and compression for consistent, clear audio.
   */
  const setupAudioProcessing = useCallback((stream: MediaStream) => {
    try {
      // Create or reuse audio context
      if (!localContextRef.current || localContextRef.current.state === 'closed') {
        localContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 48000,
          latencyHint: 'interactive',
        });
      }
      
      const ctx = localContextRef.current;
      
      // Resume if suspended
      if (ctx.state === 'suspended') {
        ctx.resume().catch(console.error);
      }
      
      // Disconnect previous nodes
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch (e) {}
      }
      
      // Create processing chain
      const source = ctx.createMediaStreamSource(stream);
      
      // Gain node for volume boost
      const gain = ctx.createGain();
      gain.gain.value = VIEWER_GAIN_BOOST;
      
      // Compressor for consistent levels (makes quiet voices louder, prevents clipping)
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -20;   // Start compressing at -20dB
      compressor.knee.value = 10;         // Soft knee for natural sound
      compressor.ratio.value = 3;         // 3:1 compression
      compressor.attack.value = 0.003;    // 3ms attack (fast for voice)
      compressor.release.value = 0.1;     // 100ms release
      
      // Connect: source -> compressor -> gain -> speakers
      source.connect(compressor);
      compressor.connect(gain);
      gain.connect(ctx.destination);
      
      // Store refs
      sourceNodeRef.current = source;
      gainNodeRef.current = gain;
      compressorRef.current = compressor;
      
      console.log(`[ViewerAudioPlayer] 🔊 Audio processing setup for ${viewer.id.slice(0,8)} with ${VIEWER_GAIN_BOOST}x gain`);
      
      return true;
    } catch (error) {
      console.error('[ViewerAudioPlayer] Audio processing setup failed:', error);
      return false;
    }
  }, [viewer.id]);

  // Attempt to play audio with comprehensive retry logic
  const playAudio = useCallback(async () => {
    if (!mountedRef.current) return;
    
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // If user hasn't interacted yet, set up for later play
    if (!userInteracted) {
      console.log(`[ViewerAudioPlayer] ⏳ Queued for user interaction: ${viewer.id.slice(0,8)}`);
      return;
    }

    try {
      // Ensure unmuted and full volume
      videoElement.muted = false;
      videoElement.volume = 1.0;
      
      // Check if already playing
      if (!videoElement.paused && !videoElement.ended) {
        if (!isPlayingRef.current) {
          isPlayingRef.current = true;
          onPlayStateChange?.(true);
        }
        return;
      }
      
      await videoElement.play();
      console.log(`[ViewerAudioPlayer] ✅ Playing audio: ${viewer.id.slice(0,8)}`);
      isPlayingRef.current = true;
      onPlayStateChange?.(true);
      retryCountRef.current = 0;
    } catch (error: any) {
      console.warn(`[ViewerAudioPlayer] ⚠️ Play failed for ${viewer.id.slice(0,8)}:`, error.name);
      
      if (!isPlayingRef.current) {
        onPlayStateChange?.(false);
      }
      
      // Retry with exponential backoff
      if (retryCountRef.current < maxRetries && mountedRef.current) {
        retryCountRef.current++;
        const delay = Math.min(150 * Math.pow(1.2, retryCountRef.current - 1), 2000);
        
        retryTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && videoRef.current?.paused) {
            playAudio();
          }
        }, delay);
      } else {
        console.error(`[ViewerAudioPlayer] ❌ Max retries for ${viewer.id.slice(0,8)}`);
      }
    }
  }, [viewer.id, userInteracted, onPlayStateChange]);

  // Retry playback when user interaction is detected
  useEffect(() => {
    if (userInteracted && videoRef.current?.paused) {
      console.log(`[ViewerAudioPlayer] 🖱️ User interacted, playing ${viewer.id.slice(0,8)}`);
      playAudio();
    }
  }, [userInteracted, playAudio, viewer.id]);

  // Setup and manage stream
  useEffect(() => {
    mountedRef.current = true;
    
    const videoElement = videoRef.current;
    if (!videoElement || !viewer.stream) {
      console.log(`[ViewerAudioPlayer] No element/stream for ${viewer.id}`);
      onPlayStateChange?.(false);
      return;
    }

    // Skip if same stream and already playing
    if (streamIdRef.current === viewer.stream.id && !videoElement.paused) {
      return;
    }
    
    streamIdRef.current = viewer.stream.id;
    isPlayingRef.current = false;
    retryCountRef.current = 0;

    const audioTracks = viewer.stream.getAudioTracks();
    console.log(`[ViewerAudioPlayer] Setup for ${viewer.id.slice(0,8)}:`, {
      streamId: viewer.stream.id,
      audioTracks: audioTracks.length,
      trackStates: audioTracks.map(t => ({ id: t.id.slice(0,8), enabled: t.enabled, state: t.readyState }))
    });

    // Attach stream
    videoElement.srcObject = viewer.stream;

    // Force-enable and monitor all audio tracks
    audioTracks.forEach((track, index) => {
      // Force enable
      track.enabled = true;

      // Monitor mute events
      track.onmute = () => {
        console.warn(`[ViewerAudioPlayer] Track ${index} muted for ${viewer.id.slice(0,8)}, re-enabling...`);
        track.enabled = true;
        if (videoElement.paused) {
          playAudio();
        }
      };

      track.onunmute = () => {
        console.log(`[ViewerAudioPlayer] Track ${index} unmuted for ${viewer.id.slice(0,8)}`);
      };
      
      track.onended = () => {
        console.log(`[ViewerAudioPlayer] Track ${index} ended for ${viewer.id.slice(0,8)}`);
        isPlayingRef.current = false;
        onPlayStateChange?.(false);
      };
    });

    // Setup enhanced audio processing (gain boost + compression)
    setupAudioProcessing(viewer.stream);

    // Start playing (video element as fallback, Web Audio for quality)
    playAudio();

    // Handle dynamically added tracks (viewer enables mic mid-stream)
    const handleTrackAdded = (event: MediaStreamTrackEvent) => {
      console.log(`[ViewerAudioPlayer] Track added for ${viewer.id.slice(0,8)}:`, event.track.kind);
      if (event.track.kind === 'audio') {
        event.track.enabled = true;
        
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
      console.log(`[ViewerAudioPlayer] Track removed for ${viewer.id.slice(0,8)}:`, event.track.kind);
    };

    viewer.stream.addEventListener('addtrack', handleTrackAdded);
    viewer.stream.addEventListener('removetrack', handleTrackRemoved);

    // Cleanup function
    return () => {
      console.log(`[ViewerAudioPlayer] Cleanup for ${viewer.id.slice(0,8)}`);
      mountedRef.current = false;
      
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
      
      // Clean up audio processing nodes
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch (e) {}
        sourceNodeRef.current = null;
      }
      if (gainNodeRef.current) {
        try { gainNodeRef.current.disconnect(); } catch (e) {}
        gainNodeRef.current = null;
      }
      if (compressorRef.current) {
        try { compressorRef.current.disconnect(); } catch (e) {}
        compressorRef.current = null;
      }
      if (localContextRef.current && localContextRef.current.state !== 'closed') {
        localContextRef.current.close().catch(() => {});
        localContextRef.current = null;
      }
      
      isPlayingRef.current = false;
      onPlayStateChange?.(false);
      streamIdRef.current = null;
    };
  }, [viewer.id, viewer.stream, playAudio, onPlayStateChange, audioContext, setupAudioProcessing]);

  // Handle visibility changes (mobile backgrounding)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && videoRef.current?.paused && mountedRef.current) {
        console.log(`[ViewerAudioPlayer] Page visible, resuming ${viewer.id.slice(0,8)}`);
        
        // Re-enable tracks in case they got disabled
        viewer.stream?.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
        
        playAudio();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [viewer.id, viewer.stream, playAudio]);

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
