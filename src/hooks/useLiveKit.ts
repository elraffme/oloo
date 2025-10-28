import { useState, useCallback, useEffect, useRef } from 'react';
import { Room, RoomEvent, Track, LocalVideoTrack, LocalAudioTrack, RemoteTrack, RemoteParticipant, VideoPresets } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseLiveKitOptions {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onParticipantConnected?: (count: number) => void;
  onError?: (error: Error) => void;
  onConnectionQualityChanged?: (quality: 'excellent' | 'good' | 'fair' | 'poor') => void;
}

export const useLiveKit = (options: UseLiveKitOptions = {}) => {
  const { toast } = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const roomRef = useRef<Room | null>(null);

  // Get LiveKit token from edge function with retry logic
  const getToken = async (
    roomName: string, 
    participantName: string, 
    canPublish: boolean = false,
    attempt: number = 1
  ): Promise<{ token: string; url: string } | null> => {
    try {
      console.log(`🔑 Requesting LiveKit token (attempt ${attempt})...`);
      
      // Get fresh session to ensure auth header is included
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session. Please sign in to join the stream.');
      }

      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName,
          participantName,
          participantIdentity: `${Date.now()}-${participantName}`,
          canPublish,
          canSubscribe: true,
        },
      });

      if (error) {
        console.error('❌ Error getting LiveKit token:', error);
        
        // Retry logic with exponential backoff
        if (attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return getToken(roomName, participantName, canPublish, attempt + 1);
        }
        
        toast({
          title: "Connection Error",
          description: error.message || "Failed to get streaming token. Please check your LiveKit credentials.",
          variant: "destructive",
        });
        return null;
      }

      if (!data?.token || !data?.url) {
        throw new Error('Invalid response from token service');
      }

      console.log('✅ LiveKit token received');
      return { token: data.token, url: data.url };
    } catch (error: any) {
      console.error('❌ Exception getting LiveKit token:', error);
      
      // Retry on network errors
      if (attempt < 3 && (error.message?.includes('fetch') || error.message?.includes('network'))) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Network error, retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return getToken(roomName, participantName, canPublish, attempt + 1);
      }
      
      toast({
        title: "Connection Error",
        description: "Failed to connect to streaming service. Please check your internet connection.",
        variant: "destructive",
      });
      return null;
    }
  };

  // Connect to LiveKit room with enhanced error handling
  const connect = useCallback(async (
    roomName: string,
    participantName: string,
    canPublish: boolean = false
  ) => {
    try {
      console.log('🔌 Connecting to LiveKit room:', roomName);
      setConnectionState('connecting');
      setRetryCount(0);
      
      const tokenData = await getToken(roomName, participantName, canPublish);
      if (!tokenData) {
        setConnectionState('error');
        return false;
      }

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
          frameRate: 30
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        publishDefaults: {
          simulcast: true,
          videoEncoding: {
            maxBitrate: 1_500_000,
            maxFramerate: 30
          }
        }
      });

      roomRef.current = newRoom;

      // Set up event listeners
      newRoom.on(RoomEvent.Connected, () => {
        console.log('✅ Connected to LiveKit room');
        setIsConnected(true);
        setConnectionState('connected');
        setParticipantCount(newRoom.numParticipants);
        setRetryCount(0);
        options.onConnected?.();
        
        toast({
          title: "Connected",
          description: "Successfully connected to the stream",
        });
      });

      newRoom.on(RoomEvent.Disconnected, (reason) => {
        console.log('❌ Disconnected from room:', reason);
        setIsConnected(false);
        setConnectionState('disconnected');
        options.onDisconnected?.();
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('👤 Participant connected:', participant.identity);
        setParticipantCount(newRoom.numParticipants);
        options.onParticipantConnected?.(newRoom.numParticipants);
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('👋 Participant disconnected:', participant.identity);
        setParticipantCount(newRoom.numParticipants);
        options.onParticipantConnected?.(newRoom.numParticipants);
      });

      newRoom.on(RoomEvent.Reconnecting, () => {
        console.log('🔄 Reconnecting to room...');
        setConnectionState('connecting');
        const currentRetry = retryCount + 1;
        setRetryCount(currentRetry);
        
        toast({
          title: "Reconnecting",
          description: `Attempting to reconnect (${currentRetry}/3)...`,
        });
      });

      newRoom.on(RoomEvent.Reconnected, () => {
        console.log('✅ Reconnected to room');
        setConnectionState('connected');
        setRetryCount(0);
        
        toast({
          title: "Reconnected",
          description: "Successfully reconnected to the stream",
        });
      });

      newRoom.on(RoomEvent.MediaDevicesError, (error) => {
        console.error('❌ Media devices error:', error);
        options.onError?.(error);
        
        toast({
          title: "Media Error",
          description: "Error accessing camera or microphone. Please check your permissions.",
          variant: "destructive",
        });
      });

      // Monitor connection quality
      room.on(RoomEvent.ConnectionQualityChanged, (quality: any) => {
        console.log('Connection quality changed:', quality);
        const qualityMap: Record<string, 'excellent' | 'good' | 'fair' | 'poor'> = {
          excellent: 'excellent',
          good: 'good',
          poor: 'fair',
          lost: 'poor'
        };
        options.onConnectionQualityChanged?.(qualityMap[quality] || 'good');
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        console.log('📺 Track subscribed:', track.kind, 'from', participant.identity);
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        console.log('📴 Track unsubscribed:', track.kind, 'from', participant.identity);
      });

      // Phase 3: Enhanced logging for track publication
      newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
        console.log('📤 Track published:', publication.kind, 'from', participant.identity);
        console.log('Publication details:', {
          trackSid: publication.trackSid,
          source: publication.source,
          mimeType: publication.mimeType
        });
      });

      newRoom.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        console.log('📤❌ Track unpublished:', publication.kind, 'from', participant.identity);
      });

      console.log('🚀 Attempting to connect to:', tokenData.url);
      await newRoom.connect(tokenData.url, tokenData.token, { autoSubscribe: true });
      setRoom(newRoom);
      
      return true;
    } catch (error: any) {
      console.error('❌ Error connecting to room:', error);
      setConnectionState('error');
      options.onError?.(error as Error);
      
      const errorMessage = error.message || 'Unknown error occurred';
      let userMessage = "Failed to connect to the stream";
      
      if (errorMessage.includes('token')) {
        userMessage = "Authentication failed. Please try again.";
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userMessage = "Network error. Please check your internet connection.";
      } else if (errorMessage.includes('timeout')) {
        userMessage = "Connection timed out. Please try again.";
      }
      
      toast({
        title: "Connection Failed",
        description: userMessage,
        variant: "destructive",
      });
      
      return false;
    }
  }, [options, toast, retryCount]);

  // Publish local tracks (for streamers) - Phase 4: Enhanced verification
  const publishTracks = useCallback(async (mediaStream: MediaStream) => {
    if (!roomRef.current || !mediaStream) {
      throw new Error('Room not connected or no media stream available');
    }

    try {
      console.log('📤 Publishing local tracks...');
      console.log('Available tracks:', {
        video: mediaStream.getVideoTracks().length,
        audio: mediaStream.getAudioTracks().length
      });
      setIsPublishing(true);

      const videoTrack = mediaStream.getVideoTracks()[0];
      const audioTrack = mediaStream.getAudioTracks()[0];

      if (videoTrack) {
        console.log('Video track settings:', videoTrack.getSettings());
        const lvt = new LocalVideoTrack(videoTrack);
        const publication = await roomRef.current.localParticipant.publishTrack(lvt);
        console.log('✅ Video track published with SID:', publication.trackSid);
      } else {
        console.warn('⚠️ No video track available to publish');
      }

      if (audioTrack) {
        console.log('Audio track settings:', audioTrack.getSettings());
        const lat = new LocalAudioTrack(audioTrack);
        const publication = await roomRef.current.localParticipant.publishTrack(lat);
        console.log('✅ Audio track published with SID:', publication.trackSid);
      } else {
        console.warn('⚠️ No audio track available to publish');
      }

      // Wait a moment and verify publications
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const publications = Array.from(roomRef.current.localParticipant.trackPublications.values());
      console.log('📊 Total publications:', publications.length);
      publications.forEach(pub => {
        console.log(`  - ${pub.kind}: ${pub.trackSid} (${pub.mimeType})`);
      });

      console.log('✅ All tracks published successfully');
      toast({
        title: "🎥 Live!",
        description: "Your stream is now broadcasting to viewers",
      });
    } catch (error: any) {
      console.error('❌ Failed to publish tracks:', error);
      setIsPublishing(false);
      throw error;
    }
  }, [toast]);

  // Disconnect from room
  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      console.log('🔌 Disconnecting from LiveKit room...');
      await roomRef.current.disconnect();
      roomRef.current = null;
      setRoom(null);
      setIsConnected(false);
      setIsPublishing(false);
      setParticipantCount(0);
      setConnectionState('idle');
      setRetryCount(0);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  return {
    room,
    isConnected,
    isPublishing,
    participantCount,
    connectionState,
    connect,
    publishTracks,
    disconnect,
  };
};
