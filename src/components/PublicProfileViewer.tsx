import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Heart, 
  X, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  Target,
  Languages,
  Ruler,
  Calendar,
  UserPlus,
  MessageCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendFriendRequest, checkFriendshipStatus } from "@/utils/friendsUtils";
import { useToast } from "@/components/ui/use-toast";
import { Clock } from "lucide-react";

interface PublicProfile {
  id: string;
  user_id: string;
  display_name: string;
  age: number;
  location: string;
  bio: string;
  occupation: string | null;
  education: string | null;
  interests: string[] | null;
  relationship_goals: string | null;
  languages: string[] | null;
  height_cm: number | null;
  profile_photos: string[] | null;
  main_profile_photo_index: number;
  avatar_url: string | null;
  verified: boolean;
}

interface PublicProfileViewerProps {
  profileId: string;
  isOpen: boolean;
  onClose: () => void;
  onSwipe?: (direction: 'left' | 'right') => void;
  onStartChat?: (userId: string) => void;
}

export const PublicProfileViewer = ({ 
  profileId, 
  isOpen, 
  onClose,
  onSwipe,
  onStartChat 
}: PublicProfileViewerProps) => {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'friend' | 'request_sent' | 'request_received'>('none');
  const [sendingRequest, setSendingRequest] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && profileId) {
      fetchProfile();
      checkFriendship();
    }
  }, [isOpen, profileId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', profileId)
        .single();

      if (error) throw error;
      
      setProfile(data);
      setCurrentPhotoIndex(data.main_profile_photo_index || 0);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkFriendship = async () => {
    const status = await checkFriendshipStatus(profileId);
    setFriendshipStatus(status);
  };

  const handleSendFriendRequest = async () => {
    setSendingRequest(true);
    try {
      const result = await sendFriendRequest(profileId);
      if (result.success) {
        if (result.type === 'accepted') {
          setFriendshipStatus('friend');
          toast({
            title: "You're now friends!",
            description: "You can now start chatting with each other.",
          });
        } else {
          setFriendshipStatus('request_sent');
          toast({
            title: "Friend request sent!",
            description: "You'll be notified when they accept your request.",
          });
        }
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to send friend request",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const getMainPhoto = () => {
    if (!profile?.profile_photos || profile.profile_photos.length === 0) {
      return profile?.avatar_url || '/placeholder.svg';
    }
    
    const mainIndex = profile.main_profile_photo_index || 0;
    return profile.profile_photos[mainIndex] || profile.profile_photos[0];
  };

  const handlePhotoClick = () => {
    if (profile?.profile_photos && profile.profile_photos.length > 1) {
      const nextIndex = (currentPhotoIndex + 1) % profile.profile_photos.length;
      setCurrentPhotoIndex(nextIndex);
    }
  };

  const formatHeight = (heightCm: number) => {
    const feet = Math.floor(heightCm / 30.48);
    const inches = Math.round((heightCm % 30.48) / 2.54);
    return `${heightCm}cm (${feet}'${inches}")`;
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md mx-auto">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!profile) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md mx-auto">
          <div className="text-center p-8">
            <p className="text-muted-foreground">Profile not found</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            {profile.display_name}, {profile.age}
            {profile.verified && (
              <Badge variant="secondary" className="text-xs">
                Verified
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Photo Section */}
        <div className="relative">
          <div 
            className="aspect-square rounded-lg overflow-hidden cursor-pointer bg-muted"
            onClick={handlePhotoClick}
          >
            <img
              src={profile.profile_photos?.[currentPhotoIndex] || getMainPhoto()}
              alt={`${profile.display_name}'s photo`}
              className="w-full h-full object-cover transition-all duration-300"
            />
          </div>
          
          {/* Photo indicators */}
          {profile.profile_photos && profile.profile_photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
              {profile.profile_photos.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === currentPhotoIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Profile Info */}
        <Card className="border-0 shadow-none">
          <CardContent className="p-0 space-y-4">
            
            {/* Location */}
            {profile.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{profile.location}</span>
              </div>
            )}

            {/* Bio */}
            {profile.bio && (
              <div>
                <p className="text-sm leading-relaxed">{profile.bio}</p>
              </div>
            )}

            <Separator />

            {/* Details Grid */}
            <div className="space-y-3">
              {profile.occupation && (
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{profile.occupation}</span>
                </div>
              )}

              {profile.education && (
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{profile.education}</span>
                </div>
              )}

              {profile.relationship_goals && (
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{profile.relationship_goals}</span>
                </div>
              )}

              {profile.height_cm && (
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{formatHeight(profile.height_cm)}</span>
                </div>
              )}

              {profile.languages && profile.languages.length > 0 && (
                <div className="flex items-start gap-2">
                  <Languages className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {profile.languages.map((language) => (
                      <Badge key={language} variant="outline" className="text-xs">
                        {language}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {profile.interests && profile.interests.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Interests</h4>
                  <div className="flex flex-wrap gap-1">
                    {profile.interests.map((interest) => (
                      <Badge key={interest} variant="secondary" className="text-xs">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Friends and Action Buttons */}
            <div className="space-y-4 pt-4">
              {/* Action Buttons - Facebook-style: Message anyone */}
              <div className="flex justify-center gap-3">
                {/* Always show Message button (Facebook-style) */}
                {onStartChat && (
                  <Button
                    onClick={() => {
                      onStartChat(profileId);
                      onClose();
                    }}
                    className="flex-1 max-w-xs"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                )}
                
                {/* Friend request actions */}
                {friendshipStatus === 'none' && (
                  <Button
                    onClick={handleSendFriendRequest}
                    disabled={sendingRequest}
                    variant="outline"
                    className="flex-1 max-w-xs"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {sendingRequest ? 'Sending...' : 'Add Friend'}
                  </Button>
                )}
                
                {friendshipStatus === 'request_sent' && (
                  <Button disabled className="flex-1 max-w-xs" variant="outline">
                    <Clock className="w-4 h-4 mr-2" />
                    Request Sent
                  </Button>
                )}
                
                {friendshipStatus === 'friend' && (
                  <Button disabled className="flex-1 max-w-xs" variant="outline">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Friends
                  </Button>
                )}
              </div>

              {/* Swipe Actions */}
              {onSwipe && (
                <div className="flex justify-center gap-4">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-16 h-16 rounded-full border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    onClick={() => {
                      onSwipe('left');
                      onClose();
                    }}
                  >
                    <X className="w-8 h-8" />
                  </Button>
                  
                  <Button
                    size="lg"
                    className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90"
                    onClick={() => {
                      onSwipe('right');
                      onClose();
                    }}
                  >
                    <Heart className="w-8 h-8" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};