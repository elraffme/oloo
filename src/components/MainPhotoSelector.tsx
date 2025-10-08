import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Star, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MainPhotoSelectorProps {
  profilePhotos: string[];
  mainPhotoIndex: number;
  userId: string;
  onUpdate: (newIndex: number) => void;
}

export const MainPhotoSelector = ({ 
  profilePhotos, 
  mainPhotoIndex, 
  userId,
  onUpdate 
}: MainPhotoSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSelectMainPhoto = async (index: number) => {
    setIsUpdating(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          main_profile_photo_index: index,
          avatar_url: profilePhotos[index] // Update avatar_url to match main photo
        })
        .eq('user_id', userId);

      if (error) throw error;

      onUpdate(index);
      toast.success("Main photo updated successfully!");
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating main photo:', error);
      toast.error("Failed to update main photo");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!profilePhotos || profilePhotos.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="mb-4"
        >
          <Star className="w-4 h-4 mr-2" />
          Choose Main Photo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Your Main Profile Photo</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {profilePhotos.map((photo, index) => (
            <div 
              key={index} 
              className="relative group cursor-pointer rounded-lg overflow-hidden"
              onClick={() => handleSelectMainPhoto(index)}
            >
              <img
                src={photo}
                alt={`Profile photo ${index + 1}`}
                className="w-full aspect-square object-cover transition-all group-hover:scale-105"
              />
              
              {/* Current main photo badge */}
              {index === mainPhotoIndex && (
                <Badge className="absolute top-2 left-2 bg-primary text-white">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  Main
                </Badge>
              )}
              
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {index === mainPhotoIndex ? (
                  <div className="text-white text-center">
                    <Check className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">Current Main</span>
                  </div>
                ) : (
                  <div className="text-white text-center">
                    <Star className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">Set as Main</span>
                  </div>
                )}
              </div>
              
              {/* Loading overlay */}
              {isUpdating && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="text-sm text-muted-foreground">
          Your main photo will be displayed as your profile picture and shown to other users.
        </div>
      </DialogContent>
    </Dialog>
  );
};