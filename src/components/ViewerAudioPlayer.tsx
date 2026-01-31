import React, { useEffect, useRef } from 'react';

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
 */
export const ViewerAudioPlayer: React.FC<ViewerAudioPlayerProps> = ({ viewerStreams }) => {
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
        <ViewerAudioElement key={viewer.id} viewer={viewer} />
      ))}
    </div>
  );
};

/**
 * Individual audio element for a single viewer stream.
 * Uses video element to properly handle MediaStream with both audio and video tracks.
 */
const ViewerAudioElement: React.FC<{ viewer: ViewerStream }> = ({ viewer }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !viewer.stream) {
      console.log(`[ViewerAudioPlayer] No element or stream for viewer ${viewer.id}`);
      return;
    }

    console.log(`[ViewerAudioPlayer] Setting up audio for viewer ${viewer.id}`, {
      streamId: viewer.stream.id,
      audioTracks: viewer.stream.getAudioTracks().length,
      videoTracks: viewer.stream.getVideoTracks().length
    });

    // Attach the stream to the video element
    videoElement.srcObject = viewer.stream;

    // Force-enable all audio tracks
    viewer.stream.getAudioTracks().forEach((track, index) => {
      console.log(`[ViewerAudioPlayer] Audio track ${index} for ${viewer.id}:`, {
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      });
      
      // Force enable if disabled
      if (!track.enabled) {
        track.enabled = true;
        console.log(`[ViewerAudioPlayer] Force-enabled audio track ${index} for ${viewer.id}`);
      }

      // Handle track being muted by system
      track.onmute = () => {
        console.warn(`[ViewerAudioPlayer] Audio track ${index} muted for ${viewer.id}, re-enabling...`);
        track.enabled = true;
      };

      track.onunmute = () => {
        console.log(`[ViewerAudioPlayer] Audio track ${index} unmuted for ${viewer.id}`);
      };
    });

    // Play the audio
    const playAudio = async () => {
      try {
        videoElement.muted = false;
        videoElement.volume = 1.0;
        await videoElement.play();
        console.log(`[ViewerAudioPlayer] ✅ Playing audio for viewer ${viewer.id}`);
      } catch (error) {
        console.error(`[ViewerAudioPlayer] ❌ Failed to play audio for ${viewer.id}:`, error);
        
        // Retry with user interaction workaround for autoplay policy
        const retryPlay = () => {
          videoElement.play().catch(e => 
            console.error(`[ViewerAudioPlayer] Retry play failed for ${viewer.id}:`, e)
          );
        };
        
        // Try again after a short delay
        setTimeout(retryPlay, 500);
      }
    };

    playAudio();

    // Listen for new tracks being added
    const handleTrackAdded = (event: MediaStreamTrackEvent) => {
      console.log(`[ViewerAudioPlayer] Track added for ${viewer.id}:`, event.track.kind);
      if (event.track.kind === 'audio') {
        event.track.enabled = true;
        playAudio();
      }
    };

    viewer.stream.addEventListener('addtrack', handleTrackAdded);

    return () => {
      console.log(`[ViewerAudioPlayer] Cleaning up audio for viewer ${viewer.id}`);
      viewer.stream.removeEventListener('addtrack', handleTrackAdded);
      
      // Clean up track event handlers
      viewer.stream.getAudioTracks().forEach(track => {
        track.onmute = null;
        track.onunmute = null;
      });

      if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
      }
    };
  }, [viewer.id, viewer.stream, viewer.stream.id]);

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
