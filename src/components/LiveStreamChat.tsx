import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    // Load initial messages
    const loadMessages = async () => {
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
    };

    loadMessages();

    // Subscribe to new messages
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
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      const username = profile?.display_name || 'Anonymous';

      const { error } = await supabase
        .from('stream_chat_messages')
        .insert({
          stream_id: streamId,
          user_id: user.id,
          username,
          message: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-background/95 backdrop-blur ${isMobile ? 'pt-6' : ''}`}>
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
                <p className="text-xs md:text-sm text-foreground break-words">{msg.message}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={user ? "Type a message..." : "Sign in to chat"}
            disabled={!user || isSending}
            maxLength={500}
            className="flex-1 text-sm h-9 md:h-10"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!user || !newMessage.trim() || isSending}
            className="h-9 w-9 md:h-10 md:w-10"
          >
            <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
