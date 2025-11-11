import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Heart, Settings, ExternalLink } from 'lucide-react';

interface MyActiveStreamBannerProps {
  streamId: string;
  title: string;
  startedAt: string;
  currentViewers: number;
  totalLikes: number;
  onManageStream: () => void;
  onViewAsViewer: () => void;
}

export const MyActiveStreamBanner: React.FC<MyActiveStreamBannerProps> = ({
  title,
  startedAt,
  currentViewers,
  totalLikes,
  onManageStream,
  onViewAsViewer,
}) => {
  const [duration, setDuration] = React.useState('0:00');
  
  React.useEffect(() => {
    const startTime = new Date(startedAt).getTime();
    
    const updateDuration = () => {
      const now = Date.now();
      const diff = Math.floor((now - startTime) / 1000);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      if (hours > 0) {
        setDuration(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };
    
    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    
    return () => clearInterval(interval);
  }, [startedAt]);
  
  return (
    <div className="animate-banner-slide-in">
      <Card className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-purple-500/20 to-pink-500/20 animate-gradient-x" />
        
        <div className="relative p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left Side: Status and Info */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className="bg-red-500 text-white animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full mr-1.5 animate-pulse" />
                  LIVE
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {duration}
                </span>
              </div>
              
              <h3 className="text-lg md:text-xl font-semibold truncate">
                {title}
              </h3>
              
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{currentViewers}</span>
                  <span className="text-muted-foreground">viewers</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="font-medium">{totalLikes}</span>
                  <span className="text-muted-foreground">likes</span>
                </div>
              </div>
            </div>
            
            {/* Right Side: Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={onViewAsViewer}
                className="flex-1 md:flex-none"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View
              </Button>
              
              <Button
                onClick={onManageStream}
                className="flex-1 md:flex-none"
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
