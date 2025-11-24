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

interface ViewerCameraThumbnailsProps {
  viewerCameras: Map<string, ViewerCamera>;
  className?: string;
}

const ViewerCameraThumbnail: React.FC<{ camera: ViewerCamera }> = ({ camera }) => {
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

  return (
    <Card className="relative overflow-hidden bg-background/95 backdrop-blur-sm border-border/50">
      <div className="aspect-video relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {/* Overlay with viewer info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6 border-2 border-primary">
              <AvatarImage src={camera.avatarUrl} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs">
                {camera.displayName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-foreground truncate flex-1">
              {camera.displayName}
            </span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              <Video className="h-3 w-3" />
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
};

export const ViewerCameraThumbnails: React.FC<ViewerCameraThumbnailsProps> = ({
  viewerCameras,
  className
}) => {
  const camerasArray = Array.from(viewerCameras.values());

  if (camerasArray.length === 0) {
    return (
      <Card className={cn("bg-background/95 backdrop-blur-sm border-border/50 p-4", className)}>
        <div className="flex flex-col items-center justify-center text-center py-6">
          <div className="rounded-full bg-muted p-3 mb-3">
            <VideoOff className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No Viewer Cameras</p>
          <p className="text-xs text-muted-foreground">
            Viewers can enable their cameras to appear here
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-background/95 backdrop-blur-sm border-border/50", className)}>
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Viewer Cameras
            </span>
          </div>
          <Badge variant="secondary" className="h-6 px-2">
            {camerasArray.length}
          </Badge>
        </div>
      </div>

      <ScrollArea className="h-full max-h-[500px]">
        <div className="p-3 grid grid-cols-2 gap-3">
          {camerasArray.map((camera) => (
            <ViewerCameraThumbnail
              key={camera.sessionToken}
              camera={camera}
            />
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};
