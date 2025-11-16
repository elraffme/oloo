import { useState } from 'react';

export type DiagnosticStep = 'idle' | 'permissions' | 'resolution' | 'capture' | 'complete';

export interface DiagnosticResult {
  step: DiagnosticStep;
  status: 'pending' | 'success' | 'warning' | 'error';
  message: string;
  suggestion?: string;
  details?: any;
}

export const useCameraDiagnostics = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [currentStep, setCurrentStep] = useState<DiagnosticStep>('idle');

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => [...prev, result]);
  };

  const testPermissions = async (): Promise<DiagnosticResult> => {
    setCurrentStep('permissions');
    
    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
          step: 'permissions',
          status: 'error',
          message: 'Camera API not available',
          suggestion: 'Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Safari.'
        };
      }

      // Test camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      // Clean up
      stream.getTracks().forEach(track => track.stop());

      return {
        step: 'permissions',
        status: 'success',
        message: `Camera and microphone access granted`,
        details: {
          videoDevice: videoTracks[0]?.label || 'Unknown camera',
          audioDevice: audioTracks[0]?.label || 'Unknown microphone'
        }
      };
    } catch (error: any) {
      let message = 'Permission check failed';
      let suggestion = 'Please allow camera and microphone access when prompted.';

      if (error.name === 'NotAllowedError') {
        message = 'Camera permission denied';
        suggestion = 'Click the camera icon in your browser\'s address bar and allow camera access. Then refresh the page.';
      } else if (error.name === 'NotFoundError') {
        message = 'No camera detected';
        suggestion = 'Make sure your camera is connected and not being used by another application.';
      } else if (error.name === 'NotReadableError') {
        message = 'Camera is in use';
        suggestion = 'Close other applications that might be using your camera (Zoom, Teams, Skype, etc.) and try again.';
      }

      return {
        step: 'permissions',
        status: 'error',
        message,
        suggestion,
        details: { error: error.name }
      };
    }
  };

  const testResolutions = async (): Promise<DiagnosticResult> => {
    setCurrentStep('resolution');
    
    const resolutions = [
      { name: '1080p', width: 1920, height: 1080 },
      { name: '720p', width: 1280, height: 720 },
      { name: '480p', width: 640, height: 480 }
    ];

    const supportedResolutions: string[] = [];
    let highestResolution = { name: 'Unknown', width: 0, height: 0 };

    for (const res of resolutions) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: res.width },
            height: { ideal: res.height }
          }
        });

        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        // Check if we got close to the requested resolution
        if (settings.width && settings.width >= res.width * 0.9) {
          supportedResolutions.push(res.name);
          if (res.width > highestResolution.width) {
            highestResolution = { ...res, width: settings.width, height: settings.height || 0 };
          }
        }

        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        // Resolution not supported, continue
      }
    }

    if (supportedResolutions.length === 0) {
      return {
        step: 'resolution',
        status: 'error',
        message: 'Could not determine camera capabilities',
        suggestion: 'Your camera may not support standard resolutions. Try using a different camera.'
      };
    }

    const status = supportedResolutions.includes('1080p') ? 'success' : 
                   supportedResolutions.includes('720p') ? 'warning' : 'error';

    return {
      step: 'resolution',
      status,
      message: `Camera supports: ${supportedResolutions.join(', ')}`,
      suggestion: status === 'warning' 
        ? 'Your camera supports up to 720p. This is good for most streams.'
        : status === 'error'
        ? 'Your camera only supports 480p. Consider upgrading your camera for better quality.'
        : undefined,
      details: {
        supported: supportedResolutions,
        highest: highestResolution
      }
    };
  };

  const testCapture = async (): Promise<DiagnosticResult> => {
    setCurrentStep('capture');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });

      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();

      // Wait a bit for camera to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!videoTrack.enabled || videoTrack.readyState !== 'live') {
        stream.getTracks().forEach(track => track.stop());
        return {
          step: 'capture',
          status: 'error',
          message: 'Camera not capturing video',
          suggestion: 'Your camera is connected but not producing video. Try restarting your browser or computer.'
        };
      }

      if (settings.width === 0 || settings.height === 0) {
        stream.getTracks().forEach(track => track.stop());
        return {
          step: 'capture',
          status: 'error',
          message: 'Camera producing blank video',
          suggestion: 'Your camera is not capturing frames. Check if the camera lens is covered or try a different camera.'
        };
      }

      const frameRate = settings.frameRate || 30;
      stream.getTracks().forEach(track => track.stop());

      return {
        step: 'capture',
        status: frameRate >= 25 ? 'success' : 'warning',
        message: `Camera capturing at ${settings.width}x${settings.height} @ ${frameRate}fps`,
        suggestion: frameRate < 25 
          ? 'Low frame rate detected. Close other applications to improve performance.'
          : undefined,
        details: settings
      };
    } catch (error: any) {
      return {
        step: 'capture',
        status: 'error',
        message: 'Failed to test video capture',
        suggestion: 'Could not verify camera is working properly. Try restarting your browser.',
        details: { error: error.message }
      };
    }
  };

  const runFullDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    setCurrentStep('permissions');

    try {
      // Step 1: Permissions
      const permResult = await testPermissions();
      addResult(permResult);
      
      if (permResult.status === 'error') {
        setCurrentStep('complete');
        setIsRunning(false);
        return;
      }

      // Step 2: Resolution
      const resResult = await testResolutions();
      addResult(resResult);

      // Step 3: Capture
      const captureResult = await testCapture();
      addResult(captureResult);

      setCurrentStep('complete');
    } catch (error) {
      console.error('Diagnostics failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const reset = () => {
    setResults([]);
    setCurrentStep('idle');
    setIsRunning(false);
  };

  return {
    isRunning,
    results,
    currentStep,
    runFullDiagnostics,
    reset
  };
};
