export type ConnectionState = 
  | 'disconnected'
  | 'checking_broadcaster'
  | 'joining'
  | 'awaiting_offer'
  | 'processing_offer'
  | 'awaiting_ice'
  | 'connected'
  | 'streaming'
  | 'failed'
  | 'timeout';

export class ViewerConnection {
  private peerConnection: RTCPeerConnection | null = null;
  private channel: any = null;
  private streamId: string;
  private sessionToken: string;
  private remoteVideoRef: HTMLVideoElement | null = null;
  private displayName: string;
  private isGuest: boolean;
  private retryCount = 0;
  private maxRetries = 3;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private broadcasterReadyTimeout: NodeJS.Timeout | null = null;
  private offerTimeout: NodeJS.Timeout | null = null;
  private onStateChange?: (state: ConnectionState) => void;
  private useRelayOnly = false;
  private iceType: string = 'unknown';
  private onICETypeChange?: (type: string) => void;

  constructor(
    streamId: string, 
    sessionToken: string, 
    videoElement: HTMLVideoElement, 
    displayName: string, 
    isGuest: boolean,
    onStateChange?: (state: ConnectionState) => void,
    onICETypeChange?: (type: string) => void
  ) {
    this.streamId = streamId;
    this.sessionToken = sessionToken;
    this.remoteVideoRef = videoElement;
    this.displayName = displayName;
    this.isGuest = isGuest;
    this.onStateChange = onStateChange;
    this.onICETypeChange = onICETypeChange;
  }

  private setState(state: ConnectionState) {
    this.connectionState = state;
    console.log(`🔄 Connection state: ${state}`);
    this.onStateChange?.(state);
  }

  async connect(supabase: any) {
    try {
      this.setState('checking_broadcaster');
      await this.establishConnection(supabase);
      this.startHeartbeat(supabase);
    } catch (error) {
      console.error('Connection failed:', error);
      this.setState('failed');
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`🔄 Retrying connection (${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.connect(supabase), 2000);
      }
    }
  }

  private startHeartbeat(supabase: any) {
    // Send heartbeat every 30 seconds to keep session active
    this.heartbeatInterval = setInterval(async () => {
      try {
        await supabase.rpc('update_viewer_heartbeat', {
          p_session_token: this.sessionToken
        });
      } catch (error) {
        console.error('❌ Heartbeat failed:', error);
      }
    }, 30000);
  }

  private async establishConnection(supabase: any) {
    const turnServers = import.meta.env.VITE_TURN_URLS?.split(',').map((url: string) => ({
      urls: url.trim(),
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL
    })) || [];

    const iceServers = [
      ...turnServers,
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' }
    ];

    const config: RTCConfiguration = { iceServers };
    if (this.useRelayOnly && turnServers.length > 0) {
      config.iceTransportPolicy = 'relay';
      console.log('🔒 Using relay-only mode (TURN-only)');
    }

    console.log('🧊 ICE servers:', iceServers.map(s => ({ urls: s.urls, hasAuth: !!(s as any).username })));

    this.peerConnection = new RTCPeerConnection(config);

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log(`📡 Viewer connection state: ${this.peerConnection?.connectionState}`);
      
      if (this.peerConnection?.connectionState === 'connected') {
        console.log('✓ Successfully connected to broadcaster');
        this.setState('connected');
        this.retryCount = 0; // Reset retry count on success
      } else if (this.peerConnection?.connectionState === 'failed') {
        console.error('❌ Connection failed');
        this.setState('failed');
      }
    };

    // Monitor ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 Viewer ICE state: ${this.peerConnection?.iceConnectionState}`);
      
      if (this.peerConnection?.iceConnectionState === 'connected') {
        this.setState('connected');
      } else if (this.peerConnection?.iceConnectionState === 'failed' && this.retryCount < this.maxRetries) {
        console.warn('⚠️ ICE connection failed, attempting restart');
        this.retryCount++;
        this.peerConnection?.restartIce();
      }
    };

    // Monitor ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log(`🧊 Viewer ICE gathering state: ${this.peerConnection?.iceGatheringState}`);
    };

    this.peerConnection.ontrack = (event) => {
      console.log(`🎥 Received remote ${event.track.kind} track:`, {
        id: event.track.id,
        kind: event.track.kind,
        label: event.track.label,
        enabled: event.track.enabled,
        readyState: event.track.readyState,
        muted: event.track.muted
      });
      
      if (this.remoteVideoRef && event.streams[0]) {
        this.remoteVideoRef.srcObject = event.streams[0];
        this.setState('streaming');
        
        // Verify tracks in the stream
        const stream = event.streams[0];
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        console.log(`✓ Stream tracks: ${videoTracks.length} video, ${audioTracks.length} audio`);
        
        // Ensure video element plays
        this.remoteVideoRef.play().catch(err => {
          console.warn('⚠️ Autoplay prevented, user interaction required:', err);
        });
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 Viewer ICE candidate type: ${event.candidate.type} (${event.candidate.protocol})`);
        this.sendSignal('ice-candidate', {
          sessionToken: this.sessionToken,
          candidate: event.candidate
        });
      } else {
        console.log('✓ ICE gathering complete');
      }
    };

    // Set up channel and wait for broadcaster-ready signal
    let broadcasterReady = false;
    
    this.channel = supabase
      .channel(`live_stream_${this.streamId}`)
      .on('broadcast', { event: 'broadcaster-ready' }, () => {
        console.log('✓ Broadcaster is ready');
        broadcasterReady = true;
        
        if (this.broadcasterReadyTimeout) {
          clearTimeout(this.broadcasterReadyTimeout);
        }
        
        // Send join signal
        this.setState('joining');
        setTimeout(() => {
          console.log('📤 Sending viewer-joined signal');
          this.sendSignal('viewer-joined', { 
            sessionToken: this.sessionToken,
            displayName: this.displayName,
            isGuest: this.isGuest
          });
        }, 500);
      })
      .on('broadcast', { event: 'viewer-ack' }, ({ payload }: any) => {
        if (payload.sessionToken === this.sessionToken) {
          console.log('✓ Received viewer-ack from broadcaster');
          this.setState('awaiting_offer');
          
          // Set timeout for offer after ack
          this.offerTimeout = setTimeout(() => {
            if (this.connectionState === 'awaiting_offer') {
              console.error('❌ Timeout waiting for offer');
              this.setState('timeout');
            }
          }, 10000);
        }
      })
      .on('broadcast', { event: 'offer' }, this.handleOffer)
      .on('broadcast', { event: 'ice-candidate' }, this.handleICECandidate)
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('✓ Viewer subscribed to channel');
          
          this.broadcasterReadyTimeout = setTimeout(() => {
            if (!broadcasterReady) {
              console.error('❌ Timeout: Broadcaster is not online');
              this.setState('timeout');
            }
          }, 10000);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ Channel status: ${status}, attempting reconnect...`);
          if (!broadcasterReady) {
            setTimeout(() => {
              console.log('🔄 Re-sending viewer-joined after channel reconnect');
              this.sendSignal('viewer-joined', { 
                sessionToken: this.sessionToken,
                displayName: this.displayName,
                isGuest: this.isGuest
              });
            }, 1000);
          }
        }
      });
  }

  private handleOffer = async ({ payload }: any) => {
    if (payload.sessionToken !== this.sessionToken) return;

    console.log('📥 Received offer from broadcaster');
    
    if (this.offerTimeout) {
      clearTimeout(this.offerTimeout);
    }
    
    this.setState('processing_offer');

    try {
      const { offer } = payload;
      await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await this.peerConnection?.createAnswer();
      await this.peerConnection?.setLocalDescription(answer);
      
      console.log('📤 Sending answer to broadcaster');
      this.sendSignal('answer', {
        sessionToken: this.sessionToken,
        answer
      });
    } catch (error) {
      console.error('❌ Error processing offer:', error);
      this.setState('failed');
    }
  }

  private handleICECandidate = async ({ payload }: any) => {
    if (payload.sessionToken !== this.sessionToken) return;

    const { candidate } = payload;
    if (this.peerConnection && candidate) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    }
  }

  private sendSignal(event: string, payload: any) {
    this.channel?.send({
      type: 'broadcast',
      event,
      payload
    });
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getICEType(): string {
    return this.iceType;
  }

  async hardReconnect(supabase: any) {
    console.log('🔄 Hard reconnect initiated');
    this.disconnect();
    this.retryCount = 0;
    this.useRelayOnly = false;
    this.iceType = 'unknown';
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.connect(supabase);
  }

  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.broadcasterReadyTimeout) {
      clearTimeout(this.broadcasterReadyTimeout);
    }
    if (this.offerTimeout) {
      clearTimeout(this.offerTimeout);
    }
    this.sendSignal('viewer-left', { sessionToken: this.sessionToken });
    this.peerConnection?.close();
    this.channel?.unsubscribe();
    this.setState('disconnected');
  }
}
