import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Heart, Gift, Phone, Video, MoreVertical, ArrowLeft, Circle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { usePresence } from '@/hooks/usePresence';

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
  selectedUserId?: string | null;
}

const MessagingInterface: React.FC<MessagingInterfaceProps> = ({ onBack, selectedUserId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isUserOnline } = usePresence();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Load matches and conversations
  useEffect(() => {
    loadMatchedConversations();
  }, [user]);

  // Handle pre-selected user from navigation (Facebook-style direct messaging)
  useEffect(() => {
    if (selectedUserId) {
      // Immediately set the selected chat and load messages
      setSelectedChat(selectedUserId);
      
      // Check if we already have this user in our conversations
      const existingConversation = conversations.find(conv => conv.user_id === selectedUserId);
      if (existingConversation) {
        loadMessages(selectedUserId);
      } else {
        // Create a new conversation for any user (Facebook-style)
        createNewConversation(selectedUserId);
      }
    }
  }, [selectedUserId]); // Remove conversations dependency to avoid timing issues

  // Load conversations separately 
  useEffect(() => {
    if (selectedUserId && conversations.length > 0) {
      // If we have conversations loaded and a selectedUserId, ensure it's properly set
      const existingConversation = conversations.find(conv => conv.user_id === selectedUserId);
      if (existingConversation && !selectedChat) {
        setSelectedChat(selectedUserId);
        loadMessages(selectedUserId);
      }
    }
  }, [conversations, selectedUserId, selectedChat]);

  const loadMatchedConversations = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Get user's matches and friends
      const [matchesResult, friendsResult] = await Promise.allSettled([
        supabase.rpc('get_user_matches'),
        supabase.rpc('get_user_friends')
      ]);

      let allContacts: any[] = [];

      // Add matches
      if (matchesResult.status === 'fulfilled' && matchesResult.value.data) {
        allContacts = [...allContacts, ...matchesResult.value.data.map((match: any) => ({
          ...match,
          user_id: match.match_user_id,
          connection_type: 'match'
        }))];
      }

      // Add friends
      if (friendsResult.status === 'fulfilled' && friendsResult.value.data) {
        allContacts = [...allContacts, ...friendsResult.value.data.map((friend: any) => ({
          ...friend,
          user_id: friend.friend_user_id,
          display_name: friend.display_name,
          avatar_url: friend.profile_photos?.[0] || friend.avatar_url,
          connection_type: 'friend'
        }))];
      }

      if (allContacts.length === 0) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      // Get last messages for each contact
      const conversationsWithMessages = await Promise.all(
        allContacts.map(async (contact: any) => {
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contact.user_id}),and(sender_id.eq.${contact.user_id},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', contact.user_id)
            .eq('receiver_id', user.id)
            .is('read_at', null);

          return {
            user_id: contact.user_id,
            display_name: contact.display_name,
            avatar_url: contact.profile_photos?.[0] || contact.avatar_url,
            last_message: lastMessage?.content || (contact.connection_type === 'match' ? 'You matched! Send a message.' : 'You\'re now friends! Start chatting.'),
            last_message_time: lastMessage?.created_at || (contact.match_created_at || contact.friend_since),
            unread_count: unreadCount || 0,
            online: isUserOnline(contact.user_id),
            connection_type: contact.connection_type
          };
        })
      );

      // Sort by last message time
      conversationsWithMessages.sort((a, b) => 
        new Date(b.last_message_time || 0).getTime() - new Date(a.last_message_time || 0).getTime()
      );

      setConversations(conversationsWithMessages);
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        title: "Error loading conversations",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create new conversation for direct messaging (Facebook-style)
  const createNewConversation = async (userId: string) => {
    try {
      // Immediately set the selected chat
      setSelectedChat(userId);
      setMessages([]); // Clear previous messages
      
      // Fetch user profile for the conversation
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !profile) {
        toast({
          title: "Error",
          description: "Could not load user profile",
          variant: "destructive",
        });
        return;
      }

      // Create conversation object
      const newConversation: Conversation = {
        user_id: userId,
        display_name: profile.display_name,
        avatar_url: profile.profile_photos?.[0] || profile.avatar_url || '/placeholder.svg',
        last_message: "",
        last_message_time: new Date().toISOString(),
        unread_count: 0,
        online: isUserOnline(userId)
      };

      // Check if conversation already exists, if not add it
      setConversations(prev => {
        const exists = prev.find(conv => conv.user_id === userId);
        if (exists) {
          return prev; // Don't add duplicate
        }
        return [newConversation, ...prev];
      });
      
    } catch (error) {
      console.error('Error creating new conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      });
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
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          console.log('New message received:', newMessage);
          
          // Fetch sender profile if we don't have this conversation
          const existingConv = conversations.find(conv => conv.user_id === newMessage.sender_id);
          if (!existingConv) {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('user_id, display_name, avatar_url, profile_photos')
                .eq('user_id', newMessage.sender_id)
                .single();

              if (profile) {
                const newConversation: Conversation = {
                  user_id: profile.user_id,
                  display_name: profile.display_name,
                  avatar_url: profile.profile_photos?.[0] || profile.avatar_url || '/placeholder.svg',
                  last_message: newMessage.content,
                  last_message_time: newMessage.created_at,
                  unread_count: 1,
                  online: isUserOnline(profile.user_id)
                };

                setConversations(prev => [newConversation, ...prev]);
              }
            } catch (error) {
              console.error('Error fetching sender profile:', error);
            }
          } else {
            // Update existing conversation
            setConversations(prev => prev.map(conv => 
              conv.user_id === newMessage.sender_id 
                ? { 
                    ...conv, 
                    last_message: newMessage.content,
                    last_message_time: newMessage.created_at,
                    unread_count: selectedChat === newMessage.sender_id ? 0 : conv.unread_count + 1
                  }
                : conv
            ));
          }

          // Update messages if this conversation is selected
          if (selectedChat === newMessage.sender_id) {
            setMessages(prev => {
              // Avoid duplicates by checking if message already exists
              const exists = prev.find(msg => msg.id === newMessage.id);
              if (exists) return prev;
              return [...prev, newMessage];
            });
            
            // Auto-mark as read if conversation is open
            setTimeout(() => {
              markMessagesAsRead(newMessage.sender_id);
            }, 1000);
          } else {
            // Show notification for new message
            toast({
              title: `New message from ${existingConv?.display_name || 'Someone'}`,
              description: newMessage.content.length > 50 
                ? newMessage.content.substring(0, 50) + '...' 
                : newMessage.content,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${user.id}`
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          
          // Update message read status in current conversation
          if (selectedChat === updatedMessage.receiver_id) {
            setMessages(prev => prev.map(msg => 
              msg.id === updatedMessage.id ? updatedMessage : msg
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedChat, conversations, isUserOnline, toast]);

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

  const handleVideoCall = async () => {
    if (!selectedChat || isInitiatingCall) return;

    setIsInitiatingCall(true);
    try {
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { error } = await supabase.rpc('create_video_call', {
        p_receiver_id: selectedChat,
        p_call_type: 'video',
        p_call_id: callId
      });

      if (error) {
        if (error.message.includes('only call matched users')) {
          toast({
            title: "Can't Call",
            description: "You can only call matched users or friends",
            variant: "destructive"
          });
        } else {
          throw error;
        }
        return;
      }

      const selectedConversation = conversations.find(c => c.user_id === selectedChat);
      
      navigate('/video-call', {
        state: {
          callId,
          isInitiator: true,
          participantId: selectedChat,
          participantName: selectedConversation?.display_name || 'User',
          callType: 'video'
        }
      });
    } catch (error) {
      console.error('Error initiating video call:', error);
      toast({
        title: "Error",
        description: "Failed to initiate call. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const handleAudioCall = async () => {
    if (!selectedChat || isInitiatingCall) return;

    setIsInitiatingCall(true);
    try {
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { error } = await supabase.rpc('create_video_call', {
        p_receiver_id: selectedChat,
        p_call_type: 'audio',
        p_call_id: callId
      });

      if (error) {
        if (error.message.includes('only call matched users')) {
          toast({
            title: "Can't Call",
            description: "You can only call matched users or friends",
            variant: "destructive"
          });
        } else {
          throw error;
        }
        return;
      }

      const selectedConversation = conversations.find(c => c.user_id === selectedChat);
      
      navigate('/video-call', {
        state: {
          callId,
          isInitiator: true,
          participantId: selectedChat,
          participantName: selectedConversation?.display_name || 'User',
          callType: 'audio'
        }
      });
    } catch (error) {
      console.error('Error initiating audio call:', error);
      toast({
        title: "Error",
        description: "Failed to initiate call. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsInitiatingCall(false);
    }
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
                <h3 className="font-semibold mb-2 text-white">No conversations yet</h3>
                <p className="text-sm text-muted-foreground">
                  Start swiping to find matches or add friends to start chatting!
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
                      {/* Online status indicator */}
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${
                        isUserOnline(conversation.user_id) 
                          ? 'bg-green-500' 
                          : 'bg-gray-400'
                      }`}>
                        <Circle className="w-2 h-2 fill-current" />
                      </div>
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
                      <p className={`text-sm ${isUserOnline(conversation.user_id) ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {isUserOnline(conversation.user_id) ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </>
                ) : null;
              })()}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleAudioCall}
                disabled={isInitiatingCall || !isUserOnline(selectedChat)}
                title={!isUserOnline(selectedChat) ? "User is offline" : "Start voice call"}
              >
                <Phone className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleVideoCall}
                disabled={isInitiatingCall || !isUserOnline(selectedChat)}
                title={!isUserOnline(selectedChat) ? "User is offline" : "Start video call"}
              >
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
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                      message.sender_id === user?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground border border-border'
                    }`}
                  >
                    {message.message_type === 'gift' && (
                      <div className="flex items-center space-x-2 mb-1">
                        <Gift className="w-4 h-4" />
                        <span className="text-xs font-medium">Gift</span>
                      </div>
                    )}
                    <p className={`text-sm leading-relaxed font-medium ${
                      message.message_type !== 'text' ? 'text-center' : ''
                    } ${message.sender_id === user?.id ? 'text-primary-foreground' : 'text-foreground'}`}>
                      {message.content}
                    </p>
                    <p className={`text-xs mt-2 font-medium ${
                      message.sender_id === user?.id 
                        ? 'text-primary-foreground/80' 
                        : 'text-muted-foreground'
                    }`}>
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
                  className="bg-background text-foreground placeholder:text-muted-foreground border-border focus:border-primary focus:ring-primary/20 text-base"
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