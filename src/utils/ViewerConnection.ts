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

interface ICEServerConfig {
  iceServers: RTCIceServer[];
  hasTURN: boolean;
  warning?: string;
}

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
  private iceConfig: ICEServerConfig | null = null;
  private iceConfigExpiry: number = 0;
  private viewerJoinedSent = false;
  private viewerAcked = false;
  private viewerJoinInterval: NodeJS.Timeout | null = null;
  private debugLog: string[] = [];
  private broadcasterReadyReceived = false;

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
    const logEntry = `🔄 ${new Date().toISOString().split('T')[1].slice(0, 8)} Connection state: ${state}`;
    console.log(logEntry);
    this.addDebugLog(logEntry);
    this.onStateChange?.(state);
  }

  private addDebugLog(message: string) {
    this.debugLog.push(message);
    if (this.debugLog.length > 20) {
      this.debugLog.shift();
    }
  }

  getDebugLog(): string[] {
    return [...this.debugLog];
  }

  private async fetchIceServers(supabase: any): Promise<ICEServerConfig> {
    // Cache for 5 minutes
    if (this.iceConfig && Date.now() < this.iceConfigExpiry) {
      return this.iceConfig;
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-ice-servers');
      
      if (error) throw error;
      
      this.iceConfig = data;
      this.iceConfigExpiry = Date.now() + 5 * 60 * 1000;
      
      if (data.warning) {
        console.warn('⚠️ ICE server warning:', data.warning);
      }
      
      console.log(`✓ Fetched ICE config: ${data.hasTURN ? 'TURN+STUN' : 'STUN only'}`);
      return data;
    } catch (error) {
      console.error('Failed to fetch ICE servers, using STUN fallback:', error);
      
      return {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        hasTURN: false,
        warning: 'Failed to load TURN config'
      };
    }
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
    // Fetch dynamic ICE servers
    const iceConfig = await this.fetchIceServers(supabase);

    const config: RTCConfiguration = { iceServers: iceConfig.iceServers };
    if (this.useRelayOnly && iceConfig.hasTURN) {
      config.iceTransportPolicy = 'relay';
      console.log('🔒 Using relay-only mode (TURN-only)');
    }

    console.log('🧊 ICE servers:', iceConfig.iceServers.map(s => ({ urls: s.urls, hasAuth: !!(s as any).username })));

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
    this.peerConnection.oniceconnectionstatechange = async () => {
      console.log(`🧊 ICE connection state: ${this.peerConnection?.iceConnectionState}`);
      
      if (this.peerConnection?.iceConnectionState === 'connected' || 
          this.peerConnection?.iceConnectionState === 'completed') {
        this.setState('connected');
        
        // Detect selected candidate pair type
        try {
          const stats = await this.peerConnection.getStats();
          stats.forEach((report: any) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              stats.forEach((candidate: any) => {
                if (candidate.id === report.localCandidateId && candidate.type === 'local-candidate') {
                  const type = candidate.candidateType; // host, srflx (STUN), or relay (TURN)
                  this.iceType = type;
                  this.onICETypeChange?.(type);
                  console.log(`🎯 Connected via: ${type}`);
                }
              });
            }
          });
        } catch (err) {
          console.warn('Could not detect ICE candidate type:', err);
        }
      } else if (this.peerConnection?.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed');
        
        // Retry with relay-only if TURN is available and we haven't tried it yet
        if (!this.useRelayOnly && iceConfig.hasTURN) {
          console.log('🔄 Retrying with TURN relay-only mode');
          this.useRelayOnly = true;
          this.disconnect();
          setTimeout(() => this.connect(supabase), 1000);
        } else {
          this.setState('failed');
        }
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
        broadcasterReady = true;
        if (this.broadcasterReadyTimeout) {
          clearTimeout(this.broadcasterReadyTimeout);
          this.broadcasterReadyTimeout = null;
        }
        
        const logMsg = '✓ Broadcaster is ready';
        console.log(logMsg);
        this.addDebugLog(logMsg);
        
        // Only transition states on first broadcaster-ready
        if (!this.broadcasterReadyReceived) {
          this.broadcasterReadyReceived = true;
          this.setState('joining');
          
          // Send viewer-joined and start persistent retry until ack/offer
          this.sendSignal('viewer-joined', {
            sessionToken: this.sessionToken,
            displayName: this.displayName,
            isGuest: this.isGuest
          });
          this.addDebugLog(`📤 Sending viewer-joined (attempt 1)`);
          
          let attemptCount = 1;
          this.viewerJoinInterval = setInterval(() => {
            if (this.viewerAcked) {
              console.log('✓ Viewer acknowledged or offer received, stopping resend');
              clearInterval(this.viewerJoinInterval!);
              this.viewerJoinInterval = null;
              return;
            }
            
            attemptCount++;
            if (attemptCount > 10) { // Max 10 attempts = 20s
              console.error('❌ Failed to get acknowledgment after 10 attempts');
              clearInterval(this.viewerJoinInterval!);
              this.viewerJoinInterval = null;
              return;
            }
            
            console.log(`🔄 Re-sending viewer-joined (attempt ${attemptCount})`);
            this.addDebugLog(`📤 Re-sending viewer-joined (attempt ${attemptCount})`);
            this.sendSignal('viewer-joined', {
              sessionToken: this.sessionToken,
              displayName: this.displayName,
              isGuest: this.isGuest
            });
          }, 2000);
          
          this.setState('awaiting_offer');
        }
        
        // Set timeout for offer (increased to 20s for slower networks)
        if (this.offerTimeout) clearTimeout(this.offerTimeout);
        this.offerTimeout = setTimeout(() => {
          console.error('❌ Offer timeout - broadcaster did not send offer in 20s');
          
          // Retry with relay-only if TURN available
          if (!this.useRelayOnly && iceConfig.hasTURN) {
            console.log('🔄 Offer timeout - retrying with TURN relay-only');
            this.useRelayOnly = true;
            this.disconnect();
            setTimeout(() => this.connect(supabase), 1000);
          } else {
            this.setState('timeout');
          }
        }, 20000);
      })
      .on('broadcast', { event: 'viewer-ack' }, ({ payload }: any) => {
        if (payload.sessionToken === this.sessionToken) {
          const logMsg = '✓ Received viewer acknowledgment from broadcaster';
          console.log(logMsg);
          this.addDebugLog(logMsg);
          this.viewerAcked = true;
          
          // Stop resending viewer-joined
          if (this.viewerJoinInterval) {
            clearInterval(this.viewerJoinInterval);
            this.viewerJoinInterval = null;
          }
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

    const logMsg = '📥 Received offer from broadcaster';
    console.log(logMsg);
    this.addDebugLog(logMsg);
    
    // Mark as acknowledged - stop resending viewer-joined
    this.viewerAcked = true;
    if (this.viewerJoinInterval) {
      clearInterval(this.viewerJoinInterval);
      this.viewerJoinInterval = null;
    }
    
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
    if (this.viewerJoinInterval) {
      clearInterval(this.viewerJoinInterval);
      this.viewerJoinInterval = null;
    }
    this.sendSignal('viewer-left', { sessionToken: this.sessionToken });
    this.peerConnection?.close();
    this.channel?.unsubscribe();
    this.setState('disconnected');
  }
}
