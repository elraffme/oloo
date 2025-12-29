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
    if (videoRef.current && camera.stream) {
      videoRef.current.srcObject = camera.stream;
      videoRef.current.play().catch(e => console.error('Error playing viewer camera:', e));
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [camera.stream]);
  return <Card className="relative overflow-hidden bg-background/95 backdrop-blur-sm border-border/50">
      
    </Card>;
};

// Thumbnail without video (avatar placeholder)
const ViewerPlaceholderThumbnail: React.FC<{
  viewer: StreamViewer;
}> = ({
  viewer
}) => {
  return <Card className="relative overflow-hidden bg-background/95 backdrop-blur-sm border-border/50">
      
    </Card>;
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
        <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
          {/* First show viewers with cameras */}
          {camerasArray.map(camera => <ViewerCameraThumbnail key={camera.sessionToken} camera={camera} />)}
          
          {/* Then show viewers without cameras */}
          {viewersWithoutCameras.map(viewer => <ViewerPlaceholderThumbnail key={viewer.session_id} viewer={viewer} />)}
        </div>
      </ScrollArea>
    </Card>;
};