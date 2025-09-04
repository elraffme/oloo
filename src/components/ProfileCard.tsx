import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Heart, X, MapPin, Briefcase, GraduationCap, Info, User, MessageCircle, RotateCcw, Star, Send } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { PhotoGallery } from '@/components/PhotoGallery';


interface Profile {
  id: string;
  display_name: string;
  age: number;
  location?: string;
  bio?: string;
  occupation?: string;
  education?: string;
  interests?: string[];
  verified?: boolean;
  profile_photos?: string[];
  main_profile_photo_index?: number;
  personality?: string;
}

interface ProfileCardProps {
  profile: Profile;
  onSwipe: (direction: 'left' | 'right') => void;
  onSuperLike?: () => void;
  onUndo?: () => void;
  onBoost?: () => void;
  onMessage?: () => void;
  onViewProfile?: (profileId: string) => void;
  showActions?: boolean;
  swipeDirection?: 'left' | 'right' | null;
}

export const ProfileCard = ({ 
  profile, 
  onSwipe, 
  onSuperLike,
  onUndo,
  onBoost,
  onMessage, 
  onViewProfile,
  showActions = true, 
  swipeDirection 
}: ProfileCardProps) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleLikePhoto = (photoIndex: number) => {
    console.log(`Liked photo ${photoIndex} of ${profile.display_name}`);
  };

  const getPersonalityDisplay = (personality: string) => {
    if (!personality) return null;
    
    // If it's a Myers-Briggs type, show just the type
    if (personality.length === 4 && personality.match(/^[EINT]+$/)) {
      return personality;
    }
    
    // For older personality types, show as is
    return personality;
  };

  return (
    <>
      <Card 
        className={`swipe-card relative overflow-hidden transition-all duration-600 ${
          swipeDirection === 'right' ? 'animate-swipe-right' : 
          swipeDirection === 'left' ? 'animate-swipe-left' : ''
        }`}
      >
        <CardContent className="p-0">
          {/* Profile Image */}
          <div className="relative h-96 bg-gradient-to-br from-primary/20 to-accent/20">
            {profile.profile_photos?.[0] ? (
              <img 
                src={profile.profile_photos[profile.main_profile_photo_index || 0] || profile.profile_photos[0]} 
                alt={profile.display_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">
                <span className="heart-logo scale-150">
                  <span className="logo-text">Ò</span>
                </span>
              </div>
            )}
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Status Badges */}
            <div className="absolute top-4 left-4 flex gap-2">
              <VerifiedBadge verified={profile.verified || Math.random() > 0.5} />
              {Math.random() > 0.7 && (
                <Badge className="bg-green-500 hover:bg-green-600 text-white">
                  Online
                </Badge>
              )}
            </div>

            {/* Info and View Profile Buttons */}
            <div className="absolute top-4 right-4 flex gap-2">
              <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="bg-white/20 backdrop-blur-sm hover:bg-white/30"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
              </Dialog>
              
              {onViewProfile && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="bg-white/20 backdrop-blur-sm hover:bg-white/30"
                  onClick={() => onViewProfile(profile.id)}
                >
                  <User className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-2xl font-bold font-afro-heading flex items-center gap-2">
                {profile.display_name}
                <span className="text-lg text-muted-foreground font-normal">
                  {profile.age}
                </span>
              </h3>
              
              {profile.location && (
                <p className="text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="w-4 h-4" />
                  {profile.location}
                </p>
              )}
            </div>

            {profile.bio && (
              <p className="text-sm leading-relaxed line-clamp-3">{profile.bio}</p>
            )}

            {/* Quick Info */}
            <div className="space-y-2">
              {profile.occupation && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <span>{profile.occupation}</span>
                </div>
              )}
              
              {profile.education && (
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                  <span>{profile.education}</span>
                </div>
              )}

              {profile.personality && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{getPersonalityDisplay(profile.personality)}</span>
                </div>
              )}
            </div>

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.interests.slice(0, 4).map((interest: string, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {interest}
                  </Badge>
                ))}
                {profile.interests.length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{profile.interests.length - 4} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tinder-Style Action Buttons */}
      {showActions && (
        <div className="flex justify-center items-center gap-4 mt-6 px-4">
          {/* Undo Button */}
          <Button
            size="lg"
            variant="outline"
            className="w-12 h-12 rounded-full border-2 border-muted hover:bg-muted hover:scale-110 transition-all duration-200"
            onClick={onUndo}
            disabled={!onUndo}
          >
            <RotateCcw className="w-5 h-5 text-muted-foreground" />
          </Button>

          {/* Pass/Dislike Button */}
          <Button
            size="lg"
            variant="outline"
            className="w-14 h-14 rounded-full border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white hover:scale-110 transition-all duration-200 bg-white shadow-lg"
            onClick={() => onSwipe('left')}
          >
            <X className="w-7 h-7" />
          </Button>

          {/* Super Like Button */}
          <Button
            size="lg"
            variant="outline"
            className="w-12 h-12 rounded-full border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white hover:scale-110 transition-all duration-200 bg-white shadow-lg"
            onClick={onSuperLike}
          >
            <Star className="w-5 h-5" />
          </Button>

          {/* Like Button */}
          <Button
            size="lg"
            className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-white hover:scale-110 transition-all duration-200 shadow-lg border-2 border-primary"
            onClick={() => onSwipe('right')}
          >
            <Heart className="w-7 h-7" />
          </Button>

          {/* Boost Button */}
          <Button
            size="lg"
            variant="outline"
            className="w-12 h-12 rounded-full border-2 border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-white hover:scale-110 transition-all duration-200 bg-white shadow-lg"
            onClick={onBoost}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Detailed Profile Modal */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <h2 className="text-3xl font-bold font-afro-heading flex items-center justify-center gap-2">
                {profile.display_name}
                <span className="text-xl text-muted-foreground font-normal">
                  {profile.age}
                </span>
              </h2>
              
              {profile.location && (
                <p className="text-muted-foreground flex items-center justify-center gap-1 mt-1">
                  <MapPin className="w-4 h-4" />
                  {profile.location}
                </p>
              )}
            </div>

            {/* Photo Gallery */}
            {profile.profile_photos && profile.profile_photos.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Photos</h3>
                <PhotoGallery 
                  photos={profile.profile_photos} 
                  userName={profile.display_name}
                  onLikePhoto={handleLikePhoto}
                />
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <div>
                <h3 className="text-lg font-semibold mb-2">About</h3>
                <p className="text-sm leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Details</h3>
              <div className="grid grid-cols-1 gap-3">
                {profile.occupation && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-muted-foreground" />
                    <span>{profile.occupation}</span>
                  </div>
                )}
                
                {profile.education && (
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-5 h-5 text-muted-foreground" />
                    <span>{profile.education}</span>
                  </div>
                )}

                {profile.personality && (
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <span>{getPersonalityDisplay(profile.personality)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons in Modal */}
            <div className="flex justify-center gap-3 pt-4 border-t">
              <Button
                size="lg"
                variant="outline"
                className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => {
                  onSwipe('left');
                  setIsProfileOpen(false);
                }}
              >
                <X className="w-5 h-5 mr-2" />
                Pass
              </Button>
              
              {onMessage && (
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  onClick={() => {
                    onMessage();
                    setIsProfileOpen(false);
                  }}
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Message
                </Button>
              )}
              
              <Button
                size="lg"
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={() => {
                  onSwipe('right');
                  setIsProfileOpen(false);
                }}
              >
                <Heart className="w-5 h-5 mr-2" />
                Like
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};