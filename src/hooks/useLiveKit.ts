import { useState, useCallback, useEffect, useRef } from 'react';
import { Room, RoomEvent, Track, LocalVideoTrack, LocalAudioTrack, RemoteTrack, RemoteParticipant } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseLiveKitOptions {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onParticipantConnected?: (count: number) => void;
  onError?: (error: Error) => void;
}

export const useLiveKit = (options: UseLiveKitOptions = {}) => {
  const { toast } = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const roomRef = useRef<Room | null>(null);

  // Get LiveKit token from edge function
  const getToken = async (roomName: string, participantName: string, canPublish: boolean = false) => {
    try {
      // Get fresh session to ensure auth header is included
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session. Please sign in to join the stream.');
      }

      console.log('Requesting LiveKit token with auth...');
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
        console.error('Error getting LiveKit token:', error);
        throw error;
      }

      if (!data?.token || !data?.url) {
        throw new Error('Invalid response from token service');
      }

      console.log('✓ LiveKit token received');
      return data;
    } catch (error) {
      console.error('Failed to get LiveKit token:', error);
      throw error;
    }
  };

  // Connect to LiveKit room
  const connect = useCallback(async (
    roomName: string,
    participantName: string,
    canPublish: boolean = false
  ) => {
    try {
      console.log('Connecting to LiveKit room:', roomName);

      // Get token from backend
      const { token, url } = await getToken(roomName, participantName, canPublish);

      // Create and connect room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: {
            width: 1280,
            height: 720,
            frameRate: 30,
          },
        },
      });

      roomRef.current = newRoom;

      // Setup event handlers
      newRoom.on(RoomEvent.Connected, () => {
        console.log('✓ Connected to LiveKit room');
        setIsConnected(true);
        setParticipantCount(newRoom.numParticipants);
        options.onConnected?.();
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from LiveKit room');
        setIsConnected(false);
        setParticipantCount(0);
        options.onDisconnected?.();
      });

      newRoom.on(RoomEvent.ParticipantConnected, () => {
        const count = newRoom.numParticipants;
        console.log('Participant connected. Total:', count);
        setParticipantCount(count);
        options.onParticipantConnected?.(count);
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, () => {
        const count = newRoom.numParticipants;
        console.log('Participant disconnected. Total:', count);
        setParticipantCount(count);
        options.onParticipantConnected?.(count);
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        console.log('Track subscribed:', track.kind, 'from', participant.identity);
      });

      // Connect to room
      await newRoom.connect(url, token);
      setRoom(newRoom);

      return newRoom;
    } catch (error: any) {
      console.error('Failed to connect to LiveKit:', error);
      options.onError?.(error);
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect to streaming server",
        variant: "destructive",
      });
      throw error;
    }
  }, [options, toast]);

  // Publish local tracks (for streamers)
  const publishTracks = useCallback(async (mediaStream: MediaStream) => {
    if (!roomRef.current || !mediaStream) {
      throw new Error('Room not connected or no media stream available');
    }

    try {
      console.log('Publishing local tracks...');
      setIsPublishing(true);

      const videoTrack = mediaStream.getVideoTracks()[0];
      const audioTrack = mediaStream.getAudioTracks()[0];

      if (videoTrack) {
        const lvt = new LocalVideoTrack(videoTrack);
        await roomRef.current.localParticipant.publishTrack(lvt);
        console.log('✓ Video track published');
      }

      if (audioTrack) {
        const lat = new LocalAudioTrack(audioTrack);
        await roomRef.current.localParticipant.publishTrack(lat);
        console.log('✓ Audio track published');
      }

      console.log('✓ All tracks published successfully');
      toast({
        title: "🎥 Live!",
        description: "Your stream is now broadcasting",
      });
    } catch (error: any) {
      console.error('Failed to publish tracks:', error);
      setIsPublishing(false);
      throw error;
    }
  }, [toast]);

  // Disconnect from room
  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      console.log('Disconnecting from LiveKit room...');
      await roomRef.current.disconnect();
      roomRef.current = null;
      setRoom(null);
      setIsConnected(false);
      setIsPublishing(false);
      setParticipantCount(0);
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
    connect,
    publishTracks,
    disconnect,
  };
};
