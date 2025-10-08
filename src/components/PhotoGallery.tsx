import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Heart, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Photo {
  id: string;
  url: string;
  likes: number;
  isLiked: boolean;
}

interface PhotoGalleryProps {
  photos: string[];
  userName: string;
  onLikePhoto?: (photoIndex: number) => void;
}

export const PhotoGallery = ({ photos, userName, onLikePhoto }: PhotoGalleryProps) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [photoLikes, setPhotoLikes] = useState<Record<number, { likes: number; isLiked: boolean }>>(
    photos.reduce((acc, _, index) => ({
      ...acc,
      [index]: { likes: Math.floor(Math.random() * 50), isLiked: false }
    }), {})
  );

  const handleLikePhoto = (photoIndex: number) => {
    setPhotoLikes(prev => ({
      ...prev,
      [photoIndex]: {
        likes: prev[photoIndex].isLiked 
          ? prev[photoIndex].likes - 1 
          : prev[photoIndex].likes + 1,
        isLiked: !prev[photoIndex].isLiked
      }
    }));
    onLikePhoto?.(photoIndex);
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  if (!photos.length) return null;

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {photos.slice(0, 6).map((photo, index) => (
        <Dialog key={index}>
          <DialogTrigger asChild>
            <div 
              className="relative aspect-square cursor-pointer overflow-hidden rounded-lg hover:opacity-90 transition-opacity"
              onClick={() => setCurrentPhotoIndex(index)}
            >
              <img
                src={photo}
                alt={`${userName} photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              
              {/* Like count overlay */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <Heart 
                  className={`w-4 h-4 ${photoLikes[index]?.isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} 
                />
                <span className="text-white text-xs font-medium">
                  {photoLikes[index]?.likes || 0}
                </span>
              </div>

              {/* Main photo indicator */}
              {index === 0 && (
                <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">
                  Main
                </Badge>
              )}
            </div>
          </DialogTrigger>
          
          <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-black/95">
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Close button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  // Dialog will close automatically
                }}
              >
                <X className="w-5 h-5" />
              </Button>

              {/* Navigation buttons */}
              {photos.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      prevPhoto();
                    }}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      nextPhoto();
                    }}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>
                </>
              )}

              {/* Main photo */}
              <img
                src={photos[currentPhotoIndex]}
                alt={`${userName} photo ${currentPhotoIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />

              {/* Photo info and actions */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">
                    {currentPhotoIndex + 1} of {photos.length}
                  </span>
                  <div className="flex items-center gap-1 text-white">
                    <Heart 
                      className={`w-5 h-5 ${photoLikes[currentPhotoIndex]?.isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} 
                    />
                    <span className="font-medium">
                      {photoLikes[currentPhotoIndex]?.likes || 0} likes
                    </span>
                  </div>
                </div>

                <Button
                  variant={photoLikes[currentPhotoIndex]?.isLiked ? "default" : "outline"}
                  size="sm"
                  className={`${
                    photoLikes[currentPhotoIndex]?.isLiked 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-white/20 hover:bg-white/30 text-white border-white/30'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLikePhoto(currentPhotoIndex);
                  }}
                >
                  <Heart 
                    className={`w-4 h-4 mr-2 ${photoLikes[currentPhotoIndex]?.isLiked ? 'fill-current' : ''}`} 
                  />
                  {photoLikes[currentPhotoIndex]?.isLiked ? 'Liked' : 'Like'}
                </Button>
              </div>

              {/* Photo indicators */}
              {photos.length > 1 && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2">
                  {photos.map((_, index) => (
                    <button
                      key={index}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === currentPhotoIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhotoIndex(index);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
};