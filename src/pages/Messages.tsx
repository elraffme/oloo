import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Send, 
  Heart, 
  Gift, 
  Image, 
  Video,
  Search,
  MoreVertical,
  Shield
} from 'lucide-react';

const Messages = () => {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  const conversations = [
    {
      id: '1',
      name: 'Amara',
      lastMessage: 'That cooking stream was amazing! 🍲',
      timestamp: '2 min ago',
      unread: 2,
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
      online: true,
      verified: true
    },
    {
      id: '2',
      name: 'Kwame',
      lastMessage: 'Would love to catch your next stream',
      timestamp: '1 hour ago',
      unread: 0,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      online: false,
      verified: true
    },
    {
      id: '3',
      name: 'Zara',
      lastMessage: 'Thanks for the gift! ❤️',
      timestamp: '3 hours ago',
      unread: 0,
      avatar: 'https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=100&h=100&fit=crop&crop=face',
      online: true,
      verified: false
    }
  ];

  const messages = [
    {
      id: '1',
      senderId: '1',
      content: 'Hey! Loved your profile, especially your taste in music 🎵',
      timestamp: '10:30 AM',
      type: 'text'
    },
    {
      id: '2',
      senderId: 'me',
      content: 'Thank you! I saw you\'re into cooking - that\'s awesome',
      timestamp: '10:35 AM',
      type: 'text'
    },
    {
      id: '3',
      senderId: '1',
      content: 'Yes! I\'m doing a live cooking session tomorrow. You should join!',
      timestamp: '10:40 AM',
      type: 'text'
    },
    {
      id: '4',
      senderId: 'me',
      content: '🎁 Rose',
      timestamp: '10:42 AM',
      type: 'gift'
    },
    {
      id: '5',
      senderId: '1',
      content: 'That cooking stream was amazing! 🍲',
      timestamp: '2 min ago',
      type: 'text'
    }
  ];

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      // Add message logic here
      setNewMessage('');
    }
  };

  const selectedConversation = conversations.find(conv => conv.id === selectedChat);

  return (
    <div className="h-[calc(100vh-12rem)] flex">
      {/* Conversations List */}
      <div className={`${selectedChat ? 'hidden md:block' : 'block'} w-full md:w-80 border-r border-border`}>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-afro-heading">Messages</h2>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search conversations..."
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-1">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setSelectedChat(conversation.id)}
              className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                selectedChat === conversation.id ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Avatar>
                    <AvatarImage src={conversation.avatar} alt={conversation.name} />
                    <AvatarFallback>{conversation.name[0]}</AvatarFallback>
                  </Avatar>
                  {conversation.online && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full"></div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <h3 className="font-semibold truncate">{conversation.name}</h3>
                      {conversation.verified && (
                        <Shield className="w-3 h-3 text-orange-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{conversation.timestamp}</span>
                      {conversation.unread > 0 && (
                        <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0">
                          {conversation.unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {conversation.lastMessage}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-border bg-card/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setSelectedChat(null)}
                >
                  ←
                </Button>
                <Avatar>
                  <AvatarImage src={selectedConversation?.avatar} alt={selectedConversation?.name} />
                  <AvatarFallback>{selectedConversation?.name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1">
                    <h3 className="font-semibold">{selectedConversation?.name}</h3>
                    {selectedConversation?.verified && (
                      <Shield className="w-4 h-4 text-orange-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation?.online ? 'Online now' : 'Last seen recently'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <Video className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.senderId === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                    message.senderId === 'me'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border'
                  }`}
                >
                  {message.type === 'gift' ? (
                    <div className="flex items-center space-x-2">
                      <Gift className="w-4 h-4 text-gold" />
                      <span>Sent a {message.content.replace('🎁 ', '')}</span>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                  <p className="text-xs opacity-70 mt-1">{message.timestamp}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Image className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Gift className="w-4 h-4 text-gold" />
              </Button>
              
              <div className="flex-1 flex items-center space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center space-y-4">
            <div className="heart-logo mx-auto">
              <span className="logo-text">Ò</span>
            </div>
            <h3 className="text-xl font-semibold">Select a conversation</h3>
            <p className="text-muted-foreground">
              Choose a conversation to start messaging
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;