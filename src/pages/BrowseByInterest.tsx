import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, MapPin, Heart, Users, ArrowLeft } from 'lucide-react';
import { PublicProfileViewer } from '@/components/PublicProfileViewer';

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  age: number;
  location: string;
  bio: string;
  interests: string[];
  avatar_url: string | null;
  profile_photos: string[] | null;
  main_profile_photo_index: number;
  verified: boolean;
}

const BrowseByInterest = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [popularInterests, setPopularInterests] = useState<{ interest: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  useEffect(() => {
    const interest = searchParams.get('interest');
    if (interest) {
      setSelectedInterest(interest);
      loadProfilesByInterest(interest);
    } else {
      loadPopularInterests();
    }
  }, [searchParams]);

  const loadPopularInterests = async () => {
    setLoading(true);
    try {
      // Get all profiles with interests
      const { data, error } = await supabase
        .from('profiles')
        .select('interests')
        .not('interests', 'is', null);

      if (error) throw error;

      // Count interest frequency
      const interestCounts: { [key: string]: number } = {};
      data?.forEach((profile) => {
        profile.interests?.forEach((interest: string) => {
          interestCounts[interest] = (interestCounts[interest] || 0) + 1;
        });
      });

      // Convert to array and sort
      const sorted = Object.entries(interestCounts)
        .map(([interest, count]) => ({ interest, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      setPopularInterests(sorted);
    } catch (error) {
      console.error('Error loading popular interests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfilesByInterest = async (interest: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .contains('interests', [interest])
        .neq('user_id', user?.id || '')
        .limit(50);

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInterestClick = (interest: string) => {
    navigate(`/app/browse-interest?interest=${encodeURIComponent(interest)}`);
  };

  const getProfilePhoto = (profile: UserProfile) => {
    if (profile.profile_photos && profile.profile_photos.length > 0) {
      return profile.profile_photos[profile.main_profile_photo_index || 0];
    }
    return profile.avatar_url || '/placeholder.svg';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          {selectedInterest ? (
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/app/browse-interest')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Sparkles className="w-8 h-8 text-primary" />
                  {selectedInterest}
                </h1>
                <p className="text-muted-foreground">
                  {profiles.length} {profiles.length === 1 ? 'person' : 'people'} interested in {selectedInterest}
                </p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-primary" />
                Browse by Interest
              </h1>
              <p className="text-muted-foreground">
                Discover people who share your passions
              </p>
            </>
          )}
        </div>

        {/* Popular Interests Grid */}
        {!selectedInterest && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {popularInterests.map(({ interest, count }) => (
              <Card
                key={interest}
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 hover:border-primary"
                onClick={() => handleInterestClick(interest)}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-2xl mb-2">
                    {getInterestEmoji(interest)}
                  </div>
                  <h3 className="font-semibold mb-1">{interest}</h3>
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                    <Users className="w-3 h-3" />
                    {count} {count === 1 ? 'person' : 'people'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Profiles by Interest */}
        {selectedInterest && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile) => (
              <Card
                key={profile.id}
                className="cursor-pointer hover:shadow-lg transition-all overflow-hidden group"
                onClick={() => setSelectedProfileId(profile.user_id)}
              >
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={getProfilePhoto(profile)}
                    alt={profile.display_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold">
                        {profile.display_name}, {profile.age}
                      </h3>
                      {profile.verified && (
                        <Badge className="bg-primary">Verified</Badge>
                      )}
                    </div>
                    <p className="text-sm flex items-center gap-1 opacity-90">
                      <MapPin className="w-3 h-3" />
                      {profile.location}
                    </p>
                  </div>
                </div>

                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {profile.bio}
                  </p>
                  
                  {/* Shared interests */}
                  <div className="flex flex-wrap gap-1">
                    {profile.interests?.slice(0, 3).map((interest) => (
                      <Badge
                        key={interest}
                        variant={interest === selectedInterest ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {interest}
                      </Badge>
                    ))}
                    {profile.interests && profile.interests.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{profile.interests.length - 3}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {profiles.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No profiles found</h3>
                <p className="text-muted-foreground">
                  Be the first to add {selectedInterest} to your interests!
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile Viewer Modal */}
      {selectedProfileId && (
        <PublicProfileViewer
          profileId={selectedProfileId}
          isOpen={!!selectedProfileId}
          onClose={() => setSelectedProfileId(null)}
        />
      )}
    </div>
  );
};

// Helper function to add emojis to interests
const getInterestEmoji = (interest: string): string => {
  const emojiMap: { [key: string]: string } = {
    'Music': '🎵',
    'Travel': '✈️',
    'Food': '🍔',
    'Fitness': '💪',
    'Art': '🎨',
    'Movies': '🎬',
    'Books': '📚',
    'Sports': '⚽',
    'Gaming': '🎮',
    'Photography': '📷',
    'Dancing': '💃',
    'Cooking': '👨‍🍳',
    'Fashion': '👗',
    'Technology': '💻',
    'Nature': '🌲',
    'Yoga': '🧘',
    'Coffee': '☕',
    'Wine': '🍷',
    'Pets': '🐾',
    'Comedy': '😂',
  };

  return emojiMap[interest] || '✨';
};

export default BrowseByInterest;
