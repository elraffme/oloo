import React, { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Video, VideoOff, User } from 'lucide-react';
import { cn } from '@/lib/utils';
interface ViewerCamera {
  sessionToken: string;
  stream: MediaStream;
  displayName: string;
  avatarUrl?: string;
}
interface StreamViewer {
  session_id: string;
  viewer_id: string | null;
  viewer_display_name: string;
  is_guest: boolean;
  joined_at: string;
  avatar_url: string;
  camera_enabled: boolean | null;
  camera_stream_active: boolean | null;
}
interface ViewerCameraThumbnailsProps {
  viewerCameras: Map<string, ViewerCamera>;
  allViewers?: StreamViewer[];
  className?: string;
}

// Thumbnail with video feed
const ViewerCameraThumbnail: React.FC<{
  camera: ViewerCamera;
}> = ({
  camera
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !camera.stream) return;

    console.log(`[ViewerCameraThumbnail] Setting up video for ${camera.displayName}`, {
      streamId: camera.stream.id,
      videoTracks: camera.stream.getVideoTracks().length
    });

    videoElement.srcObject = camera.stream;
    videoElement.play().catch(e => console.error('Error playing viewer camera:', e));

    // Listen for new tracks
    const handleTrackAdded = () => {
      videoElement.srcObject = camera.stream;
      videoElement.play().catch(e => console.error('Error replaying on track add:', e));
    };

    camera.stream.addEventListener('addtrack', handleTrackAdded);

    return () => {
      camera.stream.removeEventListener('addtrack', handleTrackAdded);
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [camera.stream, camera.stream.id, camera.displayName]);

  return (
    <Card className="relative overflow-hidden bg-background/95 backdrop-blur-sm border-border/50 w-24 h-24 flex-shrink-0">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={true} // Muted for visual thumbnails - audio handled by ViewerAudioPlayer
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
        <span className="text-xs text-white truncate block">
          {camera.displayName}
        </span>
      </div>
    </Card>
  );
};

// Thumbnail without video (avatar placeholder)
const ViewerPlaceholderThumbnail: React.FC<{
  viewer: StreamViewer;
}> = ({
  viewer
}) => {
  return (
    <Card className="relative overflow-hidden bg-background/95 backdrop-blur-sm border-border/50 w-24 h-24 flex-shrink-0">
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Avatar className="h-12 w-12">
          <AvatarImage src={viewer.avatar_url} />
          <AvatarFallback>
            {viewer.viewer_display_name?.charAt(0)?.toUpperCase() || 'V'}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
        <div className="flex items-center gap-1">
          {viewer.camera_enabled === false && (
            <VideoOff className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-xs text-white truncate">
            {viewer.viewer_display_name}
          </span>
        </div>
      </div>
    </Card>
  );
};
export const ViewerCameraThumbnails: React.FC<ViewerCameraThumbnailsProps> = ({
  viewerCameras,
  allViewers = [],
  className
}) => {
  const camerasArray = Array.from(viewerCameras.values());

  // Get session tokens of viewers with active camera streams
  const activeSessionTokens = new Set(camerasArray.map(c => c.sessionToken));

  // Filter viewers without active camera streams
  const viewersWithoutCameras = allViewers.filter(viewer => !activeSessionTokens.has(viewer.session_id));
  const totalViewers = camerasArray.length + viewersWithoutCameras.length;
  if (totalViewers === 0) {
    return;
  }
  return <Card className={cn("bg-background/95 backdrop-blur-sm border-border/50", className)}>
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              All Viewers
            </span>
          </div>
          <div className="flex items-center gap-2">
            {camerasArray.length > 0 && <Badge variant="secondary" className="h-6 px-2 bg-green-500/20 text-green-400">
                <Video className="h-3 w-3 mr-1" />
                {camerasArray.length}
              </Badge>}
            <Badge variant="secondary" className="h-6 px-2">
              {totalViewers}
            </Badge>
          </div>
        </div>
      </div>

      <ScrollArea className="h-full max-h-[500px]">
        <div className="p-3 flex flex-wrap gap-2">
          {/* Render viewers with active camera streams */}
          {camerasArray.map((camera) => (
            <ViewerCameraThumbnail key={camera.sessionToken} camera={camera} />
          ))}
          
          {/* Render viewers without camera streams (placeholder) */}
          {viewersWithoutCameras.map((viewer) => (
            <ViewerPlaceholderThumbnail key={viewer.session_id} viewer={viewer} />
          ))}
        </div>
      </ScrollArea>
    </Card>;
};