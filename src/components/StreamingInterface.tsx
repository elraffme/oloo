import React, { useState, useEffect, useRef } from 'react';
import { useStream } from '@/hooks/useStream';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, VideoOff, Mic, MicOff, Settings, Users, Eye, Heart, Gift, Share2, MoreVertical, Play, Pause, Volume2, ArrowLeft, Crown, Sparkles, User, ChevronRight, ChevronLeft, Radio, CheckCircle2, XCircle, Activity, RefreshCw, Maximize2, Minimize2, FlipHorizontal, Wand2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  const {
    initialize,
    cleanup,
    checkChannelHealth,
    viewerStreams
  } = useStream();

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
  const [connectionHealth, setConnectionHealth] = useState<{
    isHealthy: boolean;
    details: any;
  } | null>(null);
  const isCleaningUpRef = useRef(false);
  const activeStreamIdRef = useRef<string | null>(null);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
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
  const [isHostFullscreen, setIsHostFullscreen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [activeFilter, setActiveFilter] = useState<string>('none');

  // Filter presets for TikTok-style effects
  const filters = [{
    id: 'none',
    name: 'Normal',
    style: ''
  }, {
    id: 'warm',
    name: 'Warm',
    style: 'sepia(20%) saturate(120%) brightness(105%)'
  }, {
    id: 'cool',
    name: 'Cool',
    style: 'hue-rotate(15deg) saturate(90%) brightness(105%)'
  }, {
    id: 'enhance',
    name: 'Enhance',
    style: 'contrast(110%) saturate(120%) brightness(105%)'
  }, {
    id: 'soft',
    name: 'Soft',
    style: 'brightness(105%) contrast(95%)'
  }, {
    id: 'vivid',
    name: 'Vivid',
    style: 'saturate(150%) contrast(110%)'
  }, {
    id: 'bw',
    name: 'B&W',
    style: 'grayscale(100%)'
  }, {
    id: 'vintage',
    name: 'Vintage',
    style: 'sepia(40%) contrast(90%) brightness(95%)'
  }];
  // Derived map for VideoCallGrid compatibility from SFU streams
  const viewerCameras = new Map(viewerStreams.map(vs => [vs.id, {
    stream: vs.stream,
    displayName: 'Viewer',
    sessionToken: vs.id
  }]));
  console.log(viewerCameras, 'viewer cameras');

  // Debug: Log viewer cameras updates
  useEffect(() => {
    console.log('🎥 Host: Viewer cameras updated, count:', viewerCameras.size);
    viewerCameras.forEach((camera, token) => {
      console.log('  - Viewer camera:', camera.displayName, 'token:', token);
    });
  }, [viewerCameras]);

  // Real-time stream state monitoring while streaming
  // useEffect(() => {
  //   if (!isStreaming || !streamRef.current) return;

  //   const monitorInterval = setInterval(() => {
  //     if (!streamRef.current) {
  //       console.warn('⚠️ Stream ref lost during monitoring');
  //       return;
  //     }

  //     const videoTracks = streamRef.current.getVideoTracks();
  //     if (videoTracks.length === 0) {
  //       console.error('❌ No video tracks during streaming!');
  //       toast({
  //         title: "Camera disconnected",
  //         description: "Video track was lost. Please check your camera.",
  //         variant: "destructive"
  //       });
  //       return;
  //     }

  //     const videoTrack = videoTracks[0];

  //     // Check if track became disabled or ended
  //     if (!videoTrack.enabled || videoTrack.readyState !== 'live') {
  //       console.error('❌ Video track issue:', {
  //         enabled: videoTrack.enabled,
  //         readyState: videoTrack.readyState
  //       });

  //       // Try to re-enable if just disabled
  //       if (videoTrack.readyState === 'live' && !videoTrack.enabled) {
  //         console.log('🔧 Attempting to re-enable video track...');
  //         videoTrack.enabled = true;
  //       }
  //     }

  //     // Log track state periodically
  //     console.log('📊 Stream monitor:', {
  //       enabled: videoTrack.enabled,
  //       readyState: videoTrack.readyState,
  //       streamId: streamRef.current.id
  //     });
  //   }, 5000); // Check every 5 seconds

  //   return () => clearInterval(monitorInterval);
  // }, [isStreaming, toast]);

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
  const {
    viewers: activeViewers,
    isLoading: viewersLoading
  } = useStreamViewers(activeStreamId || '');

  // Sync viewer count to DB
  useEffect(() => {
    if (isStreaming && activeStreamId) {
      const updateViewerCount = async () => {
        await supabase.from('streaming_sessions').update({
          current_viewers: activeViewers.length
        }).eq('id', activeStreamId);
      };
      updateViewerCount();
    }
  }, [activeViewers.length, isStreaming, activeStreamId]);

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
    const channel = supabase.channel(`host_chat_${activeStreamId}`).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'stream_chat_messages',
      filter: `stream_id=eq.${activeStreamId}`
    }, payload => {
      const newMsg = payload.new as any;
      setFloatingChatMessages(prev => [...prev.slice(-4), newMsg]);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setFloatingChatMessages(prev => prev.filter(m => m.id !== newMsg.id));
      }, 5000);
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStreamId, isStreaming]);

  // Keep activeStreamIdRef in sync with state
  useEffect(() => {
    activeStreamIdRef.current = activeStreamId;
  }, [activeStreamId]);

  // Heartbeat to keep stream marked as active (using ref to avoid stale closures)
  useEffect(() => {
    if (!isStreaming || !activeStreamId) return;
    console.log('💓 Starting stream activity heartbeat for:', activeStreamId);
    const updateActivity = async () => {
      const currentStreamId = activeStreamIdRef.current;
      if (!currentStreamId) {
        console.warn('⚠️ No active stream ID for heartbeat');
        return;
      }
      try {
        console.log('💓 Sending heartbeat for stream:', currentStreamId);
        const {
          error,
          data
        } = await supabase.from('streaming_sessions').update({
          last_activity_at: new Date().toISOString()
        }).eq('id', currentStreamId).select('last_activity_at').single();
        if (error) {
          console.error('❌ Error updating stream activity:', error);
        } else {
          console.log('💓 Stream activity heartbeat sent successfully:', data?.last_activity_at);
          setLastHeartbeat(new Date());
        }
      } catch (err) {
        console.error('❌ Heartbeat error:', err);
      }
    };

    // Send heartbeat immediately
    updateActivity();

    // Then send every 30 seconds (more frequent than inactivity check)
    const heartbeatInterval = setInterval(updateActivity, 30000);
    return () => {
      console.log('💔 Stopping stream activity heartbeat');
      clearInterval(heartbeatInterval);
    };
  }, [isStreaming, activeStreamId]);

  // Monitor stream inactivity and auto-end after 15 minutes (delayed start)
  useEffect(() => {
    if (!isStreaming || !activeStreamId) return;
    console.log('⏱️ Inactivity monitor will start in 2 minutes for stream:', activeStreamId);
    let hasWarnedUser = false;
    let inactivityCheckInterval: NodeJS.Timeout | null = null;

    // Delay the first inactivity check by 2 minutes to let heartbeat establish
    const startDelay = setTimeout(() => {
      console.log('⏱️ Starting inactivity monitor now');
      inactivityCheckInterval = setInterval(async () => {
        const currentStreamId = activeStreamIdRef.current;
        if (!currentStreamId) return;
        try {
          const {
            data: streamData,
            error
          } = await supabase.from('streaming_sessions').select('last_activity_at, status').eq('id', currentStreamId).single();
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
            threshold: 900
          });

          // Warn at 12 minutes (720 seconds)
          if (inactiveSeconds >= 720 && inactiveSeconds < 900 && !hasWarnedUser) {
            hasWarnedUser = true;
            toast({
              title: "Stream may end soon",
              description: "Your stream will auto-end in 3 minutes due to inactivity.",
              variant: "default"
            });
          }

          // Auto-end if inactive for 15+ minutes (900 seconds)
          if (inactiveSeconds >= 900) {
            console.log('🔴 Stream inactive for 15+ minutes, auto-ending stream');
            if (inactivityCheckInterval) clearInterval(inactivityCheckInterval);
            toast({
              title: "Stream ended due to inactivity",
              description: "Your stream was automatically ended after 15 minutes of no activity.",
              variant: "destructive"
            });
            await endStream();
          } else {
            const remainingMinutes = Math.ceil((900 - inactiveSeconds) / 60);
            console.log(`✅ Stream active, ${remainingMinutes} minutes until auto-end`);
          }
        } catch (err) {
          console.error('❌ Error in inactivity check:', err);
        }
      }, 60000); // Check every 60 seconds (heartbeat is every 30s)
    }, 120000); // 2 minute delay before starting checks

    return () => {
      console.log('🛑 Stopping inactivity monitor');
      clearTimeout(startDelay);
      if (inactivityCheckInterval) clearInterval(inactivityCheckInterval);
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

  // Re-attach srcObject continuously during streaming to ensure video stays visible
  useEffect(() => {
    if (!isStreaming || !isCameraOn) return;
    const ensureVideoConnection = () => {
      if (videoRef.current && streamRef.current) {
        const hasValidSrcObject = videoRef.current.srcObject === streamRef.current;
        const hasActiveTracks = streamRef.current.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
        console.log('📹 Video connection check:', {
          hasVideoRef: !!videoRef.current,
          hasStreamRef: !!streamRef.current,
          hasValidSrcObject,
          hasActiveTracks,
          isCameraOn,
          isStreaming
        });
        if (!hasValidSrcObject && hasActiveTracks) {
          console.log('🔄 Re-attaching srcObject during streaming');
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(err => console.error('Error re-playing video:', err));
        }
      }
    };

    // Check immediately
    ensureVideoConnection();

    // Check periodically while streaming
    const interval = setInterval(ensureVideoConnection, 2000);
    return () => clearInterval(interval);
  }, [isStreaming, isCameraOn]);

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

    // Phase 4: Less aggressive cleanup - only cleanup very old streams (24+ hours)
    // This prevents accidentally archiving active streams
    const cleanupStaleStreams = async () => {
      try {
        // Call the database function for standard cleanup
        await supabase.rpc('cleanup_stale_live_streams');
        console.log('✅ Stale streams cleanup completed via RPC');

        // Only archive streams that are VERY old (24+ hours) to avoid killing active streams
        // Reduced from 6 hours to 24 hours to be much safer
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const {
          error: immediateCleanupError
        } = await supabase.from('streaming_sessions').update({
          status: 'archived',
          ended_at: new Date().toISOString(),
          current_viewers: 0
        }).eq('status', 'live').lt('started_at', twentyFourHoursAgo); // Only streams older than 24 hours

        if (immediateCleanupError) {
          console.warn('Failed immediate cleanup:', immediateCleanupError);
        } else {
          console.log('✅ Old streams (24h+) cleanup completed');
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
  const cleanupStream = async () => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear video src
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Cleanup SFU
    cleanup();
  };

  // Improved cleanup on unmount
  // useEffect(() => {
  //   return () => {
  //     if (isCleaningUpRef.current) return;
  //     isCleaningUpRef.current = true;
  //     console.log('Component unmounting, cleaning up...');

  //     // 1. Stop media tracks first
  //     if (streamRef.current) {
  //       streamRef.current.getTracks().forEach(track => {
  //         track.stop();
  //         console.log(`Stopped ${track.kind} track`);
  //       });
  //     }

  //     // Phase 5: Reset permission states
  //     setHasCameraPermission(false);
  //     setHasMicPermission(false);
  //     setIsCameraOn(false);
  //     setIsMicOn(false);

  //     // 2. Cleanup SFU
  //     // cleanup();

  //     // 3. Clear intervals

  //     // 4. Update database if streaming (use ref for current value) - Archive immediately
  //     if (activeStreamIdRef.current) {
  //       console.log('Archiving stream on unmount');
  //       supabase.from('streaming_sessions').update({
  //         status: 'archived',
  //         ended_at: new Date().toISOString(),
  //         current_viewers: 0
  //       }).eq('id', activeStreamIdRef.current).then(() => console.log('Stream archived on unmount'));
  //     }
  //   };
  // }, []);

  // Browser close/refresh handler - end stream before page unloads
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeStreamId && isStreaming) {
        console.log('🚪 Browser closing/refreshing - ending stream synchronously');

        // Synchronously update the database before page closes
        const xhr = new XMLHttpRequest();
        xhr.open('PATCH', `https://kdvnxzniqyomdeicmycs.supabase.co/rest/v1/streaming_sessions?id=eq.${activeStreamId}`, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkdm54em5pcXlvbWRlaWNteWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjA4NjAsImV4cCI6MjA3MDY5Njg2MH0.OpjCOM_0uI5MujiR191FXwGx_INpWPGPXY6Z6oJEb5E');
        xhr.setRequestHeader('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkdm54em5pcXlvbWRlaWNteWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjA4NjAsImV4cCI6MjA3MDY5Njg2MH0.OpjCOM_0uI5MujiR191FXwGx_INpWPGPXY6Z6oJEb5E');
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
    if (!isStreaming) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📱 Tab hidden - connection may throttle');
      } else {
        console.log('📱 Tab visible - checking connection health');

        // Check connection health when tab becomes visible
        const health = checkChannelHealth();
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
  }, [isStreaming, checkChannelHealth]);

  // Monitor connection health periodically while streaming
  useEffect(() => {
    if (!isStreaming) return;
    const healthCheckInterval = setInterval(() => {
      const health = checkChannelHealth();
      setConnectionHealth(health || null);
      if (health && !health.isHealthy) {
        console.warn('⚠️ Connection health check failed:', health.details);
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(healthCheckInterval);
  }, [isStreaming, checkChannelHealth]);
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

  // Flip camera between front and back (for mobile)
  const flipCamera = async () => {
    if (!streamRef.current) return;
    const newFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';

    // Stop current video track
    streamRef.current.getVideoTracks().forEach(track => track.stop());
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: {
            ideal: 1080
          },
          height: {
            ideal: 1920
          },
          facingMode: newFacingMode,
          aspectRatio: {
            ideal: 9 / 16
          }
        },
        audio: false
      });

      // Replace video track in existing stream
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = streamRef.current.getVideoTracks()[0];
      if (oldVideoTrack) {
        streamRef.current.removeTrack(oldVideoTrack);
      }
      streamRef.current.addTrack(newVideoTrack);
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      setCameraFacingMode(newFacingMode);
      toast({
        title: 'Camera flipped',
        description: `Now using ${newFacingMode === 'user' ? 'front' : 'back'} camera`
      });
    } catch (err) {
      console.error('Failed to flip camera:', err);
      toast({
        title: 'Camera Error',
        description: 'Could not switch camera. Your device may only have one camera.',
        variant: 'destructive'
      });
    }
  };
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

      // Initialize SFU stream
      console.log('🔧 Initializing SFU stream...');
      await initialize('streamer', {}, data.id, streamRef.current);
      console.log('✅ SFU stream initialized');
      setChannelStatus('connected');

      // Update stream to live immediately with activity timestamp
      const {
        error: updateError
      } = await supabase.from('streaming_sessions').update({
        status: 'live',
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      }).eq('id', data.id);
      if (updateError) {
        console.error('Error updating stream to live:', updateError);
      } else {
        console.log('✅ Stream is now live and ready for viewers');
        setStreamLifecycle('live');
        setIsBroadcastReady(true);
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
    // Re-initialize SFU
    if (activeStreamId && streamRef.current) {
      cleanup();
      await initialize('streamer', {}, activeStreamId, streamRef.current);
      toast({
        title: "Reconnected",
        description: "Stream connection reset."
      });
    }
  };
  const endStream = async () => {
    if (!activeStreamId) return;
    setStreamLifecycle('ending');
    setIsLoading(true);
    try {
      // Cleanup SFU
      cleanup();
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
      setActiveStreamId(null);
      setTotalLikes(0);
      setTotalGifts(0);
      setStreamLifecycle('ended');
      setChannelStatus('disconnected');

      // Phase 6: Enhanced visual feedback
      toast({
        title: "🎬 Stream ended and archived",
        description: `Thanks for streaming! ${activeViewers.length} viewers watched. Stream archived.`
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
                <Button variant="outline" size="sm" onClick={() => {
                if (liveStreams.length > 0) {
                  joinStream(liveStreams[0], true);
                } else {
                  toast({
                    title: "No live streams",
                    description: "There are no live streams available right now"
                  });
                }
              }} className="gap-2">
                  <Play className="w-4 h-4" />
                  Òloo Mode
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
                        {stream.thumbnail ? <img src={stream.thumbnail} alt={stream.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-12 h-12 text-muted-foreground" />
                          </div>}
                        
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
                        {stream.category && <Badge variant="outline" className="text-xs">
                            {stream.category}
                          </Badge>}
                        
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
                        <SelectItem value="art">Art & Creativity</SelectItem>
                        <SelectItem value="beauty">Beauty & Fashion</SelectItem>
                        <SelectItem value="business">Business & Finance</SelectItem>
                        <SelectItem value="comedy">Comedy & Entertainment</SelectItem>
                        <SelectItem value="culture">Culture</SelectItem>
                        <SelectItem value="dating">Dating & Relationships</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="fitness">Fitness & Health</SelectItem>
                        <SelectItem value="food">Food & Cooking</SelectItem>
                        <SelectItem value="gaming">Gaming</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="history">History</SelectItem>
                        <SelectItem value="lifestyle">Lifestyle</SelectItem>
                        <SelectItem value="music">Music</SelectItem>
                        <SelectItem value="politics">Politics</SelectItem>
                        <SelectItem value="religion">Religion</SelectItem>
                        <SelectItem value="sports">Sports</SelectItem>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="tvshow">TV Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                   {isStreaming && <div className="hidden p-4 bg-muted rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Broadcasting Status:</span>
                        <Badge className="bg-green-500 text-white">
                          <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                          Live
                        </Badge>
                      </div>
                      
                      {/* Connection Status Indicator */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connection:</span>
                        {channelStatus === 'connected' && !isReconnecting ? <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Connected
                          </Badge> : channelStatus === 'connecting' || isReconnecting ? <Badge variant="outline" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-700">
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            {isReconnecting ? 'Reconnecting...' : 'Connecting...'}
                          </Badge> : channelStatus === 'error' ? <Badge variant="outline" className="bg-red-500/10 border-red-500/30 text-red-700">
                            <XCircle className="w-3 h-3 mr-1" />
                            Connection Error
                          </Badge> : <Badge variant="outline" className="bg-gray-500/10 border-gray-500/30">
                            <Activity className="w-3 h-3 mr-1" />
                            Disconnected
                          </Badge>}
                      </div>
                      
                      {connectionHealth && !connectionHealth.isHealthy && <div className="text-xs text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Connection quality degraded - auto-reconnecting
                        </div>}
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connected Viewers:</span>
                        <Badge variant="secondary">{activeViewers.length} watching</Badge>
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
                      
                      {/* Heartbeat Debug Indicator */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Heartbeat:</span>
                        <Badge variant="outline" className={`gap-1 ${lastHeartbeat ? 'bg-green-500/10 border-green-500/30 text-green-700' : 'bg-gray-500/10'}`}>
                          <Activity className="w-3 h-3" />
                          {lastHeartbeat ? lastHeartbeat.toLocaleTimeString() : 'Pending...'}
                        </Badge>
                      </div>
                      
                    </div>}
                </CardContent>
              </Card>

              {/* Video Preview */}
              <Card className="cultural-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Preview</span>
                    {isStreaming && <Badge variant="secondary" className="text-xs">
                        🔴 Broadcasting to {activeViewers.length} viewers
                      </Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center space-y-4">
                    {/* Compact Camera Preview */}
                    <div className={`relative bg-black overflow-hidden border border-border shadow-lg ${isHostFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'rounded-lg aspect-[9/16] w-full max-w-[280px] max-h-[400px]'}`}>
                      {/* Video element always in DOM - hidden when camera off */}
                      <video ref={videoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover bg-black ${!isCameraOn ? 'hidden' : ''}`} style={{
                      filter: activeFilter !== 'none' ? filters.find(f => f.id === activeFilter)?.style : undefined
                    }} />
                      {/* Stream active indicator */}
                      {isCameraOn && isStreaming && <div className="absolute bottom-2 left-2 z-10 text-xs text-white/70 bg-black/50 px-2 py-1 rounded">
                          Stream Active
                        </div>}
                      {/* Keep video visible with placeholder when camera off */}
                      {!isCameraOn && <div className="absolute inset-0 bg-black flex items-center justify-center">
                          <VideoOff className="w-12 h-12 text-muted-foreground" />
                        </div>}
                      
                      {/* Fullscreen Toggle Button - Mobile Only */}
                      <Button variant="ghost" size="icon" className="absolute top-2 right-2 z-40 bg-black/50 hover:bg-black/70 text-white md:hidden" onClick={() => setIsHostFullscreen(!isHostFullscreen)}>
                        {isHostFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                      </Button>
                      
                      {isStreaming && <Badge className="absolute top-2 left-2 bg-red-500 text-white z-30">
                          <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse" />
                          LIVE
                        </Badge>}

                      {/* Viewer Camera Thumbnails Overlay */}
                      {isStreaming && (activeViewers.length > 0 || viewerCameras.size > 0) && <div className="absolute top-10 left-2 right-12 z-20 overflow-x-auto">
                          <div className="flex gap-1.5 pb-1">
                            {/* Viewers with active cameras */}
                            {Array.from(viewerCameras.values()).map(camera => <div key={camera.sessionToken} className="relative w-12 h-16 rounded-lg overflow-hidden border-2 border-primary/50 shadow-lg flex-shrink-0 bg-black">
                                <video autoPlay playsInline muted className="w-full h-full object-cover" ref={el => {
                            if (el && camera.stream) el.srcObject = camera.stream;
                          }} />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-0.5">
                                  <span className="text-[8px] text-white truncate block text-center">
                                    {camera.displayName?.slice(0, 6) || 'Viewer'}
                                  </span>
                                </div>
                                <div className="absolute top-0.5 right-0.5">
                                  <Video className="w-2.5 h-2.5 text-green-400" />
                                </div>
                              </div>)}
                            {/* Viewers without cameras - show avatar */}
                            {activeViewers.filter(v => !Array.from(viewerCameras.keys()).includes(v.session_id)).map(viewer => <div key={viewer.session_id} className="relative w-12 h-16 rounded-lg overflow-hidden border border-border/50 bg-black/60 flex flex-col items-center justify-center flex-shrink-0">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={viewer.avatar_url} />
                                    <AvatarFallback className="text-[10px] bg-muted">
                                      {viewer.viewer_display_name?.[0]?.toUpperCase() || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-[8px] text-white/80 mt-0.5 truncate max-w-[40px] text-center">
                                    {viewer.viewer_display_name?.slice(0, 6) || 'Guest'}
                                  </span>
                                  {viewer.is_guest && <span className="absolute top-0.5 left-0.5 text-[6px] bg-muted/80 px-0.5 rounded text-muted-foreground">
                                      G
                                    </span>}
                                </div>)}
                          </div>
                        </div>}

                      {/* Like Animation Overlay */}
                      {isStreaming && <LikeAnimation key={likeAnimationTrigger} show={showLikeAnimation} onComplete={() => setShowLikeAnimation(false)} />}

                      {/* Floating Chat Messages Overlay */}
                      {isStreaming && <div className="absolute bottom-4 left-4 right-16 space-y-2 z-20 pointer-events-none">
                          {floatingChatMessages.map(msg => <div key={msg.id} className="bg-black/60 backdrop-blur-sm rounded-2xl px-3 py-2 animate-slide-in-right max-w-xs">
                              <span className="text-white font-semibold text-sm">{msg.username}: </span>
                              <span className="text-white text-sm">{msg.message}</span>
                            </div>)}
                        </div>}

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

                    {/* Camera Status Indicator */}
                    {!isCameraOn && <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-sm">Camera Off</span>
                      </div>}

                    {/* TikTok-style Control Row: Flip, Filter, Camera, Mic, Settings */}
                    <div className="flex items-center justify-center gap-4">
                      {/* Flip Camera */}
                      <div className="flex flex-col items-center gap-1">
                        <Button onClick={flipCamera} variant="ghost" size="icon" disabled={!isCameraOn} title="Flip Camera" className="h-10 w-10">
                          <FlipHorizontal className="w-5 h-5" />
                        </Button>
                        <span className="text-xs text-muted-foreground">Flip</span>
                      </div>
                      
                      {/* Filter Picker */}
                      <div className="flex flex-col items-center gap-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!isCameraOn} title="Filters" className={`h-10 w-10 ${activeFilter !== 'none' ? 'text-primary' : ''}`}>
                              <Wand2 className="w-5 h-5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="center">
                            <p className="text-sm font-medium mb-2 text-center">Choose Filter</p>
                            <div className="grid grid-cols-4 gap-2">
                              {filters.map(filter => <button key={filter.id} onClick={() => setActiveFilter(filter.id)} className={`p-2 rounded-lg text-xs transition-all ${activeFilter === filter.id ? 'bg-primary text-primary-foreground ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'}`}>
                                  {filter.name}
                                </button>)}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <span className="text-xs text-muted-foreground">Filter</span>
                      </div>
                      
                      {/* Camera Toggle */}
                      <div className="flex flex-col items-center gap-1">
                        <Button onClick={() => {
                        if (!hasCameraPermission) {
                          initializeMedia(true, false);
                        } else {
                          toggleCamera();
                        }
                      }} disabled={isRequestingCamera} variant="outline" size="icon" className="h-10 w-10">
                          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                        </Button>
                        <span className="text-xs text-muted-foreground">Cam</span>
                      </div>
                      
                      {/* Mic Toggle */}
                      <div className="flex flex-col items-center gap-1">
                        <Button onClick={() => {
                        if (!hasMicPermission) {
                          initializeMedia(false, true);
                        } else {
                          toggleMicrophone();
                        }
                      }} disabled={isRequestingMic} variant="outline" size="icon" className="h-10 w-10">
                          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                        </Button>
                        <span className="text-xs text-muted-foreground">Mic</span>
                      </div>
                      
                      {/* Settings */}
                      <div className="flex flex-col items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setShowTroubleshooting(true)} className="h-10 w-10">
                          <Settings className="w-5 h-5" />
                        </Button>
                        <span className="text-xs text-muted-foreground">Settings</span>
                      </div>
                    </div>
                    
                    {/* Helper Text */}
                    
                    
                    {/* Start Streaming Button - Prominent */}
                    <div className="w-full max-w-[280px]">
                      {!isStreaming ? <Button onClick={startStream} disabled={!streamTitle.trim() || !streamCategory || isLoading} className="w-full bg-red-500 hover:bg-red-600 text-white" size="lg">
                          <Radio className="w-5 h-5 mr-2" />
                          {isLoading ? 'Starting...' : 'Start Streaming'}
                        </Button> : <Button onClick={endStream} variant="destructive" className="w-full" size="lg">
                          {isLoading ? 'Ending...' : 'End Stream'}
                        </Button>}
                      {!hasCameraPermission && <p className="text-xs text-muted-foreground text-center mt-2">
                          Enable camera to start broadcasting
                        </p>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Live Chat & Viewers (only when streaming) */}
              {isStreaming && activeStreamId && <div className="space-y-4 lg:row-span-2">
                  {/* All Viewers Card */}
                  <ViewerCameraThumbnails viewerCameras={viewerCameras} allViewers={activeViewers} className="max-h-[400px]" />
                  
                  {/* Active Viewers Card */}
                  <Card className="cultural-card">
                    
                    
                  </Card>

                  {/* Live Chat Card */}
                  <Card className="cultural-card flex flex-col h-[500px]">
                    
                    <CardContent className="flex-1 p-0 overflow-hidden">
                      {showStreamerChat && <LiveStreamChat streamId={activeStreamId} isMobile={false} />}
                    </CardContent>
                  </Card>
                </div>}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Conditional viewer rendering based on mode */}
      {viewingStreamId && viewingStreamData && (isTikTokMode ? <TikTokStreamViewer streamId={viewingStreamId} streamTitle={viewingStreamData.title} hostName={viewingStreamData.host_name || 'Anonymous'} hostUserId={viewingStreamData.host_user_id} currentViewers={viewingStreamData.current_viewers} totalLikes={viewingStreamData.total_likes || 0} onClose={closeStreamViewer} onNext={hasNext ? handleTikTokNext : undefined} onPrevious={hasPrevious ? handleTikTokPrevious : undefined} hasNext={hasNext} hasPrevious={hasPrevious} /> : <StreamViewer streamId={viewingStreamId} streamTitle={viewingStreamData.title} hostName={viewingStreamData.host_name || 'Anonymous'} hostUserId={viewingStreamData.host_user_id} onClose={closeStreamViewer} />)}

      <CoinShop open={showCoinShop} onOpenChange={setShowCoinShop} />

      <CameraTroubleshootingWizard open={showTroubleshooting} onOpenChange={setShowTroubleshooting} />
    </div>;
};
export default StreamingInterface;