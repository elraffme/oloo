import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MessagingInterface from '@/components/MessagingInterface';
import MatchesSection from '@/components/MatchesSection';
import FriendsSection from '@/components/FriendsSection';
import { MessageCircle, Heart, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Messages = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('friends');
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  // Handle navigation from profile viewer (Facebook-style messaging)
  useEffect(() => {
    const state = location.state as any;
    const directId = 
      state?.selectedUser || 
      state?.selectedUserId || 
      state?.userId || 
      state?.newConversation;
    if (directId) {
      setSelectedMatch(directId);
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
    <div className="h-screen bg-background overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="border-b border-border px-2 pt-2 md:px-4 md:pt-4">
          <TabsList className="grid w-full grid-cols-3 h-10 md:h-11 max-w-lg">
            <TabsTrigger value="friends" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2">
              <Users className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden xs:inline">{t('messages.friends')}</span>
            </TabsTrigger>
            <TabsTrigger value="matches" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2">
              <Heart className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden xs:inline">{t('messages.matches')}</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2">
              <MessageCircle className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden xs:inline">{t('messages.title')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="friends" className="flex-1 p-2 md:p-4 m-0 overflow-auto">
          <FriendsSection onStartChat={handleStartChat} />
        </TabsContent>

        <TabsContent value="matches" className="flex-1 p-2 md:p-4 m-0 overflow-auto">
          <MatchesSection onStartConversation={handleStartConversation} />
        </TabsContent>

        <TabsContent value="messages" className="flex-1 m-0 overflow-hidden">
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