import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { EmotePicker } from './EmotePicker';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
}

interface LiveStreamChatProps {
  streamId: string;
  isMobile?: boolean;
}

export const LiveStreamChat: React.FC<LiveStreamChatProps> = ({ streamId, isMobile = false }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isGuest = !user;

  useEffect(() => {
    // Load initial messages
    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('stream_chat_messages')
          .select('*')
          .eq('stream_id', streamId)
          .order('created_at', { ascending: true })
          .limit(100);

        if (error) {
          console.error('Error loading chat messages:', error);
          return;
        }

        setMessages(data || []);
      } catch (error) {
        console.error('Unexpected error loading chat messages:', error);
      }
    };

    loadMessages();

    // Subscribe to new messages with error handling
    const channel = supabase
      .channel(`stream_chat:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_chat_messages',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          try {
            setMessages((prev) => [...prev, payload.new as ChatMessage]);
          } catch (error) {
            console.error('Error processing new chat message:', error);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✓ Chat subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Chat subscription error');
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        console.error('Error cleaning up chat channel:', error);
      }
    };
  }, [streamId]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to chat');
      return;
    }

    if (!newMessage.trim()) return;

    setIsSending(true);
    
    try {
      // Get user profile for username
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      const username = profile?.display_name || 'Anonymous';

      const { error: insertError } = await supabase
        .from('stream_chat_messages')
        .insert({
          stream_id: streamId,
          user_id: user.id,
          username,
          message: newMessage.trim()
        });

      if (insertError) {
        console.error('Error inserting message:', insertError);
        throw insertError;
      }

      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Don't crash the component, just show error to user
      toast.error(error?.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`flex flex-col h-64 bg-background/95 backdrop-blur ${isMobile ? 'pt-6' : ''}`}>
      <div className="p-3 md:p-4 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm md:text-base">Live Chat</h3>
        <p className="text-xs text-muted-foreground">{messages.length} messages</p>
      </div>

      <ScrollArea className="flex-1 p-3 md:p-4" ref={scrollRef}>
        <div className="space-y-2 md:space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs md:text-sm py-6 md:py-8">
              No messages yet. Be the first to chat!
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-0.5 md:space-y-1">
                <div className="flex items-baseline gap-1.5 md:gap-2">
                  <span className="font-semibold text-xs md:text-sm text-foreground">
                    {msg.username}
                  </span>
                  <span className="text-[10px] md:text-xs text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-primary-foreground font-medium break-words">{msg.message}</p>
              </div>
            ))
          )}
        </div>
        </ScrollArea>

        {/* Message input or guest notice */}
        {isGuest ? (
          <div className="bg-muted/50 rounded-lg p-4 mx-3 mb-3 md:mx-4 md:mb-4 text-center space-y-2 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Sign in to join the conversation
            </p>
            <Button 
              size="sm" 
              onClick={() => window.location.href = '/auth'}
              className="w-full"
            >
              Sign In to Chat
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={isSending}
                maxLength={500}
                className="flex-1 text-sm h-9 md:h-10"
              />
              <EmotePicker
                onEmoteSelect={(emote) => setNewMessage((prev) => prev + emote)}
                disabled={isSending}
              />
              <Button 
                type="submit" 
                size="icon"
                disabled={!newMessage.trim() || isSending}
                className="h-9 w-9 md:h-10 md:w-10"
              >
                <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  };
