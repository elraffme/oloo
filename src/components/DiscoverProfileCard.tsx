import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { ProfileStrengthIndicators } from '@/components/ProfileStrengthIndicators';
import { Briefcase, Loader2, MapPin, MessageCircle, User, UserCheck, UserPlus } from 'lucide-react';

export interface DiscoverProfile {
  id: string;
  user_id: string;
  display_name: string;
  age: number;
  location?: string | null;
  bio?: string | null;
  occupation?: string | null;
  education?: string | null;
  interests?: string[] | null;
  verified?: boolean | null;
  profile_photos?: string[] | null;
  main_profile_photo_index?: number | null;
  relationship_goals?: string | null;
  height_cm?: number | null;
  languages?: string[] | null;
  gender?: string | null;
  want_kids?: boolean | null;
  have_kids?: boolean | null;
  open_to_kids?: boolean | null;
  onboarding_completed?: boolean | null;
}

type FriendState = 'idle' | 'loading' | 'sent' | 'friends' | 'error';

interface DiscoverProfileCardProps {
  profile: DiscoverProfile;
  friendState: FriendState;
  onView: (profile: DiscoverProfile) => void;
  onMessage: (profile: DiscoverProfile) => void;
  onAddFriend: (profile: DiscoverProfile) => void;
}

const omittedValues = new Set(['not specified', 'new to òloo!', 'new to oloo!', 'n/a', '-']);

const usableText = (value?: string | null) => {
  const text = value?.trim() ?? '';
  return text && !omittedValues.has(text.toLowerCase()) ? text : null;
};

export const DiscoverProfileCard = ({
  profile,
  friendState,
  onView,
  onMessage,
  onAddFriend,
}: DiscoverProfileCardProps) => {
  const photoIndex = profile.main_profile_photo_index ?? 0;
  const photo = profile.profile_photos?.[photoIndex] ?? profile.profile_photos?.[0];
  const location = usableText(profile.location);
  const occupation = usableText(profile.occupation);
  const rawBio = usableText(profile.bio);
  const bio = rawBio?.replace(/\n*Personality:\s*.+$/i, '').trim();
  const interests = profile.interests?.filter(Boolean).slice(0, 3) ?? [];

  const friendLabel = friendState === 'loading'
    ? 'Sending'
    : friendState === 'sent'
      ? 'Sent'
      : friendState === 'friends'
        ? 'Friends'
        : friendState === 'error'
          ? 'Retry'
          : 'Add friend';

  return (
    <Card className="group flex h-full min-w-0 flex-col overflow-hidden border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Button
        variant="ghost"
        onClick={() => onView(profile)}
        className="relative block h-auto aspect-[4/5] w-full overflow-hidden rounded-none bg-muted p-0 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={`View ${profile.display_name}'s profile`}
      >
        {photo ? (
          <img
            src={photo}
            alt={`${profile.display_name}'s profile`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-primary" aria-hidden="true">
            <span className="heart-logo scale-125"><span className="logo-text">Ò</span></span>
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/90 to-transparent px-3 pb-3 pt-12 text-background">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-afro-heading text-lg font-bold">{profile.display_name}</span>
            <span className="shrink-0 text-sm font-medium">{profile.age}</span>
            {profile.verified && <VerifiedBadge verified size="sm" />}
          </span>
          {location && (
            <span className="mt-1 flex items-center gap-1 text-xs text-background/90">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          )}
        </span>
      </Button>

      <CardContent className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        {occupation && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground sm:text-sm">
            <Briefcase className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{occupation}</span>
          </p>
        )}
        {bio && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{bio}</p>}
        <ProfileStrengthIndicators profile={profile} />
        {interests.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5">
            {interests.map((interest) => (
              <Badge key={interest} variant="secondary" className="max-w-full truncate text-[11px] font-medium">
                {interest}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="grid grid-cols-3 gap-1.5 border-t border-border p-2 sm:gap-2 sm:p-3">
        <Button variant="ghost" size="sm" className="min-w-0 px-1" onClick={() => onView(profile)} title="View profile">
          <User className="h-4 w-4" />
          <span className="sr-only">View profile</span>
        </Button>
        <Button variant="ghost" size="sm" className="min-w-0 px-1" onClick={() => onMessage(profile)} title="Message">
          <MessageCircle className="h-4 w-4" />
          <span className="sr-only">Message</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="min-w-0 px-1"
          onClick={() => onAddFriend(profile)}
          disabled={friendState === 'loading' || friendState === 'sent' || friendState === 'friends'}
          title={friendLabel}
        >
          {friendState === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : friendState === 'friends' ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          <span className="sr-only">{friendLabel}</span>
        </Button>
      </CardFooter>
    </Card>
  );
};