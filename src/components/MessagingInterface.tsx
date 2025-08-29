import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Heart, Gift, Phone, Video, MoreVertical, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  message_type: 'text' | 'gift' | 'heart';
  created_at: string;
  read_at?: string;
  metadata?: any;
}

interface Conversation {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  online?: boolean;
}

interface MessagingInterfaceProps {
  onBack?: () => void;
}

const MessagingInterface: React.FC<MessagingInterfaceProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Load matches and conversations
  useEffect(() => {
    loadMatchedConversations();
  }, [user]);

  const loadMatchedConversations = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Get user's matches
      const { data: matches, error } = await supabase.rpc('get_user_matches');
      
      if (error) throw error;

      if (!matches || matches.length === 0) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      // Get last messages for each match
      const conversationsWithMessages = await Promise.all(
        matches.map(async (match: any) => {
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${match.match_user_id}),and(sender_id.eq.${match.match_user_id},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', match.match_user_id)
            .eq('receiver_id', user.id)
            .is('read_at', null);

          return {
            user_id: match.match_user_id,
            display_name: match.display_name,
            avatar_url: match.profile_photos?.[0] || match.avatar_url,
            last_message: lastMessage?.content || 'You matched! Send a message.',
            last_message_time: lastMessage?.created_at || match.match_created_at,
            unread_count: unreadCount || 0,
            online: Math.random() > 0.5 // Mock online status
          };
        })
      );

      setConversations(conversationsWithMessages);
    } catch (error) {
      console.error('Error loading matched conversations:', error);
      toast({
        title: "Error loading matches",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load messages for selected conversation
  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat);
      // Mark messages as read
      markMessagesAsRead(selectedChat);
    }
  }, [selectedChat]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set up real-time message listener
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          
          // Update conversations list
          setConversations(prev => prev.map(conv => 
            conv.user_id === newMessage.sender_id 
              ? { 
                  ...conv, 
                  last_message: newMessage.content,
                  last_message_time: newMessage.created_at,
                  unread_count: conv.unread_count + 1
                }
              : conv
          ));

          // Update messages if this conversation is selected
          if (selectedChat === newMessage.sender_id) {
            setMessages(prev => [...prev, newMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedChat]);

  const loadMessages = async (userId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data as Message[] || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error loading messages",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const markMessagesAsRead = async (userId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', userId)
        .eq('receiver_id', user.id)
        .is('read_at', null);

      if (!error) {
        // Update local conversation state
        setConversations(prev => prev.map(conv => 
          conv.user_id === userId 
            ? { ...conv, unread_count: 0 }
            : conv
        ));
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async (type: 'text' | 'heart' | 'gift' = 'text', content?: string, metadata?: any) => {
    if (!user || !selectedChat) return;
    if (type === 'text' && (!content || !content.trim())) return;

    setIsSending(true);

    try {
      const messageData = {
        sender_id: user.id,
        receiver_id: selectedChat,
        message_type: type,
        content: content || (type === 'heart' ? '❤️' : '🎁'),
        metadata: metadata || {}
      };

      const { error } = await supabase
        .from('messages')
        .insert(messageData);

      if (error) throw error;

      // Add message locally for immediate feedback
      const localMessage: Message = {
        id: Date.now().toString(),
        ...messageData,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, localMessage]);
      setNewMessage('');

      // Update conversation list
      setConversations(prev => prev.map(conv => 
        conv.user_id === selectedChat 
          ? { 
              ...conv, 
              last_message: localMessage.content,
              last_message_time: localMessage.created_at
            }
          : conv
      ));

      if (type !== 'text') {
        toast({
          title: type === 'heart' ? "Heart sent!" : "Gift sent!",
          description: `Your ${type} has been sent successfully.`,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendText = () => {
    sendMessage('text', newMessage);
  };

  const handleSendHeart = () => {
    sendMessage('heart');
  };

  const handleSendGift = () => {
    // In a real app, this would open a gift selection modal
    sendMessage('gift', '🎁 Virtual Rose', { gift_type: 'rose', cost: 10 });
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen dark bg-background flex">
      {/* Conversations List */}
      <div className={`w-full md:w-1/3 lg:w-1/4 border-r border-border ${selectedChat ? 'hidden md:block' : ''}`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <h2 className="text-xl font-afro-heading">Messages</h2>
            <div className="w-8" /> {/* Spacer */}
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="space-y-2 p-4">
            {conversations.length === 0 && !isLoading ? (
              <div className="text-center py-8">
                <div className="heart-logo mb-4 opacity-50">
                  <span className="logo-text">Ò</span>
                </div>
                <h3 className="font-semibold mb-2 text-white">No matches yet</h3>
                <p className="text-sm text-muted-foreground">
                  Start swiping to find your perfect match!
                </p>
              </div>
            ) : (
              conversations.map((conversation) => (
              <Card
                key={conversation.user_id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedChat === conversation.user_id ? 'bg-muted' : ''
                }`}
                onClick={() => setSelectedChat(conversation.user_id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={conversation.avatar_url} />
                        <AvatarFallback>
                          {conversation.display_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      {conversation.online && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium truncate">{conversation.display_name}</h3>
                        {conversation.last_message_time && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conversation.last_message_time), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.last_message}
                        </p>
                        {conversation.unread_count > 0 && (
                          <Badge variant="default" className="text-xs">
                            {conversation.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button 
                variant="ghost" 
                size="sm" 
                className="md:hidden"
                onClick={() => setSelectedChat(null)}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              
              {(() => {
                const conversation = conversations.find(c => c.user_id === selectedChat);
                return conversation ? (
                  <>
                    <Avatar>
                      <AvatarImage src={conversation.avatar_url} />
                      <AvatarFallback>
                        {conversation.display_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{conversation.display_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {conversation.online ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </>
                ) : null;
              })()}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Phone className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Video className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender_id === user?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {message.message_type === 'gift' && (
                      <div className="flex items-center space-x-2 mb-1">
                        <Gift className="w-4 h-4" />
                        <span className="text-xs">Gift</span>
                      </div>
                    )}
                    <p className={`text-sm ${message.message_type !== 'text' ? 'text-center' : ''}`}>
                      {message.content}
                    </p>
                    <p className={`text-xs mt-1 opacity-70`}>
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSendHeart}
                disabled={isSending}
              >
                <Heart className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSendGift}
                disabled={isSending}
              >
                <Gift className="w-4 h-4" />
              </Button>
              <div className="flex-1 flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSendText()}
                  disabled={isSending}
                />
                <Button 
                  onClick={handleSendText} 
                  disabled={!newMessage.trim() || isSending}
                  size="sm"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
            <p className="text-muted-foreground">
              Choose from your existing conversations or start a new one
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagingInterface;