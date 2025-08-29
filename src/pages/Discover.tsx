import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ProfileCard } from '@/components/ProfileCard';
import { MatchModal } from '@/components/MatchModal';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

const Discover = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchModal, setMatchModal] = useState<{ isOpen: boolean; profile: any | null }>({
    isOpen: false,
    profile: null
  });

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

  const handleSuperLike = async () => {
    const currentProfile = profiles[currentIndex];
    
    try {
      // Record super like (treat as special like)
      const { error } = await supabase.from('user_connections').insert({
        connected_user_id: currentProfile.id,
        connection_type: 'super_like'
      });

      if (error && error.code !== '23505') {
        throw error;
      }

      toast({
        title: "Super Like sent! ⭐",
        description: `You super liked ${currentProfile.display_name}!`,
      });

      setSwipeDirection('right');
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setSwipeDirection(null);
      }, 600);
    } catch (error) {
      console.error('Error recording super like:', error);
      toast({
        title: "Error",
        description: "Failed to send super like. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      toast({
        title: "Undone",
        description: "Went back to previous profile",
      });
    }
  };

  const handleBoost = () => {
    toast({
      title: "Boost feature coming soon! 🚀",
      description: "This feature will increase your profile visibility.",
    });
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    const currentProfile = profiles[currentIndex];
    
    if (direction === 'right') {
      // Record like and check for mutual match
      try {
        // First, record the like
        const { error } = await supabase.from('user_connections').insert({
          connected_user_id: currentProfile.id,
          connection_type: 'like'
        });

        if (error && error.code !== '23505') { // Ignore duplicate key errors
          throw error;
        }

        // Check if this creates a mutual match
        const { data: user } = await supabase.auth.getUser();
        if (user?.user?.id) {
          const { data: isMatch, error: matchError } = await supabase
            .rpc('check_mutual_match', {
              user1_id: user.user.id,
              user2_id: currentProfile.id
            });

          if (matchError) {
            console.error('Error checking match:', matchError);
          }

          if (isMatch) {
            setTimeout(() => {
              setMatchModal({ isOpen: true, profile: currentProfile });
            }, 700);
          } else {
            toast({
              title: "Profile liked! 💖",
              description: `You liked ${currentProfile.display_name}. If they like you back, you'll get a match!`,
            });
          }
        }
      } catch (error) {
        console.error('Error recording like:', error);
        toast({
          title: "Error",
          description: "Failed to record like. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // Record dislike/pass
      try {
        await supabase.from('user_connections').insert({
          connected_user_id: currentProfile.id,
          connection_type: 'pass'
        });
      } catch (error) {
        if (error.code !== '23505') { // Ignore duplicate key errors
          console.error('Error recording pass:', error);
        }
      }
    }

    setSwipeDirection(direction);
    
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setSwipeDirection(null);
    }, 600);
  };

  const handleMessage = (profileId: string) => {
    // Create or navigate to conversation with this profile
    console.log(`Starting conversation with profile ${profileId}`);
    navigate('/app/messages', { state: { newConversation: profileId } });
  };

  const handleSendMessage = (profileId: string, message: string) => {
    console.log(`Sending message to ${profileId}: ${message}`);
    navigate('/app/messages', { 
      state: { 
        newConversation: profileId,
        initialMessage: message 
      } 
    });
    
    toast({
      title: "Message sent! 💬",
      description: "Your message has been sent successfully.",
    });
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
          onSuperLike={handleSuperLike}
          onUndo={currentIndex > 0 ? handleUndo : undefined}
          onBoost={handleBoost}
          onMessage={() => handleMessage(currentProfile.id)}
          swipeDirection={swipeDirection}
        />

        {/* Profile Counter */}
        <div className="text-center mt-4">
          <p className="text-sm text-muted-foreground">
            {currentIndex + 1} of {profiles.length}
          </p>
        </div>
      </div>

      {/* Match Modal */}
      <MatchModal
        isOpen={matchModal.isOpen}
        onClose={() => setMatchModal({ isOpen: false, profile: null })}
        matchedProfile={matchModal.profile}
        onSendMessage={handleSendMessage}
      />
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
      bio: 'Passionate about art, culture, and meaningful connections. Love exploring new places and trying authentic cuisines. Always up for spontaneous adventures and deep conversations over coffee.',
      occupation: 'Creative Director',
      education: 'Bachelor of Fine Arts',
      interests: ['Art', 'Travel', 'Photography', 'Music', 'Cooking', 'Cultural Events'],
      verified: true,
      height_cm: 165,
      languages: ['English', 'Yoruba', 'French'],
      personality: 'ENFP',
      relationship_goals: 'Looking for someone who shares my passion for creativity and adventure. I believe in building meaningful connections based on mutual respect and shared experiences.',
      profile_photos: [
        'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=600&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1595959183082-7b570b7e08e2?w=400&h=600&fit=crop&crop=face'
      ]
    },
    {
      id: '2', 
      display_name: 'Kwame',
      age: 32,
      location: 'Accra, Ghana',
      bio: 'Entrepreneur with a love for music and community building. Always down for good conversation and dancing. Building something meaningful in the tech space while staying connected to my roots.',
      occupation: 'Tech Entrepreneur',
      education: 'MBA, Computer Science',
      interests: ['Music', 'Dancing', 'Business', 'Community', 'Fitness', 'Afrobeats'],
      verified: true,
      height_cm: 182,
      languages: ['English', 'Twi', 'French'],
      personality: 'ENTJ',
      relationship_goals: 'Seeking a partner who is ambitious, family-oriented, and shares my vision for making a positive impact. Love is partnership in every sense.',
      profile_photos: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=400&h=600&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1615109398623-88346a601842?w=400&h=600&fit=crop&crop=face'
      ]
    },
    {
      id: '3',
      display_name: 'Zara',
      age: 25,
      location: 'Cape Town, South Africa',
      bio: 'Writer and cultural enthusiast. Exploring the beauty of African stories and traditions through my writing. Poetry is my love language, and I find magic in everyday moments.',
      occupation: 'Author & Journalist',
      education: 'Masters in Literature',
      interests: ['Writing', 'Culture', 'Literature', 'History', 'Nature', 'Poetry'],
      verified: false,
      height_cm: 158,
      languages: ['English', 'Afrikaans', 'Xhosa'],
      personality: 'INFP',
      relationship_goals: 'Looking for someone who appreciates depth, creativity, and authentic connection. I value emotional intelligence and shared growth.',
      profile_photos: [
        'https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=400&h=600&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=400&h=600&fit=crop&crop=face'
      ]
    },
    {
      id: '4',
      display_name: 'Kofi',
      age: 29,
      location: 'Nairobi, Kenya',
      bio: 'Wildlife photographer and conservation enthusiast. Spent the last 5 years documenting the beauty of East African wildlife. When I\'m not behind the camera, you\'ll find me hiking or trying new restaurants.',
      occupation: 'Wildlife Photographer',
      education: 'Bachelors in Environmental Science',
      interests: ['Photography', 'Wildlife', 'Conservation', 'Hiking', 'Travel', 'Documentary'],
      verified: true,
      height_cm: 177,
      languages: ['English', 'Swahili', 'Spanish'],
      personality: 'ISFP',
      relationship_goals: 'Seeking someone who loves adventure and has a passion for making the world a better place. Let\'s explore life together!',
      profile_photos: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=400&h=600&fit=crop&crop=face'
      ]
    },
    {
      id: '5',
      display_name: 'Asha',
      age: 26,
      location: 'Addis Ababa, Ethiopia',
      bio: 'Doctor by day, dancer by night! Working in pediatrics and passionate about community health. Love traditional Ethiopian coffee ceremonies and modern dance. Life is about balance and joy.',
      occupation: 'Pediatrician',
      education: 'Medical Degree',
      interests: ['Medicine', 'Dancing', 'Coffee', 'Community Health', 'Traditional Music', 'Fitness'],
      verified: true,
      height_cm: 162,
      languages: ['Amharic', 'English', 'French'],
      personality: 'ESFJ',
      relationship_goals: 'Looking for someone kind, family-oriented, and supportive. I believe in growing together and supporting each other\'s dreams.',
      profile_photos: [
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=600&fit=crop&crop=face'
      ]
    }
];

export default Discover;