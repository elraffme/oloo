import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, VideoOff, Mic, MicOff, Settings, Users, Eye, Heart, Gift, Share2, MoreVertical, Play, Pause, Volume2, ArrowLeft, Crown, Sparkles, User, ChevronRight, ChevronLeft, Radio, CheckCircle2, XCircle, Activity, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BroadcastManager } from '@/utils/BroadcastManager';
import { ViewerCameraReceiver } from '@/utils/ViewerCameraReceiver';
import { ViewerStreamRelay } from '@/utils/ViewerStreamRelay';
import StreamViewer from '@/components/StreamViewer';
import { TikTokStreamViewer } from '@/components/TikTokStreamViewer';
import { CurrencyWallet } from '@/components/CurrencyWallet';
import { useCurrency } from '@/hooks/useCurrency';
import { CoinShop } from '@/components/CoinShop';
import { MyActiveStreamBanner } from '@/components/MyActiveStreamBanner';
import { LikeAnimation } from '@/components/LikeAnimation';
import { LiveStreamChat } from '@/components/LiveStreamChat';
import CameraTroubleshootingWizard from '@/components/CameraTroubleshootingWizard';
import { StreamDiagnostics } from '@/components/StreamDiagnostics';
import { ViewerCameraThumbnails } from '@/components/ViewerCameraThumbnails';
import { VideoCallGrid } from '@/components/VideoCallGrid';
import { useStreamQueue } from '@/hooks/useStreamQueue';
import { useStreamViewers } from '@/hooks/useStreamViewers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StreamingInterfaceProps {
  onBack?: () => void;
}
interface StreamData {
  id: string;
  title: string;
  description: string;
  host_user_id: string;
  host_name?: string;
  current_viewers: number;
  status: 'live' | 'ended' | 'pending';
  created_at: string;
  started_at?: string | null;
  category?: string;
  thumbnail?: string;
  ar_space_data?: {
    category?: string;
    [key: string]: any;
  };
  total_likes?: number;
}
const StreamingInterface: React.FC<StreamingInterfaceProps> = ({
  onBack
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();

  // Determine active tab from URL - default to discover
  const activeTab = location.pathname.endsWith('/go-live') ? 'go-live' : 'discover';
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamCategory, setStreamCategory] = useState('');
  const [currentViewers, setCurrentViewers] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalGifts, setTotalGifts] = useState(0);
  const [liveStreams, setLiveStreams] = useState<StreamData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [viewingStreamId, setViewingStreamId] = useState<string | null>(null);
  const [viewingStreamData, setViewingStreamData] = useState<StreamData | null>(null);
  const [isBroadcastReady, setIsBroadcastReady] = useState(false);
  const [streamLifecycle, setStreamLifecycle] = useState<'idle' | 'preparing' | 'waiting' | 'live' | 'ending' | 'ended'>('idle');
  const [channelStatus, setChannelStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<{ isHealthy: boolean; details: any } | null>(null);
  const broadcastManagerRef = useRef<BroadcastManager | null>(null);
  const viewerCountIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCleaningUpRef = useRef(false);
  const activeStreamIdRef = useRef<string | null>(null);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [giftNotifications, setGiftNotifications] = useState<Array<{
    id: string;
    senderName: string;
    giftName: string;
    giftEmoji: string;
  }>>([]);
  const {
    balance
  } = useCurrency();
  const [myActiveStream, setMyActiveStream] = useState<StreamData | null>(null);
  
  // Viewer camera receiver
  const viewerCameraReceiverRef = useRef<ViewerCameraReceiver | null>(null);
  const [viewerCameras, setViewerCameras] = useState<Map<string, any>>(new Map());
  
  // Viewer stream relay (host forwards viewer cameras to other viewers)
  const viewerStreamRelayRef = useRef<ViewerStreamRelay | null>(null);
  
  // Debug: Log viewer cameras updates
  useEffect(() => {
    console.log('🎥 Host: Viewer cameras updated, count:', viewerCameras.size);
    viewerCameras.forEach((camera, token) => {
      console.log('  - Viewer camera:', camera.displayName, 'token:', token);
    });
  }, [viewerCameras]);

  // Real-time stream state monitoring while streaming
  useEffect(() => {
    if (!isStreaming || !streamRef.current) return;

    const monitorInterval = setInterval(() => {
      if (!streamRef.current) {
        console.warn('⚠️ Stream ref lost during monitoring');
        return;
      }

      const videoTracks = streamRef.current.getVideoTracks();
      if (videoTracks.length === 0) {
        console.error('❌ No video tracks during streaming!');
        toast({
          title: "Camera disconnected",
          description: "Video track was lost. Please check your camera.",
          variant: "destructive"
        });
        return;
      }

      const videoTrack = videoTracks[0];
      
      // Check if track became disabled or ended
      if (!videoTrack.enabled || videoTrack.readyState !== 'live') {
        console.error('❌ Video track issue:', {
          enabled: videoTrack.enabled,
          readyState: videoTrack.readyState
        });

        // Try to re-enable if just disabled
        if (videoTrack.readyState === 'live' && !videoTrack.enabled) {
          console.log('🔧 Attempting to re-enable video track...');
          videoTrack.enabled = true;
        }
      }

      // Log track state periodically
      console.log('📊 Stream monitor:', {
        enabled: videoTrack.enabled,
        readyState: videoTrack.readyState,
        streamId: streamRef.current.id
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(monitorInterval);
  }, [isStreaming, toast]);

  // Debug: Log hostStream state changes for VideoCallGrid
  useEffect(() => {
    if (isStreaming) {
      console.log('🎥 hostStream state for VideoCallGrid:', {
        hasStream: !!hostStream,
        streamId: hostStream?.id,
        videoTracks: hostStream?.getVideoTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState
        })),
        audioTracks: hostStream?.getAudioTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState
        }))
      });
    }
  }, [hostStream, isStreaming]);
  const [showCameraTroubleshooting, setShowCameraTroubleshooting] = useState(false);
  const [showBroadcasterDiagnostics, setShowBroadcasterDiagnostics] = useState(false);
  const [hasTURN, setHasTURN] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [likeAnimationTrigger, setLikeAnimationTrigger] = useState(0);
  const [isTikTokMode, setIsTikTokMode] = useState(false);
  
  // Initialize stream queue with live streams
  const streamQueueData = liveStreams.map(stream => ({
    id: stream.id,
    title: stream.title,
    host_name: stream.host_name || 'Unknown',
    host_user_id: stream.host_user_id,
    current_viewers: stream.current_viewers,
    total_likes: stream.total_likes || 0,
    thumbnail: stream.thumbnail,
    category: stream.category
  }));
  
  const {
    currentStream,
    nextStream,
    previousStream,
    hasNext,
    hasPrevious,
    goToNext,
    goToPrevious
  } = useStreamQueue(streamQueueData);
  const [showStreamerChat, setShowStreamerChat] = useState(true);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  
  // Get active stream viewers
  const { viewers: activeViewers, isLoading: viewersLoading } = useStreamViewers(activeStreamId || '');

  // Floating chat messages for host
  const [floatingChatMessages, setFloatingChatMessages] = useState<Array<{
    id: string;
    username: string;
    message: string;
    created_at: string;
  }>>([]);

  // Sync activeStreamId to ref for cleanup
  useEffect(() => {
    activeStreamIdRef.current = activeStreamId;
  }, [activeStreamId]);

  // Fetch user's active stream on tab change
  useEffect(() => {
    const fetchMyActiveStream = async () => {
      if (!user) return;
      const {
        data,
        error
      } = await supabase.from('streaming_sessions').select('*').eq('host_user_id', user.id).eq('status', 'live').maybeSingle();
      if (!error && data) {
        const {
          data: profileData
        } = await supabase.from('profiles').select('display_name').eq('user_id', data.host_user_id).single();
        setMyActiveStream({
          id: data.id,
          title: data.title,
          description: data.description || '',
          host_user_id: data.host_user_id,
          host_name: profileData?.display_name || 'You',
          current_viewers: data.current_viewers || 0,
          status: data.status as 'live' | 'ended' | 'pending',
          created_at: data.created_at
        });
      } else {
        setMyActiveStream(null);
      }
    };
    if (user && activeTab === 'discover') {
      fetchMyActiveStream();
    }
  }, [user, activeTab]);

  // Real-time subscription for user's stream updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('my_stream_updates').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'streaming_sessions',
      filter: `host_user_id=eq.${user.id}`
    }, async payload => {
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        const streamData = payload.new as any;
        if (streamData.status === 'live') {
          const {
            data: profileData
          } = await supabase.from('profiles').select('display_name').eq('user_id', streamData.host_user_id).single();
          setMyActiveStream({
            id: streamData.id,
            title: streamData.title,
            description: streamData.description || '',
            host_user_id: streamData.host_user_id,
            host_name: profileData?.display_name || 'You',
            current_viewers: streamData.current_viewers || 0,
            status: streamData.status as 'live' | 'ended' | 'pending',
            created_at: streamData.created_at
          });
        } else {
          setMyActiveStream(null);
        }
      } else if (payload.eventType === 'DELETE') {
        setMyActiveStream(null);
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Subscribe to likes for user's stream
  useEffect(() => {
    if (!myActiveStream) return;
    const channel = supabase.channel(`my_stream_likes_${myActiveStream.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'stream_likes',
      filter: `stream_id=eq.${myActiveStream.id}`
    }, async () => {
      // Refresh stream data to get updated like count
      const {
        data
      } = await supabase.from('streaming_sessions').select('total_likes, current_viewers').eq('id', myActiveStream.id).single();
      if (data && myActiveStream) {
        setMyActiveStream({
          ...myActiveStream,
          current_viewers: data.current_viewers || 0
        });
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myActiveStream]);

  // Subscribe to viewer session changes to track all viewers
  useEffect(() => {
    if (!isStreaming || !activeStreamId || !viewerStreamRelayRef.current) return;

    console.log('📡 Setting up viewer session tracking for stream:', activeStreamId);

    const channel = supabase
      .channel(`host_viewer_tracking_${activeStreamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_viewer_sessions',
          filter: `stream_id=eq.${activeStreamId}`
        },
        (payload) => {
          const session = payload.new as any;
          if (session?.session_token && session?.viewer_display_name) {
            console.log('🆕 New viewer joined, notifying relay:', session.viewer_display_name);
            viewerStreamRelayRef.current?.notifyViewerJoined(
              session.session_token,
              session.viewer_display_name
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stream_viewer_sessions',
          filter: `stream_id=eq.${activeStreamId}`
        },
        (payload) => {
          const session = payload.new as any;
          if (session?.left_at && session?.session_token) {
            console.log('👋 Viewer left, cleaning up relay:', session.session_token);
            viewerStreamRelayRef.current?.onViewerLeft(session.session_token);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isStreaming, activeStreamId]);

  // Subscribe to gift transactions when streaming
  useEffect(() => {
    if (!activeStreamId || !user) return;
    const channel = supabase.channel(`gifts_${activeStreamId}`).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'gift_transactions',
      filter: `receiver_id=eq.${user.id}`
    }, async payload => {
      const giftTransaction = payload.new;

      // Fetch gift and sender details
      const {
        data: giftData
      } = await supabase.from('gifts').select('name, asset_url').eq('id', giftTransaction.gift_id).single();
      const {
        data: senderData
      } = await supabase.from('profiles').select('display_name').eq('user_id', giftTransaction.sender_id).single();
      if (giftData) {
        const senderName = senderData?.display_name || `User-${giftTransaction.sender_id.slice(0, 8)}`;
        const notification = {
          id: giftTransaction.id,
          senderName: senderName,
          giftName: giftData.name,
          giftEmoji: giftData.asset_url || '🎁'
        };
        setGiftNotifications(prev => [...prev, notification]);
        setTotalGifts(prev => prev + 1);

        // Remove notification after 5 seconds
        setTimeout(() => {
          setGiftNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 5000);
        toast({
          title: `${senderName} sent ${giftData.name}!`,
          description: `You earned gold from this gift 🪙`
        });
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStreamId, user]);

  // Subscribe to likes for the streamer's active stream
  useEffect(() => {
    if (!activeStreamId) return;
    const channel = supabase.channel(`broadcaster_likes_${activeStreamId}`).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'stream_likes',
      filter: `stream_id=eq.${activeStreamId}`
    }, () => {
      // Trigger the heart animation
      setShowLikeAnimation(true);
      setLikeAnimationTrigger(prev => prev + 1);

      // Update total likes count
      setTotalLikes(prev => prev + 1);
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStreamId]);

  // Subscribe to chat messages for floating display
  useEffect(() => {
    if (!activeStreamId || !isStreaming) return;

    const channel = supabase
      .channel(`host_chat_${activeStreamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'stream_chat_messages',
        filter: `stream_id=eq.${activeStreamId}`
      }, (payload) => {
        const newMsg = payload.new as any;
        setFloatingChatMessages(prev => [...prev.slice(-4), newMsg]);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          setFloatingChatMessages(prev => prev.filter(m => m.id !== newMsg.id));
        }, 5000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStreamId, isStreaming]);

  // Monitor stream inactivity and auto-end after 5 minutes
  useEffect(() => {
    if (!isStreaming || !activeStreamId) return;

    console.log('⏱️ Starting inactivity monitor for stream:', activeStreamId);

    const inactivityCheckInterval = setInterval(async () => {
      try {
        // Query the stream's last_activity_at timestamp
        const { data: streamData, error } = await supabase
          .from('streaming_sessions')
          .select('last_activity_at, status')
          .eq('id', activeStreamId)
          .single();

        if (error) {
          console.error('❌ Error checking stream activity:', error);
          return;
        }

        if (!streamData || streamData.status !== 'live') {
          console.log('⚠️ Stream no longer live, stopping inactivity monitor');
          return;
        }

        const lastActivityTime = new Date(streamData.last_activity_at).getTime();
        const currentTime = Date.now();
        const inactiveSeconds = (currentTime - lastActivityTime) / 1000;

        console.log('⏱️ Inactivity check:', {
          lastActivity: streamData.last_activity_at,
          inactiveSeconds: Math.floor(inactiveSeconds),
          threshold: 300
        });

        // Auto-end if inactive for 5+ minutes (300 seconds)
        if (inactiveSeconds >= 300) {
          console.log('🔴 Stream inactive for 5+ minutes, auto-ending stream');
          clearInterval(inactivityCheckInterval);
          
          toast({
            title: "Stream ended due to inactivity",
            description: "Your stream was automatically ended after 5 minutes of no activity.",
            variant: "destructive"
          });
          
          await endStream();
        } else {
          const remainingMinutes = Math.ceil((300 - inactiveSeconds) / 60);
          console.log(`✅ Stream active, ${remainingMinutes} minutes until auto-end`);
        }
      } catch (err) {
        console.error('❌ Error in inactivity check:', err);
      }
    }, 30000); // Check every 30 seconds

    return () => {
      console.log('🛑 Stopping inactivity monitor');
      clearInterval(inactivityCheckInterval);
    };
  }, [isStreaming, activeStreamId, toast]);

  // Ensure video element srcObject is connected when camera turns on
  useEffect(() => {
    if (isCameraOn && videoRef.current && streamRef.current) {
      // Only set if not already set or if it's different
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
        });
      }
    }
  }, [isCameraOn]);

  // Fetch live streams from database (archived/ended sessions excluded)
  useEffect(() => {
    const fetchLiveStreams = async () => {
      try {
        // Fetch only live streaming sessions - ended/archived sessions are hidden
        const {
          data: streamsData,
          error: streamsError
        } = await supabase.from('streaming_sessions').select('*').eq('status', 'live').eq('is_private', false).order('created_at', {
          ascending: false
        });
        if (streamsError) throw streamsError;
        if (!streamsData || streamsData.length === 0) {
          setLiveStreams([]);
          return;
        }

        // Fetch profiles for all hosts in one query
        const hostIds = [...new Set(streamsData.map(s => s.host_user_id))];
        const {
          data: profilesData,
          error: profilesError
        } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', hostIds);
        if (profilesError) console.warn('Error fetching profiles:', profilesError);

        // Create a map of user_id to profile for quick lookup
        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
        const formattedStreams: StreamData[] = streamsData.map((stream: any) => {
          const profile = profilesMap.get(stream.host_user_id);
          return {
            id: stream.id,
            title: stream.title,
            description: stream.description || '',
            host_user_id: stream.host_user_id,
            host_name: profile?.display_name || 'Anonymous',
            current_viewers: stream.current_viewers || 0,
            status: stream.status,
            created_at: stream.created_at,
            started_at: stream.started_at,
            category: stream.ar_space_data?.category || 'General',
            thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'
          };
        });
        setLiveStreams(formattedStreams);
      } catch (error) {
        console.error('Error fetching live streams:', error);
        // Show mock data if fetch fails
        const mockStreams: StreamData[] = [{
          id: '1',
          title: 'Cultural Music Session 🎵',
          description: 'Live performance of traditional African songs',
          host_user_id: 'host1',
          host_name: 'Kemi Adebayo',
          current_viewers: 234,
          status: 'live',
          created_at: new Date().toISOString(),
          category: 'Music',
          thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'
        }, {
          id: '2',
          title: 'Dating Tips & Cultural Values 💝',
          description: 'Discussion on modern dating with traditional values',
          host_user_id: 'host2',
          host_name: 'Amara Johnson',
          current_viewers: 156,
          status: 'live',
          created_at: new Date().toISOString(),
          category: 'Lifestyle',
          thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop'
        }];
        setLiveStreams(mockStreams);
      }
    };
    fetchLiveStreams();

    // Phase 4: Force immediate cleanup on page load
    const cleanupStaleStreams = async () => {
      try {
        // Call the database function
        await supabase.rpc('cleanup_stale_live_streams');
        console.log('✅ Stale streams cleanup completed');

        // Additionally, immediately archive any streams that are clearly stale
        // (This provides instant cleanup without waiting for the function)
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        const {
          error: immediateCleanupError
        } = await supabase.from('streaming_sessions').update({
          status: 'archived',
          ended_at: new Date().toISOString(),
          current_viewers: 0
        }).eq('status', 'live').or(`started_at.lt.${sixHoursAgo},and(started_at.is.null,created_at.lt.${oneHourAgo})`);
        if (immediateCleanupError) {
          console.warn('Failed immediate cleanup:', immediateCleanupError);
        } else {
          console.log('✅ Immediate cleanup completed');
        }
      } catch (err) {
        console.warn('Failed to cleanup stale streams:', err);
      }
    };
    cleanupStaleStreams();

    // Phase 2: Set up real-time subscription with debounced refetch
    let refetchTimeout: NodeJS.Timeout | null = null;
    const debouncedRefetch = () => {
      if (refetchTimeout) clearTimeout(refetchTimeout);
      refetchTimeout = setTimeout(() => {
        fetchLiveStreams();
      }, 500); // Only refetch once every 500ms max
    };
    const channel = supabase.channel('streaming_sessions_changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'streaming_sessions',
      filter: 'is_private=eq.false'
    }, payload => {
      // Handle DELETE - always remove from UI
      if (payload.eventType === 'DELETE' && payload.old) {
        setLiveStreams(prev => prev.filter(s => s.id !== (payload.old as any).id));
        return;
      }

      // Handle UPDATE - optimize state updates
      if (payload.eventType === 'UPDATE' && payload.new) {
        const updatedStream = payload.new as any;

        // If stream ended/archived, remove immediately without refetch
        if (updatedStream.status === 'ended' || updatedStream.status === 'archived') {
          setLiveStreams(prev => prev.filter(s => s.id !== updatedStream.id));
          return;
        }

        // If stream is now live, add/update optimistically
        if (updatedStream.status === 'live') {
          setLiveStreams(prev => {
            const exists = prev.find(s => s.id === updatedStream.id);
            if (exists) {
              // Update existing stream
              return prev.map(s => s.id === updatedStream.id ? {
                ...s,
                current_viewers: updatedStream.current_viewers,
                total_likes: updatedStream.total_likes
              } : s);
            }
            // Don't auto-add, let the debounced refetch handle it
            return prev;
          });
        }

        // Only trigger debounced refetch for meaningful updates
        // (avoid refetch on minor updates like viewer count changes)
        const oldStream = payload.old as any;
        if (oldStream && oldStream.status !== updatedStream.status) {
          debouncedRefetch();
        }
        return;
      }

      // Handle INSERT - new stream created, refetch
      if (payload.eventType === 'INSERT') {
        debouncedRefetch();
      }
    }).subscribe();
    return () => {
      if (refetchTimeout) clearTimeout(refetchTimeout);
      supabase.removeChannel(channel);
    };
  }, []);

  // Improved cleanup on unmount
  useEffect(() => {
    return () => {
      if (isCleaningUpRef.current) return;
      isCleaningUpRef.current = true;
      console.log('Component unmounting, cleaning up...');

      // 1. Stop media tracks first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped ${track.kind} track`);
        });
      }

      // Phase 5: Reset permission states
      setHasCameraPermission(false);
      setHasMicPermission(false);
      setIsCameraOn(false);
      setIsMicOn(false);

      // 2. Cleanup broadcast manager
      if (broadcastManagerRef.current) {
        console.log('Cleaning up broadcast manager');
        broadcastManagerRef.current.cleanup();
      }

      // 3. Clear intervals
      if (viewerCountIntervalRef.current) {
        clearInterval(viewerCountIntervalRef.current);
      }

      // 4. Update database if streaming (use ref for current value) - Archive immediately
      if (activeStreamIdRef.current) {
        console.log('Archiving stream on unmount');
        supabase.from('streaming_sessions').update({
          status: 'archived',
          ended_at: new Date().toISOString(),
          current_viewers: 0
        }).eq('id', activeStreamIdRef.current).then(() => console.log('Stream archived on unmount'));
      }
    };
  }, []);

  // Browser close/refresh handler - end stream before page unloads
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeStreamId && isStreaming) {
        console.log('🚪 Browser closing/refreshing - ending stream synchronously');
        
        // Synchronously update the database before page closes
        const xhr = new XMLHttpRequest();
        xhr.open('PATCH', `https://kdvnxzniqyomdeicmycs.supabase.co/rest/v1/streaming_sessions?id=eq.${activeStreamId}`, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkdm54em5pcXlvbWRlaWNteWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjA4NjAsImV4cCI6MjA3MDY5Njg2MH0.OpjCOM_0uI5MujiR191FXaGx_INpWPGPXY6Z6oJEb5E');
        xhr.setRequestHeader('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkdm54em5pcXlvbWRlaWNteWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjA4NjAsImV4cCI6MjA3MDY5Njg2MH0.OpjCOM_0uI5MujiR191FXaGx_INpWPGPXY6Z6oJEb5E');
        xhr.setRequestHeader('Prefer', 'return=minimal');
        
        try {
          xhr.send(JSON.stringify({
            status: 'archived',
            ended_at: new Date().toISOString(),
            current_viewers: 0
          }));
        } catch (error) {
          console.error('Failed to end stream on unload:', error);
        }
        
        // Show confirmation dialog
        e.preventDefault();
        e.returnValue = 'You are currently streaming. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeStreamId, isStreaming]);

  // Handle browser visibility changes - check and restore connection when tab becomes visible
  useEffect(() => {
    if (!isStreaming || !broadcastManagerRef.current) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📱 Tab hidden - connection may throttle');
      } else {
        console.log('📱 Tab visible - checking connection health');
        
        // Check connection health when tab becomes visible
        const health = broadcastManagerRef.current?.checkChannelHealth();
        setConnectionHealth(health || null);
        
        if (health && !health.isHealthy) {
          console.warn('⚠️ Connection unhealthy after tab switch, may auto-reconnect');
          setIsReconnecting(true);
          
          // Clear reconnecting flag after a few seconds
          setTimeout(() => setIsReconnecting(false), 5000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isStreaming]);

  // Monitor connection health periodically while streaming
  useEffect(() => {
    if (!isStreaming || !broadcastManagerRef.current) return;

    const healthCheckInterval = setInterval(() => {
      const health = broadcastManagerRef.current?.checkChannelHealth();
      setConnectionHealth(health || null);
      
      if (health && !health.isHealthy) {
        console.warn('⚠️ Connection health check failed:', health.details);
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(healthCheckInterval);
  }, [isStreaming]);
  
  const initializeMedia = async (requestVideo: boolean, requestAudio: boolean) => {
    if (requestVideo) setIsRequestingCamera(true);
    if (requestAudio) setIsRequestingMic(true);
    try {
      const constraints: MediaStreamConstraints = {};
      if (requestVideo) {
        constraints.video = {
          width: {
            ideal: 720
          },
          height: {
            ideal: 1280
          },
          facingMode: 'user'
        };
      }
      if (requestAudio) {
        constraints.audio = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        };
      }
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Smart track management: only stop tracks being replaced
      if (streamRef.current) {
        if (requestVideo) {
          // Stop old video tracks if requesting new video
          streamRef.current.getVideoTracks().forEach(track => {
            console.log('🛑 Stopping old video track');
            track.stop();
            streamRef.current?.removeTrack(track);
          });
        }
        if (requestAudio) {
          // Stop old audio tracks if requesting new audio
          streamRef.current.getAudioTracks().forEach(track => {
            console.log('🛑 Stopping old audio track');
            track.stop();
            streamRef.current?.removeTrack(track);
          });
        }

        // Add new tracks to existing stream
        newStream.getTracks().forEach(track => {
          console.log(`➕ Adding ${track.kind} track to stream`);
          streamRef.current?.addTrack(track);
        });
      } else {
        // No existing stream, use new one
        streamRef.current = newStream;
      }

      // Log all tracks for debugging
      console.log('📹 Current media stream tracks:');
      streamRef.current?.getTracks().forEach(track => {
        console.log(`  ${track.kind}: enabled=${track.enabled}, state=${track.readyState}, label="${track.label}"`);
      });

      // Set video element once and play
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
        
        // Update host stream state for VideoCallGrid
        console.log('✅ Setting host stream state for VideoCallGrid');
        setHostStream(streamRef.current);
      }
      if (requestVideo) {
        setHasCameraPermission(true);
        setIsCameraOn(true);
      }
      if (requestAudio) {
        setHasMicPermission(true);
        setIsMicOn(true);
      }
      const mediaTypes = [];
      if (requestVideo) mediaTypes.push('Camera');
      if (requestAudio) mediaTypes.push('Microphone');
      toast({
        title: "Media enabled ✓",
        description: `${mediaTypes.join(' and ')} ready to stream.`
      });
    } catch (error: any) {
      console.error('Error accessing media:', error);
      if (requestVideo) setHasCameraPermission(false);
      if (requestAudio) setHasMicPermission(false);
      let errorMessage = "Please enable permissions.";
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permission denied. Please click 'Allow' to grant access.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = `No ${requestVideo ? 'camera' : 'microphone'} found. Please connect a device.`;
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Device is already in use. Please close other apps.";
      }
      toast({
        title: "Media access failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      if (requestVideo) setIsRequestingCamera(false);
      if (requestAudio) setIsRequestingMic(false);
    }
  };
  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };
  const toggleMicrophone = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };
  // Helper function to validate MediaStream
  const validateMediaStream = (stream: MediaStream | null): boolean => {
    if (!stream) {
      console.warn('⚠️ Stream is null');
      return false;
    }
    
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.warn('⚠️ No video tracks in stream');
      return false;
    }
    
    const videoTrack = videoTracks[0];
    if (!videoTrack.enabled) {
      console.warn('⚠️ Video track is disabled');
      return false;
    }
    
    if (videoTrack.readyState !== 'live') {
      console.warn('⚠️ Video track is not live, state:', videoTrack.readyState);
      return false;
    }
    
    console.log('✅ Stream is valid:', {
      trackCount: videoTracks.length,
      enabled: videoTrack.enabled,
      readyState: videoTrack.readyState
    });
    return true;
  };

  const startStream = async () => {
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please sign in to start streaming.",
        variant: "destructive"
      });
      return;
    }
    if (!streamTitle.trim()) {
      toast({
        title: "Missing title",
        description: "Please enter a stream title.",
        variant: "destructive"
      });
      return;
    }
    if (!streamRef.current) {
      toast({
        title: "Camera not ready",
        description: "Please enable your camera first.",
        variant: "destructive"
      });
      return;
    }

    // Verify camera is actually capturing (Phase 7)
    const videoTracks = streamRef.current.getVideoTracks();
    const audioTracks = streamRef.current.getAudioTracks();
    if (videoTracks.length === 0) {
      toast({
        title: "No video source",
        description: "Please enable your camera to start streaming.",
        variant: "destructive"
      });
      return;
    }

    // Test if camera is actually capturing frames
    const videoTrack = videoTracks[0];
    const settings = videoTrack.getSettings();
    console.log('📹 Camera settings:', settings);
    if (!videoTrack.enabled || videoTrack.readyState !== 'live') {
      toast({
        title: "Camera not active",
        description: "Video track is not live. Please check your camera.",
        variant: "destructive"
      });
      return;
    }
    if (settings.width === 0 || settings.height === 0) {
      toast({
        title: "Camera error",
        description: "Camera is not capturing video frames.",
        variant: "destructive"
      });
      return;
    }
    console.log(`✅ Verified: ${videoTracks.length} video tracks, ${audioTracks.length} audio tracks`);
    console.log(`📹 Video: ${settings.width}x${settings.height}, enabled: ${videoTrack.enabled}, state: ${videoTrack.readyState}`);
    setIsLoading(true);
    setStreamLifecycle('preparing');
    try {
      console.log("🎬 Starting stream...");
      console.log("Stream payload:", {
        title: streamTitle,
        description: `Live stream by ${user.user_metadata?.display_name || 'Anonymous'}`,
        host_user_id: user.id,
        category: streamCategory
      });

      // Phase 7: Check for existing active stream and archive it
      const {
        data: existingStream
      } = await supabase.from('streaming_sessions').select('id').eq('host_user_id', user.id).eq('status', 'live').maybeSingle();
      if (existingStream) {
        console.log('Found existing active stream, archiving it first...');
        // Auto-archive the old stream
        await supabase.from('streaming_sessions').update({
          status: 'archived',
          ended_at: new Date().toISOString(),
          current_viewers: 0
        }).eq('id', existingStream.id);
      }
      const {
        data,
        error
      } = await supabase.from('streaming_sessions').insert({
        title: streamTitle,
        description: `Live stream by ${user.user_metadata?.display_name || 'Anonymous'}`,
        host_user_id: user.id,
        status: 'waiting',
        is_private: false,
        ar_space_data: {
          category: streamCategory || 'General'
        }
      }).select().single();
      if (error) {
        console.error("Supabase insert error:", error);
        throw error;
      }
      console.log("Stream created:", data);
      setActiveStreamId(data.id);
      activeStreamIdRef.current = data.id;
      setIsStreaming(true);
      setStreamLifecycle('waiting');

      // Re-synchronize hostStream state before broadcasting
      console.log('🔄 Re-synchronizing hostStream state...');
      if (validateMediaStream(streamRef.current)) {
        setHostStream(streamRef.current);
        console.log('✅ hostStream state updated:', streamRef.current.id);
      } else {
        console.error('❌ Stream validation failed before broadcast');
        throw new Error('Stream validation failed');
      }

      // Initialize broadcast manager with current stream
      broadcastManagerRef.current = new BroadcastManager(data.id, streamRef.current);

      // Set up status handler
      broadcastManagerRef.current.setChannelStatusHandler(async status => {
        console.log('Channel status changed:', status);
        if (status === 'connecting') {
          setChannelStatus('connecting');
        } else if (status === 'connected') {
          setChannelStatus('connected');

          // Wait a moment for initial DB poll and catch-up to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Update stream to live once channel is ready and polling is active
          const {
            error: updateError
          } = await supabase.from('streaming_sessions').update({
            status: 'live',
            started_at: new Date().toISOString()
          }).eq('id', data.id);
          if (updateError) {
            console.error('Error updating stream to live:', updateError);
          } else {
            console.log('✅ Stream is now live and ready for viewers');
            setStreamLifecycle('live');
            setIsBroadcastReady(true);
          }
        } else if (status === 'error') {
          setChannelStatus('error');
        } else if (status === 'closed') {
          setChannelStatus('disconnected');
        }
      });
      
      console.log('🔧 Initializing BroadcastManager channel...');
      await broadcastManagerRef.current.initializeChannel(supabase);
      console.log('✅ BroadcastManager initialization complete');

      // Initialize viewer camera receiver
      viewerCameraReceiverRef.current = new ViewerCameraReceiver(
        data.id,
        (cameras) => {
          setViewerCameras(new Map(cameras));
        },
        async (viewerInfo) => {
          // Notify relay system about new viewer camera
          if (viewerStreamRelayRef.current) {
            await viewerStreamRelayRef.current.onNewViewerCamera(viewerInfo);
          }
        }
      );
      await viewerCameraReceiverRef.current.initialize();
      console.log('✅ Viewer camera receiver initialized');

  // Initialize viewer stream relay to forward cameras to other viewers
      viewerStreamRelayRef.current = new ViewerStreamRelay(data.id);
      await viewerStreamRelayRef.current.initialize();
      console.log('✅ Viewer stream relay initialized');

      // Load and register existing viewers with the relay
      const { data: existingViewers } = await supabase
        .from('stream_viewer_sessions')
        .select('session_token, viewer_display_name')
        .eq('stream_id', data.id)
        .is('left_at', null);

      if (existingViewers && existingViewers.length > 0) {
        console.log(`📡 Registering ${existingViewers.length} existing viewers with relay`);
        for (const viewer of existingViewers) {
          viewerStreamRelayRef.current.notifyViewerJoined(
            viewer.session_token,
            viewer.viewer_display_name || 'Viewer'
          );
        }
      }

      // Fetch ICE servers to check TURN availability
      try {
        const {
          data: iceData
        } = await supabase.functions.invoke('get-ice-servers');
        if (iceData) {
          setHasTURN(iceData.hasTURN);
        }
      } catch (err) {
        console.error('Failed to fetch ICE servers:', err);
      }

      // Update viewer count periodically
      viewerCountIntervalRef.current = setInterval(async () => {
        const count = broadcastManagerRef.current?.getViewerCount() || 0;
        setCurrentViewers(count);
        await supabase.from('streaming_sessions').update({
          current_viewers: count
        }).eq('id', data.id);
      }, 3000);
      console.log('✅ Broadcast setup initiated');
      setIsLoading(false);
      toast({
        title: "🎥 Stream Starting...",
        description: "Establishing broadcast connection"
      });
    } catch (error: any) {
      console.error('Error starting stream:', error);

      // Enhanced error messages
      let errorTitle = "Failed to start stream";
      let errorDescription = error.message || "Unknown error";
      if (error.code) {
        errorDescription = `Error ${error.code}: ${error.message}`;
      }
      if (error.hint) {
        errorDescription += `\nHint: ${error.hint}`;
      }
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
        duration: 10000
      });
      setStreamLifecycle('idle');
      setChannelStatus('disconnected');
      setIsStreaming(false);
      setIsLoading(false);
    }
  };
  const handleHostReconnect = async () => {
    if (!broadcastManagerRef.current) {
      toast({
        title: "Not broadcasting",
        description: "You must be live to reconnect.",
        variant: "destructive"
      });
      return;
    }

    try {
      toast({
        title: "Reconnecting...",
        description: "Resetting broadcast connection. Viewers will reconnect automatically."
      });
      
      await broadcastManagerRef.current.resetStream(supabase);
      
      toast({
        title: "Reconnection complete",
        description: "Broadcast has been reset successfully."
      });
    } catch (error) {
      console.error('Host reconnection failed:', error);
      toast({
        title: "Reconnection failed",
        description: "Could not reset broadcast. Try ending and restarting the stream.",
        variant: "destructive"
      });
    }
  };

  const endStream = async () => {
    if (!activeStreamId) return;
    setStreamLifecycle('ending');
    setIsLoading(true);
    try {
      // Cleanup viewer count interval
      if (viewerCountIntervalRef.current) {
        clearInterval(viewerCountIntervalRef.current);
        viewerCountIntervalRef.current = null;
      }

      // Cleanup broadcast manager
      if (broadcastManagerRef.current) {
        broadcastManagerRef.current.cleanup();
        broadcastManagerRef.current = null;
      }
      
      // Cleanup viewer camera receiver
      if (viewerCameraReceiverRef.current) {
        viewerCameraReceiverRef.current.cleanup();
        viewerCameraReceiverRef.current = null;
      }
      
      // Cleanup viewer stream relay
      if (viewerStreamRelayRef.current) {
        viewerStreamRelayRef.current.cleanup();
        viewerStreamRelayRef.current = null;
      }
      
      setViewerCameras(new Map());
      
      setChannelStatus('disconnected');

      // Phase 1: Stop all media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`✅ Stopped ${track.kind} track`);
        });
        streamRef.current = null;
      }

      // Clear video preview
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.pause();
      }

      // Reset states
      setIsCameraOn(false);
      setIsMicOn(false);

      // Update database - Archive immediately
      const {
        error
      } = await supabase.from('streaming_sessions').update({
        status: 'archived',
        ended_at: new Date().toISOString(),
        current_viewers: 0
      }).eq('id', activeStreamId);
      if (error) {
        console.error('Error archiving stream:', error);
      }
      setIsStreaming(false);
      setActiveStreamId(null);
      setCurrentViewers(0);
      setTotalLikes(0);
      setTotalGifts(0);
      setStreamLifecycle('ended');
      setChannelStatus('disconnected');

      // Phase 6: Enhanced visual feedback
      toast({
        title: "🎬 Stream ended and archived",
        description: `Thanks for streaming! ${currentViewers} viewers watched. Stream archived.`
      });
    } catch (error: any) {
      console.error('Error ending stream:', error);
      toast({
        title: "Error ending stream",
        description: "Stream has been stopped locally.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const forceEndStream = async (streamId: string, streamTitle: string) => {
    try {
      const {
        error
      } = await supabase.from('streaming_sessions').update({
        status: 'archived',
        ended_at: new Date().toISOString(),
        current_viewers: 0
      }).eq('id', streamId);
      if (error) {
        console.error('Error force ending stream:', error);
        toast({
          title: "Error ending stream",
          description: "Failed to force end the stream.",
          variant: "destructive"
        });
        return;
      }

      // Refresh live streams list
      const {
        data: updatedStreams
      } = await supabase.from('streaming_sessions').select('*').eq('status', 'live');
      if (updatedStreams) {
        setLiveStreams(updatedStreams as StreamData[]);
      }
      toast({
        title: "Stream ended",
        description: `"${streamTitle}" has been forcefully ended.`
      });
    } catch (error) {
      console.error('Error force ending stream:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    }
  };
  const joinStream = (stream: StreamData, useTikTokMode: boolean = isTikTokMode) => {
    setViewingStreamId(stream.id);
    setViewingStreamData(stream);
    setIsTikTokMode(useTikTokMode);
  };
  const closeStreamViewer = () => {
    setViewingStreamId(null);
    setViewingStreamData(null);
    setIsTikTokMode(false);
  };
  
  const handleTikTokNext = () => {
    goToNext();
    if (currentStream) {
      setViewingStreamId(currentStream.id);
      setViewingStreamData({
        id: currentStream.id,
        title: currentStream.title,
        description: '',
        host_user_id: currentStream.host_user_id,
        host_name: currentStream.host_name,
        current_viewers: currentStream.current_viewers,
        status: 'live',
        created_at: new Date().toISOString(),
        total_likes: currentStream.total_likes
      });
    }
  };
  
  const handleTikTokPrevious = () => {
    goToPrevious();
    if (currentStream) {
      setViewingStreamId(currentStream.id);
      setViewingStreamData({
        id: currentStream.id,
        title: currentStream.title,
        description: '',
        host_user_id: currentStream.host_user_id,
        host_name: currentStream.host_name,
        current_viewers: currentStream.current_viewers,
        status: 'live',
        created_at: new Date().toISOString(),
        total_likes: currentStream.total_likes
      });
    }
  };
  const handleManageStream = () => {
    navigate('/app/streaming/go-live');
  };
  const handleViewAsViewer = () => {
    if (myActiveStream) {
      setViewingStreamId(myActiveStream.id);
      setViewingStreamData({
        id: myActiveStream.id,
        title: myActiveStream.title,
        description: myActiveStream.description,
        host_user_id: myActiveStream.host_user_id,
        host_name: user?.user_metadata?.display_name || 'You',
        current_viewers: myActiveStream.current_viewers,
        status: myActiveStream.status as 'live' | 'ended' | 'pending',
        created_at: myActiveStream.created_at
      });
    }
  };
  return <div className="min-h-screen dark bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            {onBack && <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>}
            <h1 className="text-2xl font-afro-heading">Live Streaming</h1>
          </div>
          <CurrencyWallet onBuyCoins={() => setShowCoinShop(true)} />
        </div>

        <Tabs value={activeTab} onValueChange={value => navigate(`/app/streaming/${value}`)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="discover">Discover Streams</TabsTrigger>
            <TabsTrigger value="go-live">Go Live</TabsTrigger>
          </TabsList>

          {/* Discover Tab */}
          <TabsContent value="discover" className="space-y-6">
            {/* My Active Stream Banner */}
            {myActiveStream && <MyActiveStreamBanner streamId={myActiveStream.id} title={myActiveStream.title} startedAt={myActiveStream.created_at} currentViewers={myActiveStream.current_viewers || 0} totalLikes={totalLikes} onManageStream={handleManageStream} onViewAsViewer={handleViewAsViewer} />}

            <div className="text-center mb-8">
              <h2 className="text-xl font-afro-heading mb-2">Live Cultural Streams</h2>
              <p className="text-muted-foreground mb-3">
                Connect with your community through live cultural content
              </p>
              <div className="flex items-center justify-center gap-3">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  ✨ Real-time Streaming
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (liveStreams.length > 0) {
                      joinStream(liveStreams[0], true);
                    } else {
                      toast({
                        title: "No live streams",
                        description: "There are no live streams available right now",
                      });
                    }
                  }}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  TikTok Mode
                </Button>
              </div>
            </div>


            {/* Live Streams Grid */}
            {/* Phase 5: Filter out obviously stale streams client-side */}
            {liveStreams.filter(stream => {
            // Always exclude ended/archived streams
            if (stream.status !== 'live') return false;

            // If started_at is null and created more than 1 hour ago, it's stale
            if (!stream.started_at && stream.created_at) {
              const ageHours = (Date.now() - new Date(stream.created_at).getTime()) / (1000 * 60 * 60);
              if (ageHours > 1) {
                console.warn('Filtering out stale stream:', stream.title);
                return false;
              }
            }

            // If started more than 6 hours ago, it's stale
            if (stream.started_at) {
              const ageHours = (Date.now() - new Date(stream.started_at).getTime()) / (1000 * 60 * 60);
              if (ageHours > 6) {
                console.warn('Filtering out long-running stream:', stream.title);
                return false;
              }
            }
            return true;
          }).length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveStreams.filter(stream => {
              // Always exclude ended/archived streams
              if (stream.status !== 'live') return false;

              // Apply same health check filter
              if (!stream.started_at && stream.created_at) {
                const ageHours = (Date.now() - new Date(stream.created_at).getTime()) / (1000 * 60 * 60);
                if (ageHours > 1) return false;
              }
              if (stream.started_at) {
                const ageHours = (Date.now() - new Date(stream.started_at).getTime()) / (1000 * 60 * 60);
                if (ageHours > 6) return false;
              }
              return true;
            }).map(stream => <Card key={stream.id} className="cultural-card hover:shadow-lg transition-all cursor-pointer group overflow-hidden" onClick={() => joinStream(stream)}>
                    <div className="relative">
                      {/* Stream Thumbnail */}
                      <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
                        {stream.thumbnail ? (
                          <img 
                            src={stream.thumbnail} 
                            alt={stream.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                        
                        {/* Live Badge */}
                        <div className="absolute top-3 left-3 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                          LIVE
                        </div>

                        {/* Viewer Count */}
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" />
                          {stream.current_viewers}
                        </div>

                        {/* Play Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                            <Play className="w-7 h-7 text-white ml-1" />
                          </div>
                        </div>
                      </div>

                      {/* Stream Info */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10 border-2 border-primary/20">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.host_user_id}`} />
                            <AvatarFallback>{stream.host_name?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base line-clamp-1">{stream.title}</h3>
                            <p className="text-sm text-muted-foreground">{stream.host_name}</p>
                          </div>
                        </div>
                        
                        {/* Category Badge */}
                        {stream.category && (
                          <Badge variant="outline" className="text-xs">
                            {stream.category}
                          </Badge>
                        )}
                        
                        {/* Stats */}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                          <div className="flex items-center gap-1">
                            <Heart className="w-4 h-4 text-destructive" />
                            {stream.total_likes || 0}
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {stream.current_viewers} watching
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>)}
              </div> : <Card className="p-12 text-center">
                <div className="space-y-3">
                  <Video className="w-12 h-12 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-semibold">No Live Streams</h3>
                  <p className="text-muted-foreground">
                    Be the first to go live! Switch to the "Go Live" tab to start streaming.
                  </p>
                </div>
              </Card>}

            {/* Premium Live Events */}
            <Card className="premium-gradient p-6 text-center mt-6">
              <h3 className="text-xl font-afro-heading mb-2 text-white">
                Premium Live Events
              </h3>
              <p className="text-white/90 mb-4">
                Exclusive cultural events, matchmaking sessions, and premium content
              </p>
              <Button variant="secondary">
                <Crown className="w-4 h-4 mr-2" />
                Unlock Premium Events
              </Button>
            </Card>
          </TabsContent>

          {/* Go Live Tab */}
          <TabsContent value="go-live" className="space-y-6">
            <div className={`grid gap-6 ${isStreaming ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
              {/* Stream Setup */}
              <Card className="cultural-card">
                <CardHeader>
                  <CardTitle>Stream Setup</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Stream Title</label>
                    <Input value={streamTitle} onChange={e => setStreamTitle(e.target.value)} placeholder="What's your stream about?" className="mt-1" />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <Select onValueChange={setStreamCategory}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="music">Music</SelectItem>
                        <SelectItem value="lifestyle">Lifestyle</SelectItem>
                        <SelectItem value="food">Food & Cooking</SelectItem>
                        <SelectItem value="culture">Culture</SelectItem>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="dating">Dating & Relationships</SelectItem>
                        <SelectItem value="gaming">Gaming</SelectItem>
                        <SelectItem value="fitness">Fitness & Health</SelectItem>
                        <SelectItem value="beauty">Beauty & Fashion</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="sports">Sports</SelectItem>
                        <SelectItem value="comedy">Comedy & Entertainment</SelectItem>
                        <SelectItem value="art">Art & Creativity</SelectItem>
                        <SelectItem value="business">Business & Finance</SelectItem>
                        <SelectItem value="tvshow">TV Show</SelectItem>
                        <SelectItem value="politics">Politics</SelectItem>
                        <SelectItem value="history">History</SelectItem>
                        <SelectItem value="religion">Religion</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                   {isStreaming && <div className="p-4 bg-muted rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Broadcasting Status:</span>
                        <Badge className="bg-green-500 text-white">
                          <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                          Live via WebRTC
                        </Badge>
                      </div>
                      
                      {/* Connection Status Indicator */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connection:</span>
                        {channelStatus === 'connected' && !isReconnecting ? (
                          <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        ) : channelStatus === 'connecting' || isReconnecting ? (
                          <Badge variant="outline" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-700">
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            {isReconnecting ? 'Reconnecting...' : 'Connecting...'}
                          </Badge>
                        ) : channelStatus === 'error' ? (
                          <Badge variant="outline" className="bg-red-500/10 border-red-500/30 text-red-700">
                            <XCircle className="w-3 h-3 mr-1" />
                            Connection Error
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-500/10 border-gray-500/30">
                            <Activity className="w-3 h-3 mr-1" />
                            Disconnected
                          </Badge>
                        )}
                      </div>
                      
                      {connectionHealth && !connectionHealth.isHealthy && (
                        <div className="text-xs text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Connection quality degraded - auto-reconnecting
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connected Viewers:</span>
                        <Badge variant="secondary">{currentViewers} watching</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Likes:</span>
                        <Badge variant="outline">{totalLikes}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Gifts Received:</span>
                        <Badge variant="outline" className="gap-1">
                          <Gift className="w-3 h-3" />
                          {totalGifts}
                        </Badge>
                      </div>
                      {balance && balance.gold_balance > 0 && <div className="flex items-center justify-between">
                          <span className="text-sm">Gold Earned:</span>
                          <Badge variant="outline" className="gap-1 bg-amber-500/10 border-amber-500/30">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span className="text-amber-500">{balance.gold_balance}</span>
                          </Badge>
                        </div>}
                      
                    </div>}
                </CardContent>
              </Card>

              {/* Video Preview */}
              <Card className="cultural-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Preview</span>
                    {isStreaming && <Badge variant="secondary" className="text-xs">
                        🔴 Broadcasting to {currentViewers} viewers
                      </Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-[9/16] max-w-md mx-auto">
                    {isStreaming ? (
                      // Use VideoCallGrid when streaming to show host + viewers
                      <VideoCallGrid
                        hostStream={hostStream}
                        hostName="You (Host)"
                        viewerCameras={viewerCameras}
                        viewerStream={undefined}
                        viewerCameraEnabled={false}
                      />
                    ) : (
                      // Show preview before streaming
                      <>
                        {isCameraOn ? <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white">
                            <VideoOff className="w-12 h-12" />
                          </div>}
                      </>
                    )}
                    
                    {isStreaming && <Badge className="absolute top-2 left-2 bg-red-500 text-white z-30">
                        <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                        LIVE
                      </Badge>}

                    {/* Like Animation Overlay */}
                    {isStreaming && <LikeAnimation key={likeAnimationTrigger} show={showLikeAnimation} onComplete={() => setShowLikeAnimation(false)} />}

                    {/* Floating Chat Messages Overlay */}
                    {isStreaming && (
                      <div className="absolute bottom-4 left-4 right-16 space-y-2 z-20 pointer-events-none">
                        {floatingChatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className="bg-black/60 backdrop-blur-sm rounded-2xl px-3 py-2 animate-slide-in-right max-w-xs"
                          >
                            <span className="text-white font-semibold text-sm">{msg.username}: </span>
                            <span className="text-white text-sm">{msg.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Gift Notifications Overlay */}
                    {isStreaming && giftNotifications.length > 0 && <div className="absolute top-16 right-4 space-y-2 z-10">
                        {giftNotifications.map(notification => <div key={notification.id} className="bg-black/80 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-lg animate-fade-in flex items-center gap-3">
                            <span className="text-3xl">{notification.giftEmoji}</span>
                            <div>
                              <p className="font-semibold text-sm">{notification.senderName}</p>
                              <p className="text-xs text-gray-300">sent {notification.giftName}</p>
                            </div>
                            <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
                          </div>)}
                      </div>}
                  </div>

                  {/* Controls */}
                  <div className="mt-4 space-y-3">
                    {/* Permission Buttons - Always Visible */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={() => {
                      if (!hasCameraPermission) {
                        initializeMedia(true, false);
                      } else {
                        toggleCamera();
                      }
                    }} disabled={isRequestingCamera} variant="outline" size="sm">
                        {isCameraOn ? <Video className="w-4 h-4 mr-2" /> : <VideoOff className="w-4 h-4 mr-2" />}
                        {isRequestingCamera ? 'Requesting...' : !hasCameraPermission ? 'Enable Camera' : isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
                      </Button>
                      <Button onClick={() => {
                      if (!hasMicPermission) {
                        initializeMedia(false, true);
                      } else {
                        toggleMicrophone();
                      }
                    }} disabled={isRequestingMic} variant="outline" size="sm">
                        {isMicOn ? <Mic className="w-4 h-4 mr-2" /> : <MicOff className="w-4 h-4 mr-2" />}
                        {isRequestingMic ? 'Requesting...' : !hasMicPermission ? 'Enable Mic' : isMicOn ? 'Turn Off Mic' : 'Turn On Mic'}
                      </Button>
                    </div>
                    
                    {/* Toggle Controls - Always Visible */}
                    <div className="flex items-center justify-center space-x-4">
                      <Button variant={isCameraOn ? "default" : "secondary"} size="sm" onClick={toggleCamera} disabled={!hasCameraPermission}>
                        {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      </Button>
                      
                      <Button variant={isMicOn ? "default" : "secondary"} size="sm" onClick={toggleMicrophone} disabled={!hasMicPermission}>
                        {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      </Button>
                      
                      <Button variant="ghost" size="sm" onClick={() => setShowTroubleshooting(true)}>
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Helper Text */}
                    <p className="text-xs text-muted-foreground text-center">
                      {!hasCameraPermission || !hasMicPermission ? 'Grant camera and mic permissions to go live' : 'Camera and mic are ready'}
                    </p>
                  </div>

                  {/* Diagnostics Panel - Hidden in production */}


                  {/* Go Live Button */}
                  <div className="mt-6 space-y-2">
                    {!isStreaming ? <>
                        <Button onClick={startStream} disabled={!streamTitle.trim() || isLoading || !streamRef.current || !streamRef.current.getVideoTracks()[0]?.enabled || streamRef.current.getVideoTracks()[0]?.readyState !== 'live'} className="w-full bg-red-500 hover:bg-red-600 text-white" size="lg">
                          {isLoading ? 'Starting...' : 'Start Streaming'}
                        </Button>
                        {hasCameraPermission && <p className="text-xs text-muted-foreground text-center">
                            Viewers will connect to your stream in real-time via peer-to-peer connection
                          </p>}
                      </> : <Button onClick={endStream} variant="destructive" className="w-full" size="lg">
                        {isLoading ? 'Ending...' : 'End Stream'}
                      </Button>}
                    {!hasCameraPermission && <p className="text-sm text-muted-foreground text-center mt-2">
                      Enable camera to start broadcasting
                    </p>}
                  </div>
                </CardContent>
              </Card>

              {/* Live Chat & Viewers (only when streaming) */}
              {isStreaming && activeStreamId && (
                <div className="space-y-4 lg:row-span-2">
                  {/* Viewer Cameras Card */}
                  <ViewerCameraThumbnails 
                    viewerCameras={viewerCameras}
                    className="max-h-[400px]"
                  />
                  
                  {/* Active Viewers Card */}
                  <Card className="cultural-card">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Active Viewers ({activeViewers.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        {viewersLoading ? (
                          <p className="text-sm text-muted-foreground">Loading viewers...</p>
                        ) : activeViewers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No viewers yet</p>
                        ) : (
                          <div className="space-y-2">
                            {activeViewers.map((viewer) => (
                              <div 
                                key={viewer.session_id} 
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                              >
                                <Avatar className="w-8 h-8 relative">
                                  <AvatarImage src={viewer.avatar_url || '/placeholder.svg'} />
                                  <AvatarFallback>
                                    {viewer.viewer_display_name[0]?.toUpperCase() || 'G'}
                                  </AvatarFallback>
                                  {viewer.camera_stream_active && (
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                      <Video className="w-2.5 h-2.5 text-primary-foreground" />
                                    </div>
                                  )}
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate flex items-center gap-1">
                                    {viewer.viewer_display_name}
                                    {viewer.camera_enabled && (
                                      <Video className="w-3 h-3 text-primary" />
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {viewer.is_guest ? 'Guest' : 'Member'}
                                    {viewer.camera_stream_active && ' • Camera active'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Live Chat Card */}
                  <Card className="cultural-card flex flex-col h-[500px]">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <CardTitle className="text-base">Live Chat</CardTitle>
                      <Button size="sm" variant="ghost" onClick={() => setShowStreamerChat(!showStreamerChat)} className="h-8 w-8 p-0">
                        {showStreamerChat ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      </Button>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-hidden">
                      {showStreamerChat && <LiveStreamChat streamId={activeStreamId} isMobile={false} />}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Conditional viewer rendering based on mode */}
      {viewingStreamId && viewingStreamData && (
        isTikTokMode ? (
          <TikTokStreamViewer
            streamId={viewingStreamId}
            streamTitle={viewingStreamData.title}
            hostName={viewingStreamData.host_name || 'Anonymous'}
            hostUserId={viewingStreamData.host_user_id}
            currentViewers={viewingStreamData.current_viewers}
            totalLikes={viewingStreamData.total_likes || 0}
            onClose={closeStreamViewer}
            onNext={hasNext ? handleTikTokNext : undefined}
            onPrevious={hasPrevious ? handleTikTokPrevious : undefined}
            hasNext={hasNext}
            hasPrevious={hasPrevious}
          />
        ) : (
          <StreamViewer
            streamId={viewingStreamId}
            streamTitle={viewingStreamData.title}
            hostName={viewingStreamData.host_name || 'Anonymous'}
            hostUserId={viewingStreamData.host_user_id}
            onClose={closeStreamViewer}
          />
        )
      )}

      <CoinShop open={showCoinShop} onOpenChange={setShowCoinShop} />

      <CameraTroubleshootingWizard open={showTroubleshooting} onOpenChange={setShowTroubleshooting} />
    </div>;
};
export default StreamingInterface;