import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MessagingInterface from '@/components/MessagingInterface';
import MatchesSection from '@/components/MatchesSection';
import FriendsSection from '@/components/FriendsSection';
import { MessageCircle, Heart, Users } from 'lucide-react';

const Messages = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('friends');
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  // Handle navigation from profile viewer (Facebook-style messaging)
  useEffect(() => {
    const state = location.state as any;
    if (state?.selectedUser) {
      setSelectedMatch(state.selectedUser);
      setActiveTab('messages');
    }
  }, [location.state]);

  const handleStartConversation = (matchId: string) => {
    setSelectedMatch(matchId);
    setActiveTab('messages');
  };

  const handleStartChat = (friendId: string) => {
    setSelectedMatch(friendId);
    setActiveTab('messages');
  };

  return (
    <div className="h-screen bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="border-b border-border px-4 pt-4">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="friends" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="matches" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Matches
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Messages
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="friends" className="flex-1 p-4 m-0">
          <FriendsSection onStartChat={handleStartChat} />
        </TabsContent>

        <TabsContent value="matches" className="flex-1 p-4 m-0">
          <MatchesSection onStartConversation={handleStartConversation} />
        </TabsContent>

        <TabsContent value="messages" className="flex-1 m-0">
          <MessagingInterface 
            selectedUserId={selectedMatch}
            onBack={() => setActiveTab('friends')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Messages;