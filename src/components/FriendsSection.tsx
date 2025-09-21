import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Clock, Check, X, Users, Circle } from 'lucide-react';
import { getUserFriends, getFriendRequests, acceptFriendRequest, rejectFriendRequest, Friend, FriendRequest } from '@/utils/friendsUtils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePresence } from '@/hooks/usePresence';

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
  const { isUserOnline } = usePresence();

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
    try {
      console.log('Calling acceptFriendRequest...');
      const result = await acceptFriendRequest(requesterId);
      console.log('acceptFriendRequest result:', result);
      
      if (result.success) {
        toast({
          title: "Friend request accepted! ✅",
          description: "You are now friends and can start chatting.",
        });
        loadData(); // Refresh the data
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to accept friend request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error in handleAcceptRequest:', error);
      toast({
        title: "Error", 
        description: "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const handleRejectRequest = async (requesterId: string) => {
    try {
      const result = await rejectFriendRequest(requesterId);
      if (result.success) {
        toast({
          title: "Friend request rejected",
          description: "The friend request has been declined.",
        });
        loadData(); // Refresh the data
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to reject friend request",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong",
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
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Friend Requests
            <Badge variant="secondary">{friendRequests.length}</Badge>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {friendRequests.map((request) => (
              <Card key={request.requester_user_id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={getAvatarUrl(request)} />
                      <AvatarFallback>
                        {request.display_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-medium">{request.display_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(request.request_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptRequest(request.requester_user_id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRejectRequest(request.requester_user_id)}
                        className="hover:bg-red-50 hover:border-red-300"
                      >
                        <X className="w-4 h-4" />
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
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={getAvatarUrl(friend)} />
                      <AvatarFallback>
                        {friend.display_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-medium">{friend.display_name}</h4>
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
                      {/* Online status indicator */}
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${
                        isUserOnline(user.user_id) 
                          ? 'bg-green-500' 
                          : 'bg-gray-400'
                      }`}>
                        <Circle className="w-2 h-2 fill-current" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{user.display_name}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className={isUserOnline(user.user_id) ? 'text-green-500' : 'text-gray-400'}>
                          {isUserOnline(user.user_id) ? 'Online' : 'Offline'}
                        </span>
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