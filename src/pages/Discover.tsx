import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ProfileCard } from '@/components/ProfileCard';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const Discover = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      // SECURITY: Use paginated function to prevent mass data scraping
      const { data: demoProfiles, error: demoError } = await supabase
        .rpc('get_demo_profiles_paginated', {
          page_size: 10,
          page_offset: 0
        });

      if (demoProfiles && demoProfiles.length > 0) {
        setProfiles(demoProfiles);
      } else {
        // Fallback to mock data if no demo profiles
        setProfiles(mockProfiles);
      }
    } catch (error) {
      // SECURITY: Don't expose internal errors to users
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

  const handleMessage = () => {
    navigate('/app/messages');
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
        <ProfileCard
          profile={currentProfile}
          onSwipe={handleSwipe}
          onMessage={handleMessage}
          swipeDirection={swipeDirection}
        />

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