import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Phone,
  Camera,
  CameraOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface VideoCallProps {
  callId: string;
  isInitiator: boolean;
  onCallEnd: () => void;
  participantName: string;
  participantId?: string;
  callType?: 'video' | 'audio';
}

interface ICECandidate {
  candidate: string;
  sdpMLineIndex: number;
  sdpMid: string;
}

const VideoCall: React.FC<VideoCallProps> = ({ 
  callId, 
  isInitiator, 
  onCallEnd, 
  participantName,
  participantId,
  callType = 'video'
}) => {
  const { toast } = useToast();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize WebRTC
  useEffect(() => {
    initializeCall();
    
    // Subscribe to signaling messages
    const channel = supabase
      .channel(`video_call_${callId}`)
      .on('broadcast', { event: 'offer' }, ({ payload }) => handleOffer(payload))
      .on('broadcast', { event: 'answer' }, ({ payload }) => handleAnswer(payload))
      .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => handleICECandidate(payload))
      .on('broadcast', { event: 'call-end' }, () => handleRemoteCallEnd())
      .subscribe();

    return () => {
      cleanup();
      channel.unsubscribe();
    };
  }, [callId]);

  const initializeCall = async () => {
    try {
      setIsConnecting(true);
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video' ? { width: 640, height: 480 } : false,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = pc;

      // Add local stream tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsConnected(true);
          setIsConnecting(false);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalingMessage('ice-candidate', {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid
          });
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setIsConnected(true);
          setIsConnecting(false);
          setCallStartTime(Date.now());
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setIsConnected(false);
          setIsConnecting(false);
        }
      };

      // If initiator, create offer
      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignalingMessage('offer', offer);
      }

    } catch (error) {
      console.error('Error initializing call:', error);
      toast({
        title: "Call Failed",
        description: "Could not access camera or microphone. Please check permissions.",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  };

  const sendSignalingMessage = (event: string, payload: any) => {
    supabase.channel(`video_call_${callId}`).send({
      type: 'broadcast',
      event,
      payload
    });
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;
    
    try {
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      sendSignalingMessage('answer', answer);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;
    
    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleICECandidate = async (candidate: ICECandidate) => {
    if (!peerConnectionRef.current) return;
    
    try {
      await peerConnectionRef.current.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const handleRemoteCallEnd = () => {
    toast({
      title: "Call Ended",
      description: `${participantName} ended the call`,
    });
    onCallEnd();
  };

  const endCall = async () => {
    // Update call status in database
    if (participantId && callStartTime) {
      const duration = Math.floor((Date.now() - callStartTime) / 1000);
      try {
        await supabase
          .from('video_calls')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            duration_seconds: duration
          })
          .eq('call_id', callId);
      } catch (error) {
        console.error('Error updating call status:', error);
      }
    }
    
    sendSignalingMessage('call-end', {});
    cleanup();
    onCallEnd();
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    setIsConnected(false);
    setIsConnecting(false);
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black/80 p-4 flex items-center justify-between text-white">
        <div>
          <h2 className="text-lg font-semibold">
            {callType === 'video' ? 'Video Call' : 'Voice Call'}
          </h2>
          <p className="text-sm text-gray-300">with {participantName}</p>
        </div>
        <div className="text-center">
          {isConnecting && <p className="text-sm">Connecting...</p>}
          {isConnected && (
            <div>
              <p className="text-sm">Connected</p>
              <p className="text-xs text-gray-400">{formatDuration(callDuration)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute top-4 right-4 w-32 h-24 bg-gray-900 rounded-lg overflow-hidden border-2 border-white/20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} // Mirror local video
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <CameraOff className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>

        {/* Connection Status Overlay */}
        {isConnecting && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Card className="bg-black/80 border-white/20">
              <CardContent className="p-6 text-center">
                <div className="animate-pulse mb-4">
                  <Phone className="w-8 h-8 text-green-500 mx-auto" />
                </div>
                <p className="text-white mb-2">Connecting to {participantName}...</p>
                <p className="text-gray-400 text-sm">Please wait while we establish the connection</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black/80 p-6 flex items-center justify-center gap-4">
        <Button
          variant={isAudioEnabled ? "default" : "destructive"}
          size="lg"
          className="rounded-full w-12 h-12 p-0"
          onClick={toggleAudio}
        >
          {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>

        <Button
          variant={isVideoEnabled ? "default" : "destructive"}
          size="lg"
          className="rounded-full w-12 h-12 p-0"
          onClick={toggleVideo}
        >
          {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>

        <Button
          variant="destructive"
          size="lg"
          className="rounded-full w-14 h-14 p-0"
          onClick={endCall}
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};

export default VideoCall;