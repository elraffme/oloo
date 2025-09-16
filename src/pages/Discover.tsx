import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ProfileCard } from '@/components/ProfileCard';
import { MatchModal } from '@/components/MatchModal';
import { PublicProfileViewer } from '@/components/PublicProfileViewer';
import { SearchBar } from '@/components/SearchBar';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { sendFriendRequest } from '@/utils/friendsUtils';
import { useAuth } from '@/contexts/AuthContext';

const Discover = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchModal, setMatchModal] = useState<{ isOpen: boolean; profile: any | null }>({
    isOpen: false,
    profile: null
  });
  const [profileViewerModal, setProfileViewerModal] = useState<{ isOpen: boolean; profileId: string | null }>({
    isOpen: false,
    profileId: null
  });
  const [searchMode, setSearchMode] = useState(false);
  const [searchedProfile, setSearchedProfile] = useState<any>(null);
  const [friendRequestStates, setFriendRequestStates] = useState<Record<string, 'idle' | 'loading' | 'sent' | 'friends' | 'error'>>({});
  const [loadingNext, setLoadingNext] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);

  // Helpers for interaction validation
  const isValidUuid = (id: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
  const getTargetUserId = (profile: any) => (profile?.user_id && isValidUuid(profile.user_id)) ? (profile.user_id as string) : null;

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async (append = false) => {
    try {
      if (append) setLoadingNext(true);

      const currentOffset = append ? pageOffset : 0;
      
      // Get current user to exclude them from discovery
      const { data: currentUser } = await supabase.auth.getUser();
      
      // Load both verified user profiles and demo profiles
      const [realProfilesRes, demoProfilesRes] = await Promise.allSettled([
        supabase
          .from('profiles')
          .select('*')
          .eq('is_demo_profile', false)
          .neq('user_id', currentUser?.user?.id || '') // Exclude current user
          .range(currentOffset, currentOffset + 19)
          .limit(20),
        supabase.rpc('get_demo_profiles_paginated', {
          page_size: 10,
          page_offset: Math.floor(currentOffset / 2)
        })
      ]);

      let newProfiles: any[] = [];

      // Add real verified profiles
      if (realProfilesRes.status === 'fulfilled' && realProfilesRes.value.data) {
        newProfiles = [...newProfiles, ...realProfilesRes.value.data];
      }

      // Add demo profiles
      if (demoProfilesRes.status === 'fulfilled' && demoProfilesRes.value && Array.isArray(demoProfilesRes.value)) {
        newProfiles = [...newProfiles, ...demoProfilesRes.value];
      }

      // Shuffle the new profiles for variety
      const shuffledNewProfiles = newProfiles.sort(() => Math.random() - 0.5);

      if (append) {
        // Append to existing profiles
        if (shuffledNewProfiles.length > 0) {
          setProfiles(prev => [...prev, ...shuffledNewProfiles]);
          setPageOffset(prev => prev + 20);
          toast({
            title: "More profiles loaded! 🎉",
            description: `Found ${shuffledNewProfiles.length} more people for you to meet.`,
          });
        } else {
          toast({
            title: "No more profiles",
            description: "You've seen all available profiles for now. Check back later!",
          });
        }
      } else {
        // Initial load
        if (shuffledNewProfiles.length > 0) {
          setProfiles(shuffledNewProfiles);
          setPageOffset(20);
        } else {
          // Fallback to mock data if no profiles
          setProfiles(mockProfiles);
        }
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
      if (!append) {
        setProfiles(mockProfiles);
      } else {
        toast({
          title: "Error",
          description: "Failed to load more profiles. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      setLoadingNext(false);
    }
  };

  const handleSuperLike = async () => {
    const currentProfile = profiles[currentIndex];
    
    console.log('Super liking profile:', currentProfile.id);
    
    try {
      // Record super like (treat as special like)
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to use Super Like.",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      const targetUserId = getTargetUserId(currentProfile);
      if (!targetUserId) {
        toast({
          title: "Demo profile",
          description: "Interactions are disabled for demo profiles.",
        });
        return;
      }

      const { error } = await supabase.from('user_connections').insert({
        user_id: user.id,
        connected_user_id: targetUserId,
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

  const handleViewProfile = (profileId: string) => {
    setProfileViewerModal({ isOpen: true, profileId });
  };

  const handleBoost = () => {
    toast({
      title: "Boost feature coming soon! 🚀",
      description: "This feature will increase your profile visibility.",
    });
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    const currentProfile = profiles[currentIndex];
    
    console.log('Swiping:', direction, 'on profile:', currentProfile.id);
    
    if (direction === 'right') {
      // Record like and check for mutual match
      try {
        // First, record the like
        if (!user) {
          toast({ title: "Authentication Required", description: "Please sign in to like profiles.", variant: "destructive" });
          navigate('/auth');
          return;
        }
        const targetUserId = getTargetUserId(currentProfile);
        if (!targetUserId) {
          toast({ title: "Demo profile", description: "Likes are disabled for demo profiles." });
          return;
        }
        const { error } = await supabase.from('user_connections').insert({
          user_id: user.id,
          connected_user_id: targetUserId,
          connection_type: 'like'
        });

        if (error && error.code !== '23505') { // Ignore duplicate key errors
          throw error;
        }

        // Check if this creates a mutual match
          const { data: authUser } = await supabase.auth.getUser();
          if (authUser?.user?.id) {
            const { data: isMatch, error: matchError } = await supabase
              .rpc('check_mutual_match', {
                user1_id: authUser.user.id,
                user2_id: targetUserId
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
        if (!user) {
          toast({ title: "Authentication Required", description: "Please sign in to continue.", variant: "destructive" });
          navigate('/auth');
          return;
        }
        const targetUserId = getTargetUserId(currentProfile);
        if (!targetUserId) return;
        await supabase.from('user_connections').insert({
          user_id: user.id,
          connected_user_id: targetUserId,
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
    console.log(`Starting conversation with profile ${profileId}`);
    if (!isValidUuid(profileId)) {
      toast({ title: "Demo profile", description: "Messaging is only available with real users." });
      return;
    }
    navigate('/app/messages', { state: { selectedUser: profileId, newConversation: profileId } });
  };

  const handleStartChat = (userId: string) => {
    navigate('/app/messages', { state: { selectedUser: userId } });
  };

  const handleSendMessage = (profileId: string, message: string) => {
    console.log(`Sending message to ${profileId}: ${message}`);
    if (!isValidUuid(profileId)) {
      toast({ title: "Demo profile", description: "Messaging is only available with real users." });
      return;
    }
    navigate('/app/messages', { 
      state: { 
        newConversation: profileId,
        initialMessage: message 
      } 
    });
    toast({ title: "Message sent! 💬", description: "Your message has been sent successfully." });
  };

  const handleAddFriend = async () => {
    const currentProfile = profiles[currentIndex];
    const targetUserId = getTargetUserId(currentProfile);
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to add friends.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }
    
    if (!targetUserId) {
      toast({ title: "Demo profile", description: "You can only add real users as friends." });
      return;
    }

    // Set loading state
    setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'loading' }));
    
    try {
      const result = await sendFriendRequest(targetUserId);
      
      if (result.success) {
        if (result.type === 'accepted') {
          setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'friends' }));
          toast({
            title: "Now Friends! 🎉",
            description: `You and ${currentProfile.display_name} are now friends!`,
          });
        } else {
          setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'sent' }));
          toast({
            title: "Friend Request Sent! 👋",
            description: `Friend request sent to ${currentProfile.display_name}`,
          });
        }
      } else {
        setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'error' }));
        toast({
          title: "Info",
          description: result.message,
        });
        // Reset to idle after 3 seconds for retry
        setTimeout(() => {
          setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'idle' }));
        }, 3000);
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'error' }));
      toast({
        title: "Error",
        description: "Failed to send friend request. Please try again.",
        variant: "destructive",
      });
      // Reset to idle after 3 seconds for retry
      setTimeout(() => {
        setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'idle' }));
      }, 3000);
    }
  };

  const handleSearchSelect = (profile: any) => {
    setSearchedProfile(profile);
    setSearchMode(true);
  };

  const exitSearchMode = () => {
    setSearchMode(false);
    setSearchedProfile(null);
  };

  const getCurrentProfile = () => {
    return searchMode ? searchedProfile : profiles[currentIndex];
  };

  const handleSearchAddFriend = async () => {
    if (!searchedProfile) return;
    const targetUserId = getTargetUserId(searchedProfile);
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to add friends.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }
    
    if (!targetUserId) {
      toast({ title: "Demo profile", description: "You can only add real users as friends." });
      return;
    }

    // Set loading state
    setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'loading' }));
    
    try {
      const result = await sendFriendRequest(targetUserId);
      
      if (result.success) {
        if (result.type === 'accepted') {
          setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'friends' }));
          toast({
            title: "Now Friends! 🎉",
            description: `You and ${searchedProfile.display_name} are now friends!`,
          });
        } else {
          setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'sent' }));
          toast({
            title: "Friend Request Sent! 👋",
            description: `Friend request sent to ${searchedProfile.display_name}`,
          });
        }
      } else {
        setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'error' }));
        toast({
          title: "Info",
          description: result.message,
        });
        // Reset to idle after 3 seconds for retry
        setTimeout(() => {
          setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'idle' }));
        }, 3000);
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'error' }));
      toast({
        title: "Error",
        description: "Failed to send friend request. Please try again.",
        variant: "destructive",
      });
      // Reset to idle after 3 seconds for retry
      setTimeout(() => {
        setFriendRequestStates(prev => ({ ...prev, [targetUserId]: 'idle' }));
      }, 3000);
    }
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
  const targetUserId = getTargetUserId(currentProfile);

  return (
    <div className="max-w-sm mx-auto">
      {/* Search Bar */}
      <div className="mb-6 px-4">
        <SearchBar 
          onSelectProfile={handleSearchSelect}
          className="mx-auto"
        />
      </div>

      {/* Search Mode Header */}
      {searchMode && searchedProfile && (
        <div className="mb-4 px-4">
          <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <span className="text-primary font-medium">Search Result:</span>
              <span className="font-semibold">{searchedProfile.display_name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={exitSearchMode}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      <div className="relative">
        <ProfileCard
          profile={getCurrentProfile()}
          onSwipe={searchMode ? undefined : handleSwipe}
          onSuperLike={searchMode ? undefined : handleSuperLike}
          onUndo={searchMode ? undefined : (currentIndex > 0 ? handleUndo : undefined)}
          onBoost={searchMode ? undefined : handleBoost}
          onMessage={() => handleMessage(getTargetUserId(getCurrentProfile()) || '')}
          onAddFriend={searchMode ? handleSearchAddFriend : handleAddFriend}
          friendRequestState={friendRequestStates[getTargetUserId(getCurrentProfile()) || ''] || 'idle'}
          swipeDirection={searchMode ? null : swipeDirection}
        />

        {/* Profile Counter and Next Button - Only show in browse mode */}
        {!searchMode && (
          <div className="text-center mt-6 space-y-3">
            <p className="text-xs text-muted-foreground">
              {currentIndex + 1} of {profiles.length}
            </p>
            
            {/* Next Profile Button */}
            <div className="flex justify-center">
              {currentIndex < profiles.length - 1 ? (
                <Button
                  onClick={() => {
                    setSwipeDirection('right');
                    setTimeout(() => {
                      setCurrentIndex(prev => prev + 1);
                      setSwipeDirection(null);
                    }, 600);
                  }}
                  size="sm"
                  variant="secondary"
                  className="px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-200 text-sm border border-border"
                  disabled={loadingNext}
                >
                  Next Profile →
                </Button>
              ) : (
                <Button
                  onClick={() => loadProfiles(true)}
                  disabled={loadingNext}
                  size="sm"
                  variant="outline"
                  className="px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-200 text-sm border border-border"
                >
                  {loadingNext ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent animate-spin rounded-full" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Match Modal */}
      <MatchModal
        isOpen={matchModal.isOpen}
        onClose={() => setMatchModal({ isOpen: false, profile: null })}
        matchedProfile={matchModal.profile}
        onSendMessage={handleSendMessage}
      />
      {/* Public Profile Viewer */}
      <PublicProfileViewer 
        profileId={profileViewerModal.profileId || ''}
        isOpen={profileViewerModal.isOpen}
        onClose={() => setProfileViewerModal({ isOpen: false, profileId: null })}
        onSwipe={handleSwipe}
        onStartChat={handleStartChat}
      />
    </div>
  );
};

// Mock data for demonstration
const mockProfiles = [
    {
      id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
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
      id: 'b2c3d4e5-f6g7-8901-2345-678901bcdefg', 
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
      id: 'c3d4e5f6-g7h8-9012-3456-789012cdefgh',
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
      id: 'd4e5f6g7-h8i9-0123-4567-890123defghi',
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
      id: 'e5f6g7h8-i9j0-1234-5678-901234efghij',
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