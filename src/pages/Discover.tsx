import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, X, MapPin, Briefcase, GraduationCap, Info } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { supabase } from '@/integrations/supabase/client';

const Discover = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      // First try to load demo profiles for demonstration
      const { data: demoProfiles, error: demoError } = await supabase
        .from('demo_profiles')
        .select('*')
        .limit(10);

      if (demoProfiles && demoProfiles.length > 0) {
        setProfiles(demoProfiles);
      } else {
        // Fallback to mock data if no demo profiles
        setProfiles(mockProfiles);
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
      setProfiles(mockProfiles);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    const currentProfile = profiles[currentIndex];
    
    if (direction === 'right') {
      // Record like
      try {
        await supabase.from('user_connections').insert({
          connected_user_id: currentProfile.id,
          connection_type: 'like'
        });
      } catch (error) {
        console.error('Error recording like:', error);
      }
    }

    setSwipeDirection(direction);
    
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setSwipeDirection(null);
    }, 600);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <div className="heart-logo mx-auto">
              <span className="logo-text">Ò</span>
            </div>
          </div>
          <p className="text-muted-foreground">Finding amazing people for you...</p>
        </div>
      </div>
    );
  }

  if (currentIndex >= profiles.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 text-center space-y-4">
        <div className="heart-logo mb-4">
          <span className="logo-text">Ò</span>
        </div>
        <h2 className="text-2xl font-bold font-afro-heading">That's everyone for now!</h2>
        <p className="text-muted-foreground max-w-md">
          You've seen all available profiles. Check back later for new connections, 
          or expand your search preferences.
        </p>
        <Button 
          onClick={() => {
            setCurrentIndex(0);
            loadProfiles();
          }}
          className="bg-primary hover:bg-primary/90"
        >
          Start Over
        </Button>
      </div>
    );
  }

  const currentProfile = profiles[currentIndex];

  return (
    <div className="max-w-sm mx-auto">
      <div className="relative">
        <Card 
          className={`swipe-card relative overflow-hidden transition-all duration-600 ${
            swipeDirection === 'right' ? 'animate-swipe-right' : 
            swipeDirection === 'left' ? 'animate-swipe-left' : ''
          }`}
        >
          <CardContent className="p-0">
            {/* Profile Image */}
            <div className="relative h-96 bg-gradient-to-br from-primary/20 to-accent/20">
              {currentProfile.profile_photos?.[0] ? (
                <img 
                  src={currentProfile.profile_photos[0]} 
                  alt={currentProfile.display_name}
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
                <VerifiedBadge verified={currentProfile.verified || Math.random() > 0.5} />
                {Math.random() > 0.7 && (
                  <Badge className="bg-green-500 hover:bg-green-600 text-white">
                    Online
                  </Badge>
                )}
              </div>

              {/* Info Button */}
              <Button 
                variant="secondary" 
                size="sm" 
                className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm hover:bg-white/30"
              >
                <Info className="w-4 h-4" />
              </Button>
            </div>

            {/* Profile Info */}
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-2xl font-bold font-afro-heading flex items-center gap-2">
                  {currentProfile.display_name}
                  <span className="text-lg text-muted-foreground font-normal">
                    {currentProfile.age}
                  </span>
                </h3>
                
                {currentProfile.location && (
                  <p className="text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {currentProfile.location}
                  </p>
                )}
              </div>

              {currentProfile.bio && (
                <p className="text-sm leading-relaxed">{currentProfile.bio}</p>
              )}

              {/* Quick Info */}
              <div className="space-y-2">
                {currentProfile.occupation && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span>{currentProfile.occupation}</span>
                  </div>
                )}
                
                {currentProfile.education && (
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <span>{currentProfile.education}</span>
                  </div>
                )}
              </div>

              {/* Interests */}
              {currentProfile.interests && currentProfile.interests.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {currentProfile.interests.slice(0, 4).map((interest: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {interest}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center gap-6 mt-6">
          <Button
            size="lg"
            variant="outline"
            className="w-16 h-16 rounded-full border-2 border-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => handleSwipe('left')}
          >
            <X className="w-8 h-8" />
          </Button>
          
          <Button
            size="lg"
            className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90 pulse-romantic"
            onClick={() => handleSwipe('right')}
          >
            <Heart className="w-8 h-8" />
          </Button>
        </div>

        {/* Profile Counter */}
        <div className="text-center mt-4">
          <p className="text-sm text-muted-foreground">
            {currentIndex + 1} of {profiles.length}
          </p>
        </div>
      </div>
    </div>
  );
};

// Mock data for demonstration
const mockProfiles = [
  {
    id: '1',
    display_name: 'Amara',
    age: 28,
    location: 'Lagos, Nigeria',
    bio: 'Passionate about art, culture, and meaningful connections. Love exploring new places and trying authentic cuisines.',
    occupation: 'Graphic Designer',
    education: 'University Degree',
    interests: ['Art', 'Travel', 'Photography', 'Music', 'Cooking'],
    verified: true,
    profile_photos: ['https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face']
  },
  {
    id: '2', 
    display_name: 'Kwame',
    age: 32,
    location: 'Accra, Ghana',
    bio: 'Entrepreneur with a love for music and community building. Always down for good conversation and dancing.',
    occupation: 'Business Owner',
    education: 'Masters Degree',
    interests: ['Music', 'Dancing', 'Business', 'Community', 'Fitness'],
    verified: true,
    profile_photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face']
  },
  {
    id: '3',
    display_name: 'Zara',
    age: 25,
    location: 'Cape Town, South Africa',
    bio: 'Writer and cultural enthusiast. Exploring the beauty of African stories and traditions.',
    occupation: 'Writer',
    education: 'University Degree',
    interests: ['Writing', 'Culture', 'Literature', 'History', 'Nature'],
    verified: false,
    profile_photos: ['https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=400&h=600&fit=crop&crop=face']
  }
];

export default Discover;