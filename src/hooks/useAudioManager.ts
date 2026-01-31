import { useCallback, useRef, useState, useEffect } from 'react';

export interface AudioManagerState {
  hasPermission: boolean;
  isRequesting: boolean;
  isEnabled: boolean;
  trackState: 'none' | 'live' | 'ended' | 'muted';
  error: string | null;
}

export interface AudioTrackInfo {
  label: string;
  enabled: boolean;
  readyState: string;
  muted: boolean;
  id: string;
}

/**
 * Comprehensive audio manager for livestream microphone handling
 * Handles permissions, track lifecycle, and state synchronization
 */
export const useAudioManager = () => {
  const [state, setState] = useState<AudioManagerState>({
    hasPermission: false,
    isRequesting: false,
    isEnabled: false,
    trackState: 'none',
    error: null,
  });

  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Check microphone permission status
   * Safari may not support this, so we handle gracefully
   */
  const checkPermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    try {
      // Modern browsers with Permissions API
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log('🎤 Mic permission status:', result.state);
        return result.state as 'granted' | 'denied' | 'prompt';
      }
    } catch (error) {
      // Safari doesn't support permissions.query for microphone
      console.log('🎤 Permissions API not supported, will prompt user');
    }
    return 'prompt';
  }, []);

  /**
   * Request microphone access with optimal audio constraints
   * MUST be called from a user gesture (click/tap)
   */
  const requestMicrophoneAccess = useCallback(async (): Promise<MediaStream | null> => {
    console.log('🎤 Requesting microphone access...');
    
    setState(prev => ({ ...prev, isRequesting: true, error: null }));

    try {
      // Check permission first
      const permissionState = await checkPermission();
      if (permissionState === 'denied') {
        const error = 'Microphone access denied. Please enable in browser settings.';
        console.error('❌', error);
        setState(prev => ({ ...prev, isRequesting: false, hasPermission: false, error }));
        return null;
      }

      // Request audio stream with optimized constraints for real-time communication
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
        },
      });

      const audioTrack = stream.getAudioTracks()[0];
      
      if (!audioTrack) {
        const error = 'No audio track acquired from microphone';
        console.error('❌', error);
        setState(prev => ({ ...prev, isRequesting: false, error }));
        return null;
      }

      // Ensure track is enabled
      audioTrack.enabled = true;

      // Store references
      audioTrackRef.current = audioTrack;
      streamRef.current = stream;

      // Setup track event listeners for lifecycle management
      audioTrack.onended = () => {
        console.log('🎤 Audio track ended');
        setState(prev => ({ ...prev, trackState: 'ended', isEnabled: false }));
      };

      audioTrack.onmute = () => {
        console.log('🎤 Audio track muted (by system)');
        setState(prev => ({ ...prev, trackState: 'muted' }));
      };

      audioTrack.onunmute = () => {
        console.log('🎤 Audio track unmuted (by system)');
        if (audioTrack.readyState === 'live') {
          setState(prev => ({ ...prev, trackState: 'live' }));
        }
      };

      console.log('✅ Microphone access granted:', {
        label: audioTrack.label,
        enabled: audioTrack.enabled,
        readyState: audioTrack.readyState,
        muted: audioTrack.muted,
      });

      setState({
        hasPermission: true,
        isRequesting: false,
        isEnabled: true,
        trackState: audioTrack.readyState === 'live' ? 'live' : 'ended',
        error: null,
      });

      return stream;
    } catch (error: any) {
      let errorMessage = 'Failed to access microphone';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please allow access in your browser.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microphone is in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Microphone does not meet the required constraints.';
      }

      console.error('❌ Microphone error:', error.name, error.message);
      
      setState(prev => ({
        ...prev,
        isRequesting: false,
        hasPermission: false,
        error: errorMessage,
      }));

      return null;
    }
  }, [checkPermission]);

  /**
   * Get current audio track info for debugging
   */
  const getTrackInfo = useCallback((): AudioTrackInfo | null => {
    const track = audioTrackRef.current;
    if (!track) return null;

    return {
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
      muted: track.muted,
    };
  }, []);

  /**
   * Enable/disable the audio track (mute/unmute)
   */
  const setTrackEnabled = useCallback((enabled: boolean) => {
    const track = audioTrackRef.current;
    if (!track) {
      console.warn('⚠️ No audio track to enable/disable');
      return false;
    }

    if (track.readyState !== 'live') {
      console.warn('⚠️ Audio track not live, cannot toggle:', track.readyState);
      return false;
    }

    track.enabled = enabled;
    console.log(`🎤 Audio track ${enabled ? 'enabled' : 'disabled'}:`, {
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
    });

    setState(prev => ({
      ...prev,
      isEnabled: enabled,
      trackState: enabled ? 'live' : 'muted',
    }));

    return true;
  }, []);

  /**
   * Toggle audio track enabled state
   */
  const toggleTrack = useCallback(() => {
    const track = audioTrackRef.current;
    if (!track) return false;
    return setTrackEnabled(!track.enabled);
  }, [setTrackEnabled]);

  /**
   * Completely stop and destroy audio track
   * IMPORTANT: Call this before acquiring new tracks or on cleanup
   */
  const destroyTrack = useCallback(() => {
    console.log('🎤 Destroying audio track...');
    
    const track = audioTrackRef.current;
    if (track) {
      track.onended = null;
      track.onmute = null;
      track.onunmute = null;
      track.stop();
      console.log('✅ Audio track stopped');
    }

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    audioTrackRef.current = null;
    streamRef.current = null;

    setState({
      hasPermission: false,
      isRequesting: false,
      isEnabled: false,
      trackState: 'none',
      error: null,
    });
  }, []);

  /**
   * Verify audio track is ready for production to SFU
   */
  const verifyTrackReady = useCallback((): boolean => {
    const track = audioTrackRef.current;
    
    if (!track) {
      console.warn('⚠️ No audio track available');
      return false;
    }

    if (track.readyState !== 'live') {
      console.warn('⚠️ Audio track not live:', track.readyState);
      return false;
    }

    if (!track.enabled) {
      console.warn('⚠️ Audio track is disabled');
      return false;
    }

    console.log('✅ Audio track verified and ready for production:', {
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
    });

    return true;
  }, []);

  /**
   * Get the current audio track for SFU production
   */
  const getTrack = useCallback((): MediaStreamTrack | null => {
    return audioTrackRef.current;
  }, []);

  /**
   * Get the current audio stream
   */
  const getStream = useCallback((): MediaStream | null => {
    return streamRef.current;
  }, []);

  /**
   * Attach an external audio track (e.g., from combined stream)
   */
  const attachTrack = useCallback((track: MediaStreamTrack, stream?: MediaStream) => {
    console.log('🎤 Attaching external audio track:', {
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      readyState: track.readyState,
    });

    // Clean up old track first
    if (audioTrackRef.current && audioTrackRef.current !== track) {
      audioTrackRef.current.onended = null;
      audioTrackRef.current.onmute = null;
      audioTrackRef.current.onunmute = null;
    }

    audioTrackRef.current = track;
    if (stream) {
      streamRef.current = stream;
    }

    // Setup event listeners
    track.onended = () => {
      console.log('🎤 Attached audio track ended');
      setState(prev => ({ ...prev, trackState: 'ended', isEnabled: false }));
    };

    track.onmute = () => {
      console.log('🎤 Attached audio track muted');
      setState(prev => ({ ...prev, trackState: 'muted' }));
    };

    track.onunmute = () => {
      console.log('🎤 Attached audio track unmuted');
      if (track.readyState === 'live') {
        setState(prev => ({ ...prev, trackState: 'live' }));
      }
    };

    setState({
      hasPermission: true,
      isRequesting: false,
      isEnabled: track.enabled,
      trackState: track.readyState === 'live' ? (track.enabled ? 'live' : 'muted') : 'ended',
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyTrack();
    };
  }, [destroyTrack]);

  return {
    state,
    checkPermission,
    requestMicrophoneAccess,
    getTrackInfo,
    setTrackEnabled,
    toggleTrack,
    destroyTrack,
    verifyTrackReady,
    getTrack,
    getStream,
    attachTrack,
  };
};
