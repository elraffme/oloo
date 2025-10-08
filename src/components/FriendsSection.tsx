import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Clock, Check, X, Users } from 'lucide-react';
import { getUserFriends, getFriendRequests, acceptFriendRequest, rejectFriendRequest, Friend, FriendRequest } from '@/utils/friendsUtils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePresenceContext } from '@/contexts/PresenceContext';
import { OnlineStatusBadge } from '@/components/OnlineStatusBadge';

interface FriendsSectionProps {
  onStartChat: (friendId: string) => void;
}

interface AllUser {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  profile_photos?: string[];
  location?: string;
  age?: number;
  bio?: string;
  is_friend?: boolean;
}

const FriendsSection = ({ onStartChat }: FriendsSectionProps) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isUserOnline } = usePresenceContext();

  useEffect(() => {
    loadData();
  }, []);

  // Set up real-time listener for friend requests
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('friend-requests-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_connections',
          filter: `connected_user_id=eq.${user.id}`
        },
        (payload) => {
          const newConnection = payload.new as any;
          
          // If it's a friend request, update the friend requests list
          if (newConnection.connection_type === 'friend_request') {
            console.log('New friend request received:', newConnection);
            
            // Fetch the requester's profile and add to friend requests
            fetchRequesterProfile(newConnection.user_id, newConnection.created_at);
            
            // Show notification
            toast({
              title: "New Friend Request!",
              description: "You have received a new friend request.",
            });
          }
          
          // If it's a friend acceptance, refresh data
          if (newConnection.connection_type === 'friend') {
            console.log('Friend request accepted:', newConnection);
            loadData(); // Refresh all data
            
            toast({
              title: "Friend Request Accepted!",
              description: "Someone accepted your friend request.",
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_connections',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedConnection = payload.new as any;
          
          // If a friend request was accepted, refresh data
          if (updatedConnection.connection_type === 'friend') {
            console.log('Your friend request was accepted:', updatedConnection);
            loadData(); // Refresh all data
            
            toast({
              title: "Friend Request Accepted!",
              description: "Your friend request was accepted!",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  // Fetch requester profile when new friend request arrives
  const fetchRequesterProfile = async (requesterId: string, requestDate: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, profile_photos')
        .eq('user_id', requesterId)
        .single();

      if (error || !profile) {
        console.error('Error fetching requester profile:', error);
        return;
      }

      const newRequest: FriendRequest = {
        requester_user_id: profile.user_id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        profile_photos: profile.profile_photos,
        request_date: requestDate
      };

      // Add to friend requests list
      setFriendRequests(prev => [newRequest, ...prev]);
    } catch (error) {
      console.error('Error fetching requester profile:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [friendsData, requestsData, allUsersData] = await Promise.all([
        getUserFriends(),
        getFriendRequests(),
        loadAllUsers()
      ]);
      setFriends(friendsData);
      setFriendRequests(requestsData);
      setAllUsers(allUsersData);
    } catch (error) {
      console.error('Error loading friends data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async (): Promise<AllUser[]> => {
    if (!user) return [];

    try {
      // Get all real users (not demo profiles) except current user
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, profile_photos, location, age, bio')
        .eq('is_demo_profile', false)
        .neq('user_id', user.id)
        .limit(100);

      if (error) throw error;

      // Get current user's friends to mark them
      const friendIds = new Set(friends.map(friend => friend.friend_user_id));

      return (profiles || []).map(profile => ({
        ...profile,
        is_friend: friendIds.has(profile.user_id)
      }));
    } catch (error) {
      console.error('Error loading all users:', error);
      return [];
    }
  };

  const handleAcceptRequest = async (requesterId: string) => {
    console.log('Accept button clicked for requesterId:', requesterId);
    
    // Find the request to get user details
    const request = friendRequests.find(req => req.requester_user_id === requesterId);
    if (!request) return;
    
    // Optimistically update UI - remove from requests and add to friends immediately
    setFriendRequests(prev => prev.filter(req => req.requester_user_id !== requesterId));
    
    const newFriend: Friend = {
      friend_user_id: request.requester_user_id,
      display_name: request.display_name,
      avatar_url: request.avatar_url,
      profile_photos: request.profile_photos,
      friend_since: new Date().toISOString()
    };
    
    setFriends(prev => [newFriend, ...prev]);
    
    // Show immediate success feedback
    toast({
      title: "Friend request accepted! ✅",
      description: `You and ${request.display_name} are now friends and can start chatting.`,
    });
    
    try {
      console.log('Calling acceptFriendRequest...');
      const result = await acceptFriendRequest(requesterId);
      console.log('acceptFriendRequest result:', result);
      
      if (!result.success) {
        // If API call fails, revert the optimistic update
        setFriendRequests(prev => [request, ...prev]);
        setFriends(prev => prev.filter(f => f.friend_user_id !== requesterId));
        
        toast({
          title: "Error",
          description: result.message || "Failed to accept friend request",
          variant: "destructive",
        });
      } else {
        // Refresh to ensure data consistency
        loadData();
      }
    } catch (error) {
      // If error occurs, revert the optimistic update
      setFriendRequests(prev => [request, ...prev]);
      setFriends(prev => prev.filter(f => f.friend_user_id !== requesterId));
      
      console.error('Error in handleAcceptRequest:', error);
      toast({
        title: "Error", 
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRejectRequest = async (requesterId: string) => {
    // Find the request to get user details
    const request = friendRequests.find(req => req.requester_user_id === requesterId);
    if (!request) return;
    
    // Optimistically update UI - remove from requests immediately
    setFriendRequests(prev => prev.filter(req => req.requester_user_id !== requesterId));
    
    // Show immediate feedback
    toast({
      title: "Friend request declined",
      description: `You declined ${request.display_name}'s friend request.`,
    });
    
    try {
      const result = await rejectFriendRequest(requesterId);
      
      if (!result.success) {
        // If API call fails, revert the optimistic update
        setFriendRequests(prev => [request, ...prev]);
        
        toast({
          title: "Error",
          description: result.message || "Failed to decline friend request",
          variant: "destructive",
        });
      }
    } catch (error) {
      // If error occurs, revert the optimistic update
      setFriendRequests(prev => [request, ...prev]);
      
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getAvatarUrl = (item: Friend | FriendRequest | AllUser) => {
    if (item.profile_photos && item.profile_photos.length > 0) {
      return item.profile_photos[0];
    }
    return item.avatar_url || '/placeholder.svg';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Friend Requests */}
      {friendRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Friend Requests
            <Badge variant="default" className="bg-primary">{friendRequests.length}</Badge>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {friendRequests.map((request) => (
              <Card key={request.requester_user_id} className="hover:shadow-lg transition-all duration-300 border-primary/20">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4">
                    {/* Profile Section */}
                    <div className="flex items-center gap-3">
                      <Avatar className="w-16 h-16 ring-2 ring-primary/20">
                        <AvatarImage src={getAvatarUrl(request)} />
                        <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
                          {request.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base">{request.display_name}</h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(request.request_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: new Date(request.request_date).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                          })}
                        </p>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAcceptRequest(request.requester_user_id)}
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md transition-all duration-300"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Accept
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => handleRejectRequest(request.requester_user_id)}
                        className="flex-1 hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-all duration-300"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Friends
          <Badge variant="secondary">{friends.length}</Badge>
        </h3>
        
        {friends.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No friends yet. Start adding friends to begin chatting!</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {friends.map((friend) => (
              <Card key={friend.friend_user_id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={getAvatarUrl(friend)} />
                        <AvatarFallback>
                          {friend.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1">
                        <OnlineStatusBadge userId={friend.friend_user_id} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium flex items-center gap-2">
                        {friend.display_name}
                        <OnlineStatusBadge 
                          userId={friend.friend_user_id} 
                          showDot={false} 
                          showText={true}
                          className="text-xs"
                        />
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Friends since {new Date(friend.friend_since).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => onStartChat(friend.friend_user_id)}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Chat
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* All Users Available for Chat */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Users className="w-5 h-5" />
          All Users
          <Badge variant="secondary">{allUsers.length}</Badge>
        </h3>
        
        {allUsers.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No other users found.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allUsers.map((user) => (
              <Card key={user.user_id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={getAvatarUrl(user)} />
                        <AvatarFallback>
                          {user.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1">
                        <OnlineStatusBadge userId={user.user_id} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{user.display_name}</h4>
                      <div className="flex items-center gap-2 text-sm">
                        <OnlineStatusBadge 
                          userId={user.user_id} 
                          showDot={false} 
                          showText={true}
                        />
                        {user.is_friend && (
                          <Badge variant="outline" className="text-xs">Friend</Badge>
                        )}
                      </div>
                      {user.location && (
                        <p className="text-xs text-muted-foreground">{user.location}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => onStartChat(user.user_id)}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsSection;