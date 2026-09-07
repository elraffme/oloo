import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Heart, X, MapPin, Briefcase, GraduationCap, Info, User, MessageCircle, RotateCcw, Star, Send, UserPlus, Target, Globe, Ruler, Sparkles } from 'lucide-react';
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
  relationship_goals?: string;
  height_cm?: number;
  languages?: string[];
  gender?: string;
  want_kids?: boolean;
  have_kids?: boolean;
  open_to_kids?: boolean;
}

interface ProfileCardProps {
  profile: Profile;
  onSwipe: (direction: 'left' | 'right') => void;
  onSuperLike?: () => void;
  onUndo?: () => void;
  onBoost?: () => void;
  onMessage?: () => void;
  onViewProfile?: (profileId: string) => void;
  onAddFriend?: () => void;
  friendRequestState?: 'idle' | 'loading' | 'sent' | 'friends' | 'error';
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
  onAddFriend,
  friendRequestState = 'idle',
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

  // Onboarding writes placeholder strings when a user skips a field — never show those.
  const PLACEHOLDERS = ['not specified', 'new to òloo!', 'new to oloo!', 'n/a', '-'];
  const provided = (value?: string | null) => {
    const v = (value ?? '').trim();
    return v.length > 0 && !PLACEHOLDERS.includes(v.toLowerCase()) ? v : null;
  };

  // Onboarding stores personality appended to the bio as "…\n\nPersonality: X".
  const rawBio = provided(profile.bio);
  const personalityFromBio = rawBio?.match(/Personality:\s*(.+)$/i)?.[1]?.trim() || null;
  const bioText = rawBio ? provided(rawBio.replace(/\n*Personality:\s*.+$/i, '').trim()) : null;
  const personality = provided(profile.personality) || provided(personalityFromBio);

  const occupation = provided(profile.occupation);
  const education = provided(profile.education);
  const location = provided(profile.location);
  const relationshipGoals = provided(profile.relationship_goals);
  const gender = provided(profile.gender);
  const heightLabel = profile.height_cm
    ? `${profile.height_cm} cm (${Math.floor(profile.height_cm / 2.54 / 12)}'${Math.round((profile.height_cm / 2.54) % 12)}")`
    : null;
  const languages = profile.languages?.filter(Boolean) ?? [];
  const hasKidsInfo =
    profile.have_kids === true || profile.want_kids === true || profile.open_to_kids === true;
  const hasAbout = Boolean(
    relationshipGoals || heightLabel || languages.length > 0 || gender || personality || hasKidsInfo
  );



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
                  onClick={() => onViewProfile((profile as any).user_id || profile.id)}
                >
                  <User className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="p-4 sm:p-6 space-y-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold font-afro-heading flex items-center gap-2">
                {profile.display_name}
                <span className="text-base sm:text-lg text-muted-foreground font-normal">
                  {profile.age}
                </span>
              </h3>
              
              {location && (
                <p className="text-muted-foreground flex items-center gap-1 mt-1 text-sm">
                  <MapPin className="w-4 h-4 shrink-0" />
                  {location}
                </p>
              )}
            </div>

            {bioText && (
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-line break-words">
                {bioText}
              </p>
            )}

