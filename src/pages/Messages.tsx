import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MessagingInterface from '@/components/MessagingInterface';
import MatchesSection from '@/components/MatchesSection';
import FriendsSection from '@/components/FriendsSection';
import { MessageCircle, Heart, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const Messages = () => {
  const location = useLocation();
  const { t } = useLanguage();
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
    console.log('Starting conversation with match:', matchId);
    setSelectedMatch(matchId);
    setActiveTab('messages');
  };

  const handleStartChat = (friendId: string) => {
    console.log('Starting chat with friend:', friendId);
    setSelectedMatch(friendId);
    setActiveTab('messages');
  };

  const handleBackFromMessages = () => {
    setSelectedMatch(null);
    // Return to the previous tab (matches or friends)
    if (activeTab === 'messages') {
      setActiveTab('matches');
    }
  };

  return (
    <div className="flex flex-col max-h-[calc(100vh-8rem)] md:max-h-[calc(100vh-5rem)]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="border-b border-border px-2 py-2">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="friends" className="flex items-center gap-2 text-xs md:text-sm">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{t('friends')}</span>
            </TabsTrigger>
            <TabsTrigger value="matches" className="flex items-center gap-2 text-xs md:text-sm">
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">{t('matches')}</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2 text-xs md:text-sm">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t('messages')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="friends" className="flex-1 p-2 m-0 overflow-auto">
          <FriendsSection onStartChat={handleStartChat} />
        </TabsContent>

        <TabsContent value="matches" className="flex-1 p-2 m-0 overflow-auto">
          <MatchesSection onStartConversation={handleStartConversation} />
        </TabsContent>

        <TabsContent value="messages" className="flex-1 m-0 overflow-hidden">
          <MessagingInterface 
            selectedUserId={selectedMatch}
            onBack={handleBackFromMessages}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Messages;