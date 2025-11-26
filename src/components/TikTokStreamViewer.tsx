import React, { useState, useRef, useEffect } from 'react';
import { ViewerConnection, ConnectionState } from '@/utils/ViewerConnection';
import { ViewerToHostBroadcast } from '@/utils/ViewerToHostBroadcast';
import { ViewerCameraReceiver } from '@/utils/ViewerCameraReceiver';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  X, Heart, MessageCircle, Gift, Share2, MoreVertical, 
  Eye, Volume2, VolumeX, UserPlus, ArrowLeft, Video, VideoOff, Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VideoCallGrid } from '@/components/VideoCallGrid';

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  created_at: string;
}

interface TikTokStreamViewerProps {
  streamId: string;
  streamTitle: string;
  hostName: string;
  hostUserId: string;
  hostAvatar?: string;
  currentViewers: number;
  totalLikes: number;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export const TikTokStreamViewer: React.FC<TikTokStreamViewerProps> = ({
  streamId,
  streamTitle,
  hostName,
  hostUserId,
  hostAvatar,
  currentViewers,
  totalLikes,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerConnectionRef = useRef<ViewerConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(totalLikes);
  const [viewers, setViewers] = useState(currentViewers);
  const [showUI, setShowUI] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  
  // Floating chat messages
  const [floatingMessages, setFloatingMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showFullChat, setShowFullChat] = useState(false);

  // Viewer camera states
  const [viewerCameraEnabled, setViewerCameraEnabled] = useState(false);
  const [viewerStream, setViewerStream] = useState<MediaStream | null>(null);
  const viewerBroadcastRef = useRef<ViewerToHostBroadcast | null>(null);
  const [isCameraRequesting, setIsCameraRequesting] = useState(false);
  
  // Viewer camera receiver (for seeing other viewers' cameras)
  const viewerCameraReceiverRef = useRef<ViewerCameraReceiver | null>(null);
  const [viewerCameras, setViewerCameras] = useState<Map<string, any>>(new Map());
  
  // Host stream state
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);

  // Swipe gesture handling
  const swipeRef = useSwipeGesture({
    onSwipeUp: () => {
      if (hasNext && onNext) {
        onNext();
      }
    },
    onSwipeDown: () => {
      if (hasPrevious && onPrevious) {
        onPrevious();
      }
    },
    minDistance: 50,
    velocityThreshold: 0.3
  });

  // Auto-hide UI after 3 seconds of inactivity
  useEffect(() => {
    const timeout = setTimeout(() => setShowUI(false), 3000);
    return () => clearTimeout(timeout);
  }, [showUI]);

  // Initialize viewer connection
  useEffect(() => {
    const initViewer = async () => {
      if (!videoRef.current) return;
      
      const videoEl = videoRef.current;
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoEl.muted = true;

      const displayName = user?.email?.split('@')[0] || 'Guest';
      
      const { data: joinData, error: joinError } = await supabase.rpc('join_stream_as_viewer', {
        p_stream_id: streamId,
        p_display_name: displayName,
        p_is_guest: !user
      });

      if (joinError) {
        console.error('Error joining stream:', joinError);
        toast.error('Failed to join stream');
        return;
      }

      const token = (joinData as any)?.session_token as string;
      if (!token) {
        toast.error('Failed to establish viewer session');
        return;
      }
      
      setSessionToken(token);

      viewerConnectionRef.current = new ViewerConnection(
        streamId,
        token,
        videoRef.current,
        displayName,
        !user,
        (state) => setConnectionState(state),
        () => {}
      );

      await viewerConnectionRef.current.connect(supabase);
      setIsConnected(true);

      // Capture host stream for VideoCallGrid
      videoEl.onloadedmetadata = () => {
        if (videoEl.srcObject && videoEl.srcObject instanceof MediaStream) {
          setHostStream(videoEl.srcObject as MediaStream);
        }
      };

      // Load like status
      if (user) {
        const { data: likeData } = await supabase
          .from('stream_likes')
          .select('id')
          .eq('stream_id', streamId)
          .eq('user_id', user.id)
          .single();
        
        setIsLiked(!!likeData);
      }
    };

    initViewer();
    
    return () => {
      // Cleanup viewer camera
      if (viewerBroadcastRef.current) {
        viewerBroadcastRef.current.cleanup();
        viewerBroadcastRef.current = null;
      }
      if (viewerStream) {
        viewerStream.getTracks().forEach(track => track.stop());
      }
      
      if (viewerConnectionRef.current) {
        viewerConnectionRef.current.disconnect();
        viewerConnectionRef.current = null;
      }
      
      // Cleanup viewer camera receiver
      if (viewerCameraReceiverRef.current) {
        viewerCameraReceiverRef.current.cleanup();
        viewerCameraReceiverRef.current = null;
      }
      
      (async () => {
        if (sessionToken) {
          try {
            await supabase.rpc('leave_stream_viewer', {
              p_session_token: sessionToken
            });
          } catch (err) {
            console.error('Error leaving stream:', err);
          }
        }
      })();
      
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  }, [streamId, user]);

  // Initialize viewer camera receiver to see other viewers' cameras
  useEffect(() => {
    const initViewerCameraReceiver = async () => {
      if (!streamId) return;
      
      console.log('📹 Initializing viewer camera receiver for stream', streamId);
      
      const receiver = new ViewerCameraReceiver(streamId, (cameras) => {
        console.log('📹 Viewer cameras updated, count:', cameras.size);
        setViewerCameras(new Map(cameras));
      });
      
      try {
        await receiver.initialize();
        viewerCameraReceiverRef.current = receiver;
        console.log('✅ Viewer camera receiver initialized');
      } catch (error) {
        console.error('❌ Failed to initialize viewer camera receiver:', error);
      }
    };
    
    initViewerCameraReceiver();
    
    return () => {
      if (viewerCameraReceiverRef.current) {
        viewerCameraReceiverRef.current.cleanup();
        viewerCameraReceiverRef.current = null;
      }
    };
  }, [streamId]);

  // Subscribe to floating chat messages
  useEffect(() => {
    const channel = supabase
      .channel(`tiktok_chat:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_chat_messages',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setFloatingMessages(prev => [...prev.slice(-4), newMsg]);
          
          // Auto-remove after 5 seconds
          setTimeout(() => {
            setFloatingMessages(prev => prev.filter(m => m.id !== newMsg.id));
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Subscribe to likes
  useEffect(() => {
    const channel = supabase
      .channel(`tiktok_likes:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streaming_sessions',
          filter: `id=eq.${streamId}`
        },
        (payload) => {
          if (payload.new && 'total_likes' in payload.new) {
            setLikes(payload.new.total_likes || 0);
          }
          if (payload.new && 'current_viewers' in payload.new) {
            setViewers(payload.new.current_viewers || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const handleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like');
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from('stream_likes')
          .delete()
          .eq('stream_id', streamId)
          .eq('user_id', user.id);
        
        setIsLiked(false);
      } else {
        await supabase
          .from('stream_likes')
          .insert({ stream_id: streamId, user_id: user.id });
        
        setIsLiked(true);
        
        // Show heart animation
        const heartEl = document.createElement('div');
        heartEl.className = 'absolute animate-float-up';
        heartEl.style.left = `${Math.random() * 80 + 10}%`;
        heartEl.style.bottom = '20%';
        heartEl.innerHTML = '❤️';
        heartEl.style.fontSize = '48px';
        document.getElementById('video-container')?.appendChild(heartEl);
        
        setTimeout(() => heartEl.remove(), 2000);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like stream');
    }
  };

  const handleSendMessage = async () => {
    if (!user || !chatInput.trim()) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      await supabase
        .from('stream_chat_messages')
        .insert({
          stream_id: streamId,
          user_id: user.id,
          username: profile?.display_name || 'Anonymous',
          message: chatInput.trim()
        });

      setChatInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleFollow = async () => {
    if (!user) {
      toast.error('Please sign in to follow');
      return;
    }

    // TODO: Implement follow functionality
    setIsFollowing(!isFollowing);
    toast.success(isFollowing ? 'Unfollowed' : 'Following!');
  };

  const toggleViewerCamera = async () => {
    if (!sessionToken) {
      toast.error('Not connected to stream');
      return;
    }

    if (viewerCameraEnabled) {
      // Turn off camera
      if (viewerBroadcastRef.current) {
        viewerBroadcastRef.current.cleanup();
        viewerBroadcastRef.current = null;
      }
      if (viewerStream) {
        viewerStream.getTracks().forEach(track => track.stop());
        setViewerStream(null);
      }
      setViewerCameraEnabled(false);
      toast.success('Camera disabled');
    } else {
      // Turn on camera
      try {
        setIsCameraRequesting(true);
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 },
          audio: false 
        });
        
        setViewerStream(stream);
        
        // Create viewer-to-host broadcast
        const broadcast = new ViewerToHostBroadcast(
          streamId,
          sessionToken,
          stream,
          (state) => {
            console.log('Viewer camera connection state:', state);
          }
        );
        
        await broadcast.initialize();
        viewerBroadcastRef.current = broadcast;
        
        setViewerCameraEnabled(true);
        toast.success('Camera enabled! Host can now see you.');
      } catch (error) {
        console.error('Error enabling camera:', error);
        toast.error('Failed to enable camera. Please check permissions.');
      } finally {
        setIsCameraRequesting(false);
      }
    }
  };

  return (
    <div 
      ref={swipeRef}
      className="fixed inset-0 bg-black z-50 overflow-hidden"
      onClick={() => setShowUI(true)}
    >
      {/* Video Container - Hidden host video, show VideoCallGrid instead */}
      <div id="video-container" className="absolute inset-0 flex items-center justify-center">
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          autoPlay
          muted={isMuted}
        />
        
        {/* VideoCallGrid - Show host and all viewers with cameras */}
        {hostStream && (
          <VideoCallGrid
            hostStream={hostStream}
            hostName={hostName}
            viewerStream={viewerStream || undefined}
            viewerCameraEnabled={viewerCameraEnabled}
            viewerName={user?.email?.split('@')[0] || 'You'}
            viewerCameras={viewerCameras}
          />
        )}
      </div>

      {/* Overlay UI */}
      <div 
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          showUI ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="text-white"
              onClick={onClose}
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>

            <Badge className="bg-destructive text-white px-3 py-1 flex items-center gap-2 animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              LIVE
            </Badge>

            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1">
              <Eye className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">{viewers}</span>
            </div>
          </div>
        </div>

        {/* Host Info - Bottom Left */}
        <div className="absolute bottom-20 left-4 right-20 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 border-2 border-white">
              <AvatarImage src={hostAvatar} />
              <AvatarFallback>{hostName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold truncate">{hostName}</h3>
              <p className="text-white/80 text-sm truncate">{streamTitle}</p>
            </div>
            <Button
              size="sm"
              onClick={handleFollow}
              className={cn(
                "rounded-full",
                isFollowing ? "bg-white/20" : "bg-primary"
              )}
            >
              {isFollowing ? 'Following' : <UserPlus className="w-4 h-4" />}
            </Button>
          </div>

          {/* Floating Chat Messages */}
          <div className="space-y-2">
            {floatingMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-black/60 backdrop-blur-sm rounded-2xl px-3 py-2 animate-slide-in-right max-w-xs"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-semibold text-sm">{msg.username}</span>
                </div>
                <p className="text-white text-sm break-words">{msg.message}</p>
              </div>
            ))}
          </div>

          {/* Message Input */}
          {user && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Add a comment..."
                className="flex-1 bg-black/40 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white placeholder:text-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            </div>
          )}
        </div>

        {/* Action Stack - Right Side */}
        <div className="absolute bottom-32 right-4 flex flex-col items-center gap-6">
          {/* Like Button */}
          <button
            onClick={handleLike}
            className="flex flex-col items-center gap-1 transition-transform active:scale-90"
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Heart 
                className={cn(
                  "w-7 h-7 transition-colors",
                  isLiked ? "fill-destructive text-destructive" : "text-white"
                )}
              />
            </div>
            <span className="text-white text-xs font-medium">{likes}</span>
          </button>

          {/* Comment Button */}
          <button
            onClick={() => setShowFullChat(!showFullChat)}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            <span className="text-white text-xs font-medium">Chat</span>
          </button>

          {/* Gift Button */}
          <button className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Gift className="w-7 h-7 text-white" />
            </div>
            <span className="text-white text-xs font-medium">Gift</span>
          </button>

          {/* Share Button */}
          <button className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Share2 className="w-7 h-7 text-white" />
            </div>
          </button>

          {/* Camera Toggle Button */}
          <button
            onClick={toggleViewerCamera}
            disabled={isCameraRequesting}
            className="flex flex-col items-center gap-1"
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              viewerCameraEnabled 
                ? "bg-primary backdrop-blur-sm" 
                : "bg-black/40 backdrop-blur-sm"
            )}>
              {isCameraRequesting ? (
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              ) : viewerCameraEnabled ? (
                <Video className="w-7 h-7 text-white" />
              ) : (
                <VideoOff className="w-7 h-7 text-white" />
              )}
            </div>
            <span className="text-white text-xs font-medium">
              {viewerCameraEnabled ? 'On' : 'Off'}
            </span>
          </button>

          {/* More Options */}
          <button className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <MoreVertical className="w-7 h-7 text-white" />
            </div>
          </button>

          {/* Mute Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
          >
            {isMuted ? (
              <VolumeX className="w-7 h-7 text-white" />
            ) : (
              <Volume2 className="w-7 h-7 text-white" />
            )}
          </button>
        </div>

      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-200px);
          }
        }
        
        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-float-up {
          animation: float-up 2s ease-out forwards;
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
