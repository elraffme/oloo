import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Camera, Plus, X, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 4096; // 4K resolution
const MIN_DIMENSION = 200; // Minimum 200x200

const validateImageFile = async (file: File): Promise<void> => {
  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type.toLowerCase())) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 5MB.');
  }

  // Validate actual image content and dimensions
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
        reject(new Error('Image dimensions too large. Maximum is 4096x4096 pixels.'));
        return;
      }
      if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) {
        reject(new Error('Image too small. Minimum size is 200x200 pixels.'));
        return;
      }
      resolve();
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image file. Please upload a valid image.'));
    };
    
    img.src = url;
  });
};

interface PhotoUploadProps {
  profilePhotos: string[];
  onPhotosUpdate: (photos: string[]) => void;
  maxPhotos?: number;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ 
  profilePhotos, 
  onPhotosUpdate, 
  maxPhotos = 6 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || profilePhotos.length >= maxPhotos) return;

    setIsUploading(true);
    
    try {
      const newPhotos = [...profilePhotos];
      const filesToProcess = files.slice(0, maxPhotos - profilePhotos.length);
      
      for (const file of filesToProcess) {
        // Validate file before upload
        try {
          await validateImageFile(file);
        } catch (validationError: any) {
          toast({
            title: "Invalid file",
            description: validationError.message,
            variant: "destructive",
          });
          continue;
        }

        // Upload to Supabase Storage
        const fileName = `${user?.id}/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          newPhotos.push(urlData.publicUrl);
        }
      }

      onPhotosUpdate(newPhotos);

      toast({
        title: "Photos uploaded",
        description: `${newPhotos.length - profilePhotos.length} photos uploaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Unable to upload photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = async (index: number) => {
    const photoUrl = profilePhotos[index];
    
    try {
      // Extract file path from URL and delete from storage
      const url = new URL(photoUrl);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const filePath = `${user?.id}/${fileName}`;
      
      await supabase.storage
        .from('profile-photos')
        .remove([filePath]);
        
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
    
    const newPhotos = profilePhotos.filter((_, i) => i !== index);
    onPhotosUpdate(newPhotos);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (profilePhotos.length < maxPhotos) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (profilePhotos.length >= maxPhotos) return;

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );

    if (files.length === 0) {
      toast({
        title: "No images found",
        description: "Please drop image files only.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const newPhotos = [...profilePhotos];
      const filesToProcess = files.slice(0, maxPhotos - profilePhotos.length);
      
      for (const file of filesToProcess) {
        // Validate file before upload
        try {
          await validateImageFile(file);
        } catch (validationError: any) {
          toast({
            title: "Invalid file",
            description: validationError.message,
            variant: "destructive",
          });
          continue;
        }
        const fileName = `${user?.id}/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          newPhotos.push(urlData.publicUrl);
        }
      }

      onPhotosUpdate(newPhotos);

      toast({
        title: "Photos uploaded",
        description: `${newPhotos.length - profilePhotos.length} photos uploaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Unable to upload photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Profile Photos ({profilePhotos.length}/{maxPhotos})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className="grid grid-cols-2 md:grid-cols-3 gap-4"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {profilePhotos.map((photo, index) => (
            <div key={index} className="relative aspect-square group">
              <img
                src={photo}
                alt={`Profile ${index + 1}`}
                className="w-full h-full object-cover rounded-lg"
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removePhoto(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          
          {profilePhotos.length < maxPhotos && (
            <div
              className={`aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-colors border-2 border-dashed ${
                isDragging 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border bg-muted hover:bg-muted/80'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              ) : (
                <div className="text-center">
                  <Plus className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isDragging ? 'Drop here' : 'Add Photo'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        {profilePhotos.length > 0 && (
          <div className="mt-4 p-3 bg-accent/10 rounded-lg">
            <p className="text-sm text-muted-foreground">
              💡 Tip: Add multiple photos to increase your chances of matches by up to 3x!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};