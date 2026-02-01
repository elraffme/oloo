import { useCallback, useRef } from 'react';

/**
 * Advanced audio quality management for livestream communication.
 * Provides professional-grade audio capture and playback processing
 * similar to Zoom, Discord, and Google Meet.
 */

// Optimal audio constraints for crystal-clear voice communication
export const HIGH_QUALITY_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  // Core voice processing
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  
  // High quality sampling
  sampleRate: { ideal: 48000, min: 44100 },
  sampleSize: { ideal: 16 },
  channelCount: { ideal: 1 }, // Mono for voice (better quality, less bandwidth)
};

// Even higher quality for hosts (they have dedicated connection)
export const HOST_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  ...HIGH_QUALITY_AUDIO_CONSTRAINTS,
  sampleRate: { ideal: 48000 },
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

// Viewer audio constraints (slightly more permissive for mobile compatibility)
export const VIEWER_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: { ideal: 48000, min: 22050 },
  sampleSize: { ideal: 16 },
  channelCount: { ideal: 1 },
};

interface AudioProcessingNodes {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  compressor: DynamicsCompressorNode;
  destination: MediaStreamAudioDestinationNode;
}

/**
 * Hook for enhanced audio quality processing
 */
export const useAudioQuality = () => {
  const processingNodesRef = useRef<Map<string, AudioProcessingNodes>>(new Map());
  const playbackGainNodesRef = useRef<Map<string, GainNode>>(new Map());

  /**
   * Process a microphone stream for enhanced quality output.
   * Applies gain normalization and dynamic compression.
   */
  const enhanceMicrophoneStream = useCallback(async (
    originalStream: MediaStream,
    options?: {
      targetGain?: number; // 1.0 = unity, 1.5 = 50% boost
      enableCompression?: boolean;
    }
  ): Promise<MediaStream> => {
    const { targetGain = 1.3, enableCompression = true } = options || {};
    
    const audioTracks = originalStream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('[AudioQuality] No audio tracks to enhance');
      return originalStream;
    }

    try {
      // Create audio context for processing
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });

      // Resume if suspended (browser autoplay policy)
      if (context.state === 'suspended') {
        await context.resume();
      }

      // Create processing chain
      const source = context.createMediaStreamSource(originalStream);
      
      // Gain node for volume normalization
      const gain = context.createGain();
      gain.gain.value = targetGain;
      
      // Dynamic compressor for consistent levels (prevents clipping and boosts quiet sounds)
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -24;  // Start compressing at -24dB
      compressor.knee.value = 12;        // Soft knee for natural sound
      compressor.ratio.value = 4;        // 4:1 compression ratio
      compressor.attack.value = 0.003;   // 3ms attack (fast for voice)
      compressor.release.value = 0.15;   // 150ms release (smooth)

      // Output destination
      const destination = context.createMediaStreamDestination();

      // Connect the chain
      if (enableCompression) {
        source.connect(compressor);
        compressor.connect(gain);
        gain.connect(destination);
      } else {
        source.connect(gain);
        gain.connect(destination);
      }

      // Store for cleanup
      const streamId = audioTracks[0].id;
      processingNodesRef.current.set(streamId, {
        context,
        source,
        gain,
        compressor,
        destination,
      });

      console.log('[AudioQuality] ✅ Enhanced mic stream created:', {
        gain: targetGain,
        compression: enableCompression,
        sampleRate: context.sampleRate,
        streamId,
      });

      // Combine processed audio with original video (if any)
      const videoTracks = originalStream.getVideoTracks();
      const enhancedStream = new MediaStream([
        ...destination.stream.getAudioTracks(),
        ...videoTracks,
      ]);

      return enhancedStream;
    } catch (error) {
      console.error('[AudioQuality] Failed to enhance stream:', error);
      // Fallback to original stream
      return originalStream;
    }
  }, []);

  /**
   * Create a gain-boosted playback for incoming viewer audio.
   * Use this on the host side to ensure viewers are audible.
   */
  const createPlaybackProcessor = useCallback((
    viewerId: string,
    stream: MediaStream,
    options?: {
      boostGain?: number; // 1.0 = unity, 2.0 = double
    }
  ): { processedStream: MediaStream; setGain: (value: number) => void } | null => {
    const { boostGain = 1.5 } = options || {};
    
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      return null;
    }

    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });

      const source = context.createMediaStreamSource(stream);
      const gain = context.createGain();
      gain.gain.value = boostGain;

      // Soft limiter to prevent clipping at high gains
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.05;

      const destination = context.createMediaStreamDestination();

      source.connect(gain);
      gain.connect(limiter);
      limiter.connect(destination);

      playbackGainNodesRef.current.set(viewerId, gain);

      console.log('[AudioQuality] ✅ Playback processor created for viewer:', viewerId);

      return {
        processedStream: destination.stream,
        setGain: (value: number) => {
          gain.gain.value = value;
        },
      };
    } catch (error) {
      console.error('[AudioQuality] Failed to create playback processor:', error);
      return null;
    }
  }, []);

  /**
   * Adjust playback gain for a specific viewer
   */
  const setViewerPlaybackGain = useCallback((viewerId: string, gain: number) => {
    const gainNode = playbackGainNodesRef.current.get(viewerId);
    if (gainNode) {
      gainNode.gain.value = Math.max(0, Math.min(3, gain)); // Clamp 0-3x
      console.log(`[AudioQuality] Set viewer ${viewerId} gain to ${gain}`);
    }
  }, []);

  /**
   * Clean up processing for a stream
   */
  const cleanupStream = useCallback((streamId: string) => {
    const nodes = processingNodesRef.current.get(streamId);
    if (nodes) {
      try {
        nodes.source.disconnect();
        nodes.gain.disconnect();
        nodes.compressor.disconnect();
        nodes.context.close();
      } catch (e) {
        // Ignore cleanup errors
      }
      processingNodesRef.current.delete(streamId);
    }
    playbackGainNodesRef.current.delete(streamId);
  }, []);

  /**
   * Clean up all processing nodes
   */
  const cleanupAll = useCallback(() => {
    processingNodesRef.current.forEach((nodes, id) => {
      try {
        nodes.source.disconnect();
        nodes.gain.disconnect();
        nodes.compressor.disconnect();
        nodes.context.close();
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    processingNodesRef.current.clear();
    playbackGainNodesRef.current.clear();
  }, []);

  /**
   * Get optimal audio constraints for a specific use case
   */
  const getOptimalConstraints = useCallback((
    role: 'host' | 'viewer',
    deviceType?: 'desktop' | 'mobile'
  ): MediaTrackConstraints => {
    const isMobile = deviceType === 'mobile' || 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (role === 'host') {
      return HOST_AUDIO_CONSTRAINTS;
    }

    // Viewer constraints - slightly relaxed for mobile
    if (isMobile) {
      return {
        ...VIEWER_AUDIO_CONSTRAINTS,
        // More permissive for mobile compatibility
        sampleRate: { ideal: 44100, min: 22050 },
      };
    }

    return VIEWER_AUDIO_CONSTRAINTS;
  }, []);

  return {
    enhanceMicrophoneStream,
    createPlaybackProcessor,
    setViewerPlaybackGain,
    cleanupStream,
    cleanupAll,
    getOptimalConstraints,
    HIGH_QUALITY_AUDIO_CONSTRAINTS,
    HOST_AUDIO_CONSTRAINTS,
    VIEWER_AUDIO_CONSTRAINTS,
  };
};

export default useAudioQuality;
