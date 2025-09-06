import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Clock, Check, X } from 'lucide-react';
import { getUserFriends, getFriendRequests, acceptFriendRequest, Friend, FriendRequest } from '@/utils/friendsUtils';
import { useToast } from '@/components/ui/use-toast';

interface FriendsSectionProps {
  onStartChat: (friendId: string) => void;
}

const FriendsSection = ({ onStartChat }: FriendsSectionProps) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [friendsData, requestsData] = await Promise.all([
        getUserFriends(),
        getFriendRequests()
      ]);
      setFriends(friendsData);
      setFriendRequests(requestsData);
    } catch (error) {
      console.error('Error loading friends data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requesterId: string) => {
    try {
      const result = await acceptFriendRequest(requesterId);
      if (result.success) {
        toast({
          title: "Friend request accepted!",
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
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      });
    }
  };

  const getAvatarUrl = (friend: Friend | FriendRequest) => {
    if (friend.profile_photos && friend.profile_photos.length > 0) {
      return friend.profile_photos[0];
    }
    return friend.avatar_url || '/placeholder.svg';
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
                      <Button size="sm" variant="outline">
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
    </div>
  );
};

export default FriendsSection;