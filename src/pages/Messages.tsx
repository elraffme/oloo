import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MessagingInterface from '@/components/MessagingInterface';
import MatchesSection from '@/components/MatchesSection';
import { MessageCircle, Heart } from 'lucide-react';

const Messages = () => {
  const [activeTab, setActiveTab] = useState('matches');
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

  const handleStartConversation = (matchId: string) => {
    setSelectedMatch(matchId);
    setActiveTab('messages');
  };

  return (
    <div className="h-screen bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="border-b border-border px-4 pt-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
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

        <TabsContent value="matches" className="flex-1 p-4 m-0">
          <MatchesSection onStartConversation={handleStartConversation} />
        </TabsContent>

        <TabsContent value="messages" className="flex-1 m-0">
          <MessagingInterface 
            onBack={() => setActiveTab('matches')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Messages;