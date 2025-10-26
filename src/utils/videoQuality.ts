/**
 * Utility functions for video quality and brightness analysis
 */

/**
 * Analyzes video brightness by sampling frames using Canvas API
 * @param videoElement - The video element to analyze
 * @returns Brightness value between 0-100, or null if analysis fails
 */
export const analyzeVideoBrightness = (videoElement: HTMLVideoElement | null): number | null => {
  if (!videoElement || videoElement.readyState < 2) {
    console.log('Video not ready for brightness analysis');
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!context) {
      console.error('Failed to get canvas context');
      return null;
    }

    // Use smaller canvas for performance
    canvas.width = 160;
    canvas.height = 120;
    
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    let pixelCount = 0;
    
    // Sample every pixel (RGBA format)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate perceived brightness using luminance formula
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
      totalBrightness += brightness;
      pixelCount++;
    }
    
    const averageBrightness = totalBrightness / pixelCount;
    const normalizedBrightness = (averageBrightness / 255) * 100;
    
    console.log(`Video brightness analysis: ${normalizedBrightness.toFixed(1)}%`);
    
    return Math.round(normalizedBrightness);
  } catch (error) {
    console.error('Error analyzing video brightness:', error);
    return null;
  }
};

/**
 * Checks if video track is healthy
 */
export const isVideoTrackHealthy = (track: MediaStreamTrack | null): boolean => {
  if (!track) return false;
  
  const healthy = track.readyState === 'live' && track.enabled && !track.muted;
  
  if (!healthy) {
    console.warn('Video track unhealthy:', {
      readyState: track.readyState,
      enabled: track.enabled,
      muted: track.muted
    });
  }
  
  return healthy;
};

/**
 * Detects device type based on screen size and user agent
 */
export const getDeviceType = (): 'mobile' | 'tablet' | 'laptop' | 'desktop' => {
  const width = window.innerWidth;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  if (width < 768) return 'mobile';
  if (width < 1024) return isTouchDevice ? 'tablet' : 'laptop';
  if (width < 1920) return 'laptop';
  return 'desktop';
};

/**
 * Gets optimal video constraints based on device type
 */
export const getOptimalVideoConstraints = (deviceId?: string, deviceType?: 'mobile' | 'tablet' | 'laptop' | 'desktop') => {
  const device = deviceType || getDeviceType();
  
  // Device-specific resolution settings
  const resolutionMap = {
    mobile: { width: { ideal: 640 }, height: { ideal: 480 } },
    tablet: { width: { ideal: 960 }, height: { ideal: 540 } },
    laptop: { width: { ideal: 1280 }, height: { ideal: 720 } },
    desktop: { width: { ideal: 1920 }, height: { ideal: 1080 } }
  };
  
  // Frame rate adaptation
  const frameRateMap = {
    mobile: { ideal: 24, max: 30 },
    tablet: { ideal: 30, max: 30 },
    laptop: { ideal: 30, max: 60 },
    desktop: { ideal: 30, max: 60 }
  };
  
  const constraints: MediaTrackConstraints = {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    ...resolutionMap[device],
    frameRate: frameRateMap[device],
    facingMode: deviceId ? undefined : 'user'
  };
  
  return constraints;
};