            {/* Quick Info */}
            {(occupation || education) && (
              <div className="space-y-2">
                {occupation && (
                  <div className="flex items-start gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="break-words">{occupation}</span>
                  </div>
                )}

                {education && (
                  <div className="flex items-start gap-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="capitalize break-words">{education.replace(/-/g, ' ')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.interests.slice(0, 4).map((interest: string, index: number) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/app/browse-interest?interest=${encodeURIComponent(interest)}`;
                    }}
                  >
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

            {/* Additional Profile Details */}
            {hasAbout && (
              <div className="pt-4 border-t border-border/60 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  About
                </h4>
                <div className="space-y-2">
                  {relationshipGoals && (
                    <div className="flex items-start gap-2 text-sm">
                      <Target className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-foreground leading-relaxed break-words">{relationshipGoals}</span>
                    </div>
                  )}
                  {heightLabel && (
                    <div className="flex items-center gap-2 text-sm">
                      <Ruler className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-foreground">{heightLabel}</span>
                    </div>
                  )}
                  {languages.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Globe className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-foreground leading-relaxed break-words">{languages.join(', ')}</span>
                    </div>
                  )}
                  {gender && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="capitalize text-foreground">{gender}</span>
                    </div>
                  )}
                  {personality && (
                    <div className="flex items-start gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-foreground leading-relaxed break-words">{getPersonalityDisplay(personality)}</span>
                    </div>
                  )}

                  {hasKidsInfo && (
                    <div className="flex flex-wrap gap-2 text-sm">
                      {profile.have_kids === true && (
                        <Badge variant="secondary" className="text-xs">Has kids</Badge>
                      )}
                      {profile.want_kids === true && (
                        <Badge variant="secondary" className="text-xs">Wants kids</Badge>
                      )}
                      {profile.open_to_kids === true && (
                        <Badge variant="secondary" className="text-xs">Open to kids</Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Core Action Buttons */}
      {showActions && (
        <div className="flex justify-center items-center gap-3 mt-4 px-4">
          {/* Pass Button */}
          <Button
            size="sm"
            variant="outline"
            className="w-10 h-10 rounded-full bg-red-500 text-white border-red-500 hover:bg-red-600 hover:border-red-600 transition-all duration-200"
            onClick={() => onSwipe('left')}
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Like Button */}
          <Button
            size="sm"
            variant="romantic"
            className="w-10 h-10 rounded-full hover:scale-105 transition-all duration-200"
            onClick={() => onSwipe('right')}
          >
            <Heart className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Add Friends Button */}
      {onAddFriend && (
        <div className="flex justify-center mt-3">
          <Button
            onClick={onAddFriend}
            size="sm"
            disabled={friendRequestState === 'loading' || friendRequestState === 'sent' || friendRequestState === 'friends'}
            className={`px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-200 text-sm ${
              friendRequestState === 'friends' 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-0' 
                : friendRequestState === 'sent'
                ? 'bg-blue-500 hover:bg-blue-600 text-white border-0'
                : friendRequestState === 'error'
                ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground border-0'
                : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border'
            }`}
          >
            {friendRequestState === 'loading' ? (
              <>
                <div className="w-3 h-3 border-2 border-current border-t-transparent animate-spin rounded-full" />
                Sending...
              </>
            ) : friendRequestState === 'sent' ? (
              <>
                <div className="w-3 h-3 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-[10px] text-white">✓</span>
                </div>
                Request Sent
              </>
            ) : friendRequestState === 'friends' ? (
              <>
                <div className="w-3 h-3 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-[10px] text-white">✓</span>
                </div>
                Friends
              </>
            ) : friendRequestState === 'error' ? (
              <>
                <UserPlus className="w-3 h-3" />
                Try Again
              </>
            ) : (
              <>
                <UserPlus className="w-3 h-3" />
                Add Friend
              </>
            )}
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

                {profile.relationship_goals && (
                  <div className="flex items-start gap-3">
                    <Target className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{profile.relationship_goals}</span>
                  </div>
                )}

                {profile.height_cm && (
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span>{profile.height_cm} cm</span>
                  </div>
                )}

                {profile.languages && profile.languages.length > 0 && (
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{profile.languages.join(', ')}</span>
                  </div>
                )}

                {profile.gender && (
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="capitalize">{profile.gender}</span>
                  </div>
                )}

                {hasKidsInfo && (
                  <div className="flex flex-wrap gap-2">
                    {profile.have_kids === true && (
                      <Badge variant="secondary">Has kids</Badge>
                    )}
                    {profile.want_kids === true && (
                      <Badge variant="secondary">Wants kids</Badge>
                    )}
                    {profile.open_to_kids === true && (
                      <Badge variant="secondary">Open to kids</Badge>
                    )}
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
                    <Badge 
                      key={index} 
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/app/browse-interest?interest=${encodeURIComponent(interest)}`;
                      }}
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons in Modal */}
            <div className="flex justify-center gap-2 pt-4 border-t">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => {
                  onSwipe('left');
                  setIsProfileOpen(false);
                }}
              >
                <X className="w-4 h-4 mr-1" />
                Pass
              </Button>
              
              {onMessage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  onClick={() => {
                    onMessage();
                    setIsProfileOpen(false);
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Message
                </Button>
              )}
              
              <Button
                size="sm"
                variant="romantic"
                className="flex-1"
                onClick={() => {
                  onSwipe('right');
                  setIsProfileOpen(false);
                }}
              >
                <Heart className="w-4 h-4 mr-1" />
                Like
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};