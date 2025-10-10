/**
 * Security-Enhanced Profile Card Wrapper
 * Implements tiered data visibility and rate limiting
 */

import { useState, useEffect } from 'react';
import { ProfileCard } from './ProfileCard';
import { useRateLimiting } from '@/hooks/useRateLimiting';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

interface SecurityEnhancedProfileCardProps {
  profile: any;
  isConnected: boolean;
  onSwipe?: (direction: 'left' | 'right') => void;
  onSuperLike?: () => void;
  onUndo?: () => void;
  onBoost?: () => void;
  onViewProfile?: (profileId: string) => void;
  [key: string]: any;
}

export const SecurityEnhancedProfileCard: React.FC<SecurityEnhancedProfileCardProps> = ({
  profile,
  isConnected,
  ...otherProps
}) => {
  const { toast } = useToast();
  const { checkProfileViewLimit, recordAction } = useRateLimiting();
  const [displayProfile, setDisplayProfile] = useState<any>(null);
  const [rateLimitExceeded, setRateLimitExceeded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfileData();
  }, [profile, isConnected]);

  const loadProfileData = async () => {
    try {
      setLoading(true);

      // Check rate limit before loading profile
      const rateLimitCheck = await checkProfileViewLimit();
      
      if (!rateLimitCheck.allowed) {
        setRateLimitExceeded(true);
        const resetTime = rateLimitCheck.resetTime;
        const minutesUntilReset = resetTime 
          ? Math.ceil((resetTime.getTime() - Date.now()) / 60000)
          : 30;
        
        toast({
          title: "Profile View Limit Reached",
          description: `You've reached your hourly limit of 50 profile views. Please wait ${minutesUntilReset} minutes.`,
          variant: "destructive",
        });
        return;
      }

      // Load appropriate profile data based on connection status
      if (isConnected) {
        // Full profile for connected users
        const { data, error } = await supabase.rpc('get_full_profile', {
          profile_user_id: profile.user_id,
          requesting_user_id: (await supabase.auth.getUser()).data.user?.id
        });

        if (data) {
          setDisplayProfile(data);
        } else {
          setDisplayProfile(profile);
        }
      } else {
        // Limited preview for discovery
        const { data, error } = await supabase.rpc('get_discovery_profile_preview', {
          profile_user_id: profile.user_id || profile.id
        });

        if (data) {
          setDisplayProfile({ ...profile, ...(data as object), _isPreview: true });
        } else {
          setDisplayProfile(profile);
        }
      }

      // Record the profile view action
      await recordAction('profile_view');

    } catch (error) {
      console.error('Error loading profile:', error);
      setDisplayProfile(profile);
    } finally {
      setLoading(false);
    }
  };

  if (rateLimitExceeded) {
    return (
      <div className="max-w-md mx-auto p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            You've reached your profile viewing limit. This helps us maintain a safe community.
            Your limit will reset soon.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading || !displayProfile) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="animate-pulse">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="relative">
      {displayProfile._isPreview && (
        <div className="absolute top-4 right-4 z-10 bg-primary/90 text-primary-foreground px-3 py-1 rounded-full text-xs">
          Preview - Match to see full profile
        </div>
      )}
      <ProfileCard
        profile={displayProfile}
        onSwipe={otherProps.onSwipe || (() => {})}
        onSuperLike={otherProps.onSuperLike || (() => {})}
        onUndo={otherProps.onUndo || (() => {})}
        onBoost={otherProps.onBoost || (() => {})}
        onViewProfile={otherProps.onViewProfile}
        friendRequestState={otherProps.friendRequestState}
        onAddFriend={otherProps.onAddFriend}
      />
    </div>
  );
};
