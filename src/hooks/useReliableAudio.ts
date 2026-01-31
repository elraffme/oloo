import { useCallback, useRef, useState, useEffect } from 'react';

/**
 * Reliable audio manager for two-way livestream communication.
 * Handles audio track acquisition, production, and playback with
 * comprehensive error recovery for mobile and desktop.
 */

export interface AudioState {
  hasPermission: boolean;
  isAcquiring: boolean;
  isPublished: boolean;
  trackState: 'none' | 'acquiring' | 'live' | 'ended' | 'error';
  errorMessage: string | null;
}

export interface AudioTrack {
  track: MediaStreamTrack;
  stream: MediaStream;
}

/**
 * Hook for managing reliable audio acquisition and publishing
 */
export const useReliableAudio = () => {
  const [state, setState] = useState<AudioState>({
    hasPermission: false,
    isAcquiring: false,
    isPublished: false,
    trackState: 'none',
    errorMessage: null,
  });

  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  /**
   * Acquire microphone with optimal settings for real-time communication
   */
  const acquireMicrophone = useCallback(async (): Promise<AudioTrack | null> => {
    console.log('🎤 [ReliableAudio] Acquiring microphone...');
    
    setState(prev => ({ ...prev, isAcquiring: true, trackState: 'acquiring', errorMessage: null }));

    try {
      // Optimal constraints for real-time voice
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
        },
      });

      // Wait for track stabilization (critical for mobile)
      await new Promise(resolve => setTimeout(resolve, 100));

      const track = stream.getAudioTracks()[0];
      if (!track) {
        throw new Error('No audio track acquired');
      }

      // Force enable and verify
      track.enabled = true;
      
      // Wait another tick
      await new Promise(resolve => setTimeout(resolve, 50));

      if (track.readyState !== 'live') {
        console.error('❌ [ReliableAudio] Track not live after acquisition:', track.readyState);
        throw new Error('Audio track not in live state');
      }

      // Setup event listeners for lifecycle management
      track.onended = () => {
        console.log('🎤 [ReliableAudio] Track ended');
        setState(prev => ({ ...prev, trackState: 'ended', isPublished: false }));
      };

      track.onmute = () => {
        console.log('🔇 [ReliableAudio] Track muted by system');
        // Re-enable on system mute (common on mobile)
        setTimeout(() => {
          if (track.readyState === 'live') {
            track.enabled = true;
            console.log('🔊 [ReliableAudio] Re-enabled after system mute');
          }
        }, 100);
      };

      track.onunmute = () => {
        console.log('🔊 [ReliableAudio] Track unmuted');
      };

      audioTrackRef.current = track;
      audioStreamRef.current = stream;

      console.log('✅ [ReliableAudio] Microphone acquired:', {
        id: track.id,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
      });

      setState({
        hasPermission: true,
        isAcquiring: false,
        isPublished: false,
        trackState: 'live',
        errorMessage: null,
      });

      return { track, stream };
    } catch (error: any) {
      let errorMessage = 'Failed to access microphone';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone permission denied';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microphone in use by another app';
      }

      console.error('❌ [ReliableAudio] Acquisition failed:', error.name, error.message);

      setState({
        hasPermission: false,
        isAcquiring: false,
        isPublished: false,
        trackState: 'error',
        errorMessage,
      });

      return null;
    }
  }, []);

  /**
   * Toggle mute state on the current track
   */
  const toggleMute = useCallback((muted?: boolean): boolean => {
    const track = audioTrackRef.current;
    if (!track || track.readyState !== 'live') {
      console.warn('⚠️ [ReliableAudio] No live track to toggle');
      return false;
    }

    const newEnabledState = muted !== undefined ? !muted : !track.enabled;
    track.enabled = newEnabledState;
    
    console.log(`🎤 [ReliableAudio] Track ${newEnabledState ? 'UNMUTED' : 'MUTED'}`);
    return true;
  }, []);

  /**
   * Get the current audio track
   */
  const getTrack = useCallback((): MediaStreamTrack | null => {
    return audioTrackRef.current;
  }, []);

  /**
   * Get the current audio stream
   */
  const getStream = useCallback((): MediaStream | null => {
    return audioStreamRef.current;
  }, []);

  /**
   * Verify track is ready for production
   */
  const verifyReady = useCallback((): boolean => {
    const track = audioTrackRef.current;
    if (!track) return false;
    if (track.readyState !== 'live') return false;
    if (!track.enabled) {
      track.enabled = true;
    }
    return true;
  }, []);

  /**
   * Mark track as published
   */
  const markPublished = useCallback(() => {
    setState(prev => ({ ...prev, isPublished: true }));
  }, []);

  /**
   * Cleanup and release resources
   */
  const cleanup = useCallback(() => {
    console.log('🧹 [ReliableAudio] Cleaning up...');

    const track = audioTrackRef.current;
    if (track) {
      track.onended = null;
      track.onmute = null;
      track.onunmute = null;
      track.stop();
    }

    const stream = audioStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    audioTrackRef.current = null;
    audioStreamRef.current = null;
    retryCountRef.current = 0;

    setState({
      hasPermission: false,
      isAcquiring: false,
      isPublished: false,
      trackState: 'none',
      errorMessage: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    acquireMicrophone,
    toggleMute,
    getTrack,
    getStream,
    verifyReady,
    markPublished,
    cleanup,
  };
};

/**
 * Hook for reliable audio playback from incoming streams
 */
export const useAudioPlayback = () => {
  const audioElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [activeStreams, setActiveStreams] = useState<Set<string>>(new Set());

  /**
   * Start playing audio from a stream
   */
  const playStream = useCallback(async (streamId: string, stream: MediaStream): Promise<boolean> => {
    console.log(`🔊 [AudioPlayback] Playing stream: ${streamId}`);

    // Check for audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn(`⚠️ [AudioPlayback] No audio tracks in stream ${streamId}`);
      return false;
    }

    // Force enable all audio tracks
    audioTracks.forEach(track => {
      track.enabled = true;
    });

    // Get or create audio element
    let audioEl = audioElementsRef.current.get(streamId);
    if (!audioEl) {
      audioEl = document.createElement('video');
      audioEl.style.display = 'none';
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      document.body.appendChild(audioEl);
      audioElementsRef.current.set(streamId, audioEl);
    }

    // Attach stream
    audioEl.srcObject = stream;
    audioEl.muted = false;
    audioEl.volume = 1.0;

    // Play with retry
    const playWithRetry = async (attempts = 0): Promise<boolean> => {
      try {
        await audioEl!.play();
        console.log(`✅ [AudioPlayback] Playing ${streamId}`);
        setActiveStreams(prev => new Set([...prev, streamId]));
        return true;
      } catch (error: any) {
        console.warn(`⚠️ [AudioPlayback] Play failed for ${streamId}:`, error.name);
        
        if (attempts < 5) {
          // Exponential backoff retry
          await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempts)));
          return playWithRetry(attempts + 1);
        }
        return false;
      }
    };

    return playWithRetry();
  }, []);

  /**
   * Stop playing a specific stream
   */
  const stopStream = useCallback((streamId: string) => {
    const audioEl = audioElementsRef.current.get(streamId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      audioElementsRef.current.delete(streamId);
    }
    setActiveStreams(prev => {
      const next = new Set(prev);
      next.delete(streamId);
      return next;
    });
  }, []);

  /**
   * Stop all streams
   */
  const stopAll = useCallback(() => {
    audioElementsRef.current.forEach((el, id) => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    audioElementsRef.current.clear();
    setActiveStreams(new Set());
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  return {
    activeStreams,
    playStream,
    stopStream,
    stopAll,
  };
};

export default useReliableAudio;
