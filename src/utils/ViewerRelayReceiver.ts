import { supabase } from '@/integrations/supabase/client';

interface RelayedStream {
  sourceToken: string;
  stream: MediaStream;
  displayName: string;
  avatarUrl?: string;
  peerConnection: RTCPeerConnection;
}

export class ViewerRelayReceiver {
  private streamId: string;
  private sessionToken: string;
  private relayedStreams: Map<string, RelayedStream> = new Map();
  private channel: any = null;
  private cleanupFunctions: (() => void)[] = [];
  private onRelayedStreamsUpdate?: (streams: Map<string, RelayedStream>) => void;

  constructor(
    streamId: string,
    sessionToken: string,
    onRelayedStreamsUpdate?: (streams: Map<string, RelayedStream>) => void
  ) {
    this.streamId = streamId;
    this.sessionToken = sessionToken;
    this.onRelayedStreamsUpdate = onRelayedStreamsUpdate;
  }

  async initialize() {
    console.log('🔄 ViewerRelayReceiver: Initializing for stream', this.streamId, 'token:', this.sessionToken);
    await this.setupSignaling();
  }

  private async setupSignaling() {
    this.channel = supabase.channel(`viewer_relay_${this.streamId}`)
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.targetToken === this.sessionToken) {
          console.log('📥 Received relay offer from host for viewer:', payload.sourceDisplayName);
          await this.handleOffer(payload);
        }
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload.targetToken === this.sessionToken) {
          await this.handleICE(payload);
        }
      })
      .subscribe((status) => {
        console.log('🔄 Viewer relay receiver channel status:', status);
      });

    this.cleanupFunctions.push(() => {
      supabase.removeChannel(this.channel);
    });
  }

  private async handleOffer(payload: any) {
    const sourceToken = payload.sourceToken;

    // Don't create duplicate connections
    if (this.relayedStreams.has(sourceToken)) {
      console.log('⚠️ Already have relay connection from:', sourceToken);
      return;
    }

    try {
      console.log('🔗 Creating peer connection for relayed stream from:', payload.sourceDisplayName);

      const iceConfig = await this.getICEServers();
      const peerConnection = new RTCPeerConnection({
        iceServers: iceConfig.iceServers,
        iceCandidatePoolSize: 10
      });

      // Handle incoming tracks (relayed viewer camera)
      peerConnection.ontrack = (event) => {
        console.log('📹 Received relayed track:', event.track.kind, 'from:', payload.sourceDisplayName);
        
        const stream = event.streams[0];
        if (stream) {
          const relayedStream: RelayedStream = {
            sourceToken,
            stream,
            displayName: payload.sourceDisplayName || 'Viewer',
            avatarUrl: payload.sourceAvatarUrl,
            peerConnection
          };

          this.relayedStreams.set(sourceToken, relayedStream);
          this.notifyUpdate();
          console.log('✅ Added relayed stream from:', payload.sourceDisplayName);
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          await this.sendSignalToHost('ice', {
            candidate: event.candidate,
            sourceToken,
            targetToken: this.sessionToken
          });
        }
      };

      // Handle connection state
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log(`🔄 Relayed stream ${sourceToken} connection state:`, state);
        
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          this.removeRelayedStream(sourceToken);
        }
      };

      // Set remote description from offer
      const offer = new RTCSessionDescription({
        type: 'offer',
        sdp: payload.sdp
      });
      await peerConnection.setRemoteDescription(offer);

      // Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      await this.sendSignalToHost('answer', {
        sdp: answer.sdp,
        type: answer.type,
        sourceToken,
        targetToken: this.sessionToken
      });

      console.log('✅ Sent answer for relayed stream from:', payload.sourceDisplayName);
    } catch (error) {
      console.error('❌ Error handling relay offer:', error);
    }
  }

  private async handleICE(payload: any) {
    const relayedStream = this.relayedStreams.get(payload.sourceToken);
    
    if (!relayedStream || !payload.candidate) return;

    try {
      const candidate = new RTCIceCandidate(payload.candidate);
      await relayedStream.peerConnection.addIceCandidate(candidate);
      console.log('✅ Added ICE candidate for relayed stream:', payload.sourceToken);
    } catch (error) {
      console.error('❌ Error adding relay ICE candidate:', error);
    }
  }

  private async sendSignalToHost(type: string, data: any) {
    try {
      await this.channel?.send({
        type: 'broadcast',
        event: type,
        payload: {
          ...data,
          fromViewer: true
        }
      });
      console.log(`✅ Sent ${type} signal to host for relay`);
    } catch (error) {
      console.error('❌ Error sending signal to host:', error);
    }
  }

  private async getICEServers(): Promise<{ iceServers: RTCIceServer[] }> {
    try {
      const { data, error } = await supabase.functions.invoke('get-ice-servers');
      
      if (error || !data) {
        return {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        };
      }
      
      return {
        iceServers: data.iceServers || []
      };
    } catch (error) {
      console.error('Error fetching ICE servers:', error);
      return {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
    }
  }

  private removeRelayedStream(sourceToken: string) {
    const relayedStream = this.relayedStreams.get(sourceToken);
    if (relayedStream) {
      relayedStream.peerConnection.close();
      this.relayedStreams.delete(sourceToken);
      this.notifyUpdate();
      console.log('🗑️ Removed relayed stream:', sourceToken);
    }
  }

  private notifyUpdate() {
    this.onRelayedStreamsUpdate?.(this.relayedStreams);
  }

  getRelayedStreams() {
    return this.relayedStreams;
  }

  cleanup() {
    console.log('🧹 Cleaning up viewer relay receiver');
    
    for (const [sourceToken, relayedStream] of this.relayedStreams) {
      relayedStream.peerConnection.close();
      console.log('⏹️ Closed relayed stream connection:', sourceToken);
    }

    this.relayedStreams.clear();

    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
  }
}
