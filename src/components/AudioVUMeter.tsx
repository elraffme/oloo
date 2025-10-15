import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface AudioVUMeterProps {
  stream: MediaStream | null;
  isEnabled: boolean;
}

export const AudioVUMeter: React.FC<AudioVUMeterProps> = ({ stream, isEnabled }) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [noInputWarning, setNoInputWarning] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const lowLevelTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!stream || !isEnabled) {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (lowLevelTimerRef.current) {
        clearTimeout(lowLevelTimerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setAudioLevel(0);
      setNoInputWarning(false);
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      setNoInputWarning(true);
      return;
    }

    // Create audio context and analyser
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let lowLevelCount = 0;

    const updateLevel = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average level
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const normalizedLevel = Math.min(100, (average / 255) * 100);
      
      setAudioLevel(normalizedLevel);

      // Check for low input
      if (normalizedLevel < 5) {
        lowLevelCount++;
        if (lowLevelCount > 120) { // ~5 seconds at 24fps
          setNoInputWarning(true);
        }
      } else {
        lowLevelCount = 0;
        setNoInputWarning(false);
      }

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream, isEnabled]);

  if (!isEnabled) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Audio Input Level</span>
        {noInputWarning && (
          <Badge variant="destructive" className="text-xs flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            No input detected
          </Badge>
        )}
      </div>
      
      {/* VU Meter Bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full transition-all duration-100 rounded-full"
          style={{ 
            width: `${audioLevel}%`,
            backgroundColor: audioLevel < 20 ? 'hsl(var(--destructive))' : 
                           audioLevel < 50 ? 'hsl(var(--warning) / 0.8)' : 
                           'hsl(var(--success) / 0.8)'
          }}
        />
      </div>
      
      {noInputWarning && (
        <p className="text-xs text-destructive">
          Check your microphone connection and permissions
        </p>
      )}
    </div>
  );
};
