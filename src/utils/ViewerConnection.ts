export type ConnectionState = 
  | 'disconnected'
  | 'checking_broadcaster'
  | 'joining'
  | 'awaiting_offer'
  | 'processing_offer'
  | 'awaiting_ice'
  | 'connected'
  | 'streaming'
  | 'awaiting_user_interaction'
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
  private dbSignalingChannel: any = null;
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
  private requestOfferTimer: NodeJS.Timeout | null = null;
  private requestOfferCount = 0;
  private maxRequestOfferRetries = 5;
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
  private signalingLog: string[] = [];
  private broadcasterReadyReceived = false;
  private videoPlaybackTimeout: NodeJS.Timeout | null = null;
  private offerReceived = false;
  private dbFallbackTimeout: NodeJS.Timeout | null = null;
  private usingDbFallback = false;

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
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const logEntry = `[${timestamp}] 🔄 State: ${state}`;
    console.log(logEntry);
    this.addDebugLog(logEntry);
    this.onStateChange?.(state);
  }

  private addDebugLog(message: string) {
    this.debugLog.push(message);
    if (this.debugLog.length > 50) {
      this.debugLog.shift();
    }
  }

  private addSignalingLog(event: string, details: string = '') {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const logEntry = `[${timestamp}] 📡 ${event}${details ? ': ' + details : ''}`;
    console.log(logEntry);
    this.signalingLog.push(logEntry);
    this.addDebugLog(logEntry);
    if (this.signalingLog.length > 50) {
      this.signalingLog.shift();
    }
  }

  getDebugLog(): string[] {
    return [...this.debugLog];
  }

  getSignalingLog(): string[] {
    return [...this.signalingLog];
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getICEType(): string {
    return this.iceType;
  }

  private async fetchIceServers(supabase: any): Promise<ICEServerConfig> {
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

  private shouldUseTURNEarly(): boolean {
    try {
      // @ts-ignore
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection) {
        if (connection.effectiveType === '2g' || connection.effectiveType === '3g' || connection.saveData) {
          console.log('📱 Detected constrained network, will prefer TURN early');
          return true;
        }
      }
    } catch (e) {
      // Ignore
    }
    return false;
  }

  async connect(supabase: any) {
    try {
      this.addDebugLog('🔌 Starting connection process');
      this.setState('checking_broadcaster');

      const iceConfig = await this.fetchIceServers(supabase);
      
      if (this.shouldUseTURNEarly() && iceConfig.hasTURN) {
        this.addDebugLog('📱 Using TURN relay from start due to network conditions');
        this.useRelayOnly = true;
      }

      await this.establishConnection(supabase);
      this.startHeartbeat(supabase);

    } catch (error) {
      console.error('Connection failed:', error);
      this.setState('failed');
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.addDebugLog(`⚠️ Retry ${this.retryCount}/${this.maxRetries} in 2s`);
        setTimeout(() => this.connect(supabase), 2000);
      }
    }
  }

  private async establishConnection(supabase: any) {
    this.setState('joining');

    const iceConfig = await this.fetchIceServers(supabase);
    
    this.channel = supabase
      .channel(`live_stream_${this.streamId}`, {
        config: {
          broadcast: { ack: true },
          presence: { key: `viewer:${this.sessionToken}` }
        }
      })
      .on('broadcast', { event: 'broadcaster-ready' }, this.handleBroadcasterReady)
      .on('broadcast', { event: 'viewer-ack' }, this.handleViewerAck)
      .on('broadcast', { event: 'offer' }, this.handleOffer)
      .on('broadcast', { event: 'ice-candidate' }, this.handleICECandidate)
      .subscribe(async (status: string) => {
        this.addSignalingLog('Channel status', status);

        if (status === 'SUBSCRIBED') {
          this.addDebugLog('✓ Channel subscribed');
          
          this.broadcasterReadyTimeout = setTimeout(() => {
            if (!this.broadcasterReadyReceived && !this.viewerJoinedSent) {
              this.addDebugLog('⏰ No broadcaster-ready after 2s, sending viewer-joined anyway');
              this.sendViewerJoined();
              this.startRequestOfferCycle();
            }
          }, 2000);
        }
      });

    this.setupDbSignalingFallback(supabase);

    const pcConfig: RTCConfiguration = {
      iceServers: this.useRelayOnly && iceConfig.hasTURN
        ? iceConfig.iceServers.filter(server => 
            server.urls?.toString().includes('turn')
          )
        : iceConfig.iceServers,
      iceTransportPolicy: this.useRelayOnly ? 'relay' : 'all',
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle'
    };

    this.peerConnection = new RTCPeerConnection(pcConfig);
    
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      this.addDebugLog(`🔗 Connection state: ${state}`);
      
      if (state === 'connected') {
        this.setState('connected');
        this.clearAllTimers();
      } else if (state === 'failed') {
        this.addDebugLog('❌ Connection failed, will retry with TURN');
        this.setState('failed');
        
        if (!this.useRelayOnly && iceConfig.hasTURN) {
          this.addDebugLog('🔄 Retrying with TURN relay only');
          this.useRelayOnly = true;
          this.disconnect();
          setTimeout(() => this.connect(supabase), 1000);
        }
      } else if (state === 'disconnected') {
        this.setState('failed');
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      this.addDebugLog(`🧊 ICE state: ${iceState}`);
      
      if (iceState === 'connected' || iceState === 'completed') {
        this.setState('connected');
        this.clearAllTimers();
      } else if (iceState === 'failed') {
        this.setState('failed');
      }
    };

    this.peerConnection.onicegatheringstatechange = () => {
      const gatheringState = this.peerConnection?.iceGatheringState;
      this.addDebugLog(`🧊 ICE gathering: ${gatheringState}`);
    };

    this.peerConnection.ontrack = (event) => {
      this.addDebugLog('📹 Received remote track');
      
      if (this.remoteVideoRef && event.streams[0]) {
        this.remoteVideoRef.srcObject = event.streams[0];
        this.setState('streaming');
        
        this.videoPlaybackTimeout = setTimeout(() => {
          if (this.remoteVideoRef && this.remoteVideoRef.paused) {
            this.addDebugLog('▶️ Auto-playing video');
            this.remoteVideoRef.play().catch((err) => {
              this.addDebugLog(`⚠️ Autoplay blocked: ${err.message}`);
              this.setState('awaiting_user_interaction');
            });
          }
        }, 500);
      }
    };

    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        const candidateStr = event.candidate.candidate;
        this.addSignalingLog('Sending ICE', candidateStr.substring(0, 50));
        
        if (candidateStr.includes('typ relay')) {
          this.iceType = 'relay (TURN)';
          this.onICETypeChange?.('relay (TURN)');
        } else if (candidateStr.includes('typ srflx')) {
          this.iceType = 'srflx (STUN)';
          this.onICETypeChange?.('srflx (STUN)');
        } else if (candidateStr.includes('typ host')) {
          this.iceType = 'host (direct)';
          this.onICETypeChange?.('host (direct)');
        }

        try {
          const result = await this.channel.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: {
              candidate: event.candidate,
              sessionToken: this.sessionToken
            }
          });
          
          if (result !== 'ok') {
            this.addDebugLog('⚠️ ICE send failed, using DB fallback');
            await this.sendSignalViaDb(supabase, 'ice', { candidate: event.candidate });
          }
        } catch (err) {
          this.addDebugLog('❌ ICE broadcast error, using DB');
          await this.sendSignalViaDb(supabase, 'ice', { candidate: event.candidate });
        }
      }
    };
  }

  private setupDbSignalingFallback(supabase: any) {
    this.dbSignalingChannel = supabase
      .channel('db-signaling-viewer')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `session_token=eq.${this.sessionToken}`
        },
        (payload: any) => {
          const signal = payload.new;
          this.addSignalingLog('DB fallback received', signal.type);
          
          if (signal.type === 'offer' && signal.role === 'broadcaster') {
            this.handleOffer({ payload: signal.payload });
            this.usingDbFallback = true;
          } else if (signal.type === 'ice' && signal.role === 'broadcaster') {
            this.handleICECandidate({ payload: signal.payload });
          }
        }
      )
      .subscribe();
  }

  private async sendSignalViaDb(supabase: any, type: string, payload: any) {
    try {
      await supabase.from('webrtc_signals').insert({
        stream_id: this.streamId,
        session_token: this.sessionToken,
        role: 'viewer',
        type,
        payload
      });
      this.addDebugLog(`✓ Sent ${type} via DB`);
    } catch (err) {
      console.error('DB signal send failed:', err);
    }
  }

  private handleBroadcasterReady = () => {
    this.addSignalingLog('Broadcaster ready received');
    this.broadcasterReadyReceived = true;
    
    if (this.broadcasterReadyTimeout) {
      clearTimeout(this.broadcasterReadyTimeout);
      this.broadcasterReadyTimeout = null;
    }
    
    if (!this.viewerJoinedSent) {
      this.sendViewerJoined();
      this.startRequestOfferCycle();
    }
  };

  private sendViewerJoined() {
    if (this.viewerJoinedSent) return;
    
    this.addSignalingLog('Sending viewer-joined');
    this.viewerJoinedSent = true;
    this.setState('awaiting_offer');
    
    this.channel.send({
      type: 'broadcast',
      event: 'viewer-joined',
      payload: {
        sessionToken: this.sessionToken,
        displayName: this.displayName,
        isGuest: this.isGuest
      }
    });

    this.viewerJoinInterval = setInterval(() => {
      if (!this.viewerAcked) {
        this.addDebugLog('🔁 Resending viewer-joined (no ack yet)');
        this.channel.send({
          type: 'broadcast',
          event: 'viewer-joined',
          payload: {
            sessionToken: this.sessionToken,
            displayName: this.displayName,
            isGuest: this.isGuest
          }
        });
      } else {
        if (this.viewerJoinInterval) {
          clearInterval(this.viewerJoinInterval);
          this.viewerJoinInterval = null;
        }
      }
    }, 1500);
  }

  private startRequestOfferCycle() {
    this.requestOfferTimer = setTimeout(() => {
      if (!this.offerReceived && this.requestOfferCount < this.maxRequestOfferRetries) {
        this.requestOfferCount++;
        this.addDebugLog(`🔔 Requesting offer (attempt ${this.requestOfferCount}/${this.maxRequestOfferRetries})`);
        
        this.channel.send({
          type: 'broadcast',
          event: 'request-offer',
          payload: { sessionToken: this.sessionToken }
        });

        if (this.requestOfferCount > 2 && !this.usingDbFallback) {
          this.addDebugLog('⚠️ Broadcast unreliable, activating DB fallback');
          this.sendSignalViaDb(
            (this.channel as any).socket.supabaseClient,
            'request_offer',
            { sessionToken: this.sessionToken }
          );
        }

        this.startRequestOfferCycle();
      } else if (this.requestOfferCount >= this.maxRequestOfferRetries) {
        this.addDebugLog('❌ Max offer requests reached');
        this.setState('timeout');
      }
    }, 3000);
  }

  private handleViewerAck = ({ payload }: any) => {
    if (payload.sessionToken === this.sessionToken) {
      this.addSignalingLog('Viewer ack received');
      this.viewerAcked = true;
      
      if (this.viewerJoinInterval) {
        clearInterval(this.viewerJoinInterval);
        this.viewerJoinInterval = null;
      }
    }
  };

  private handleOffer = async ({ payload }: any) => {
    if (payload.sessionToken !== this.sessionToken) return;

    this.addSignalingLog('Offer received');
    this.offerReceived = true;
    
    if (this.requestOfferTimer) {
      clearTimeout(this.requestOfferTimer);
      this.requestOfferTimer = null;
    }

    if (!this.peerConnection) {
      this.addDebugLog('❌ No peer connection for offer');
      return;
    }

    try {
      this.setState('processing_offer');
      
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(payload.offer)
      );
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.addSignalingLog('Sending answer');
      this.setState('awaiting_ice');

      const result = await this.channel.send({
        type: 'broadcast',
        event: 'answer',
        payload: {
          answer,
          sessionToken: this.sessionToken
        }
      });

      if (result !== 'ok') {
        this.addDebugLog('⚠️ Answer send failed, using DB');
        await this.sendSignalViaDb(
          (this.channel as any).socket.supabaseClient,
          'answer',
          { answer, sessionToken: this.sessionToken }
        );
      }

    } catch (error) {
      console.error('Error handling offer:', error);
      this.setState('failed');
    }
  };

  private handleICECandidate = async ({ payload }: any) => {
    if (payload.sessionToken !== this.sessionToken) return;

    if (this.peerConnection && payload.candidate) {
      try {
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(payload.candidate)
        );
        this.addSignalingLog('Added ICE candidate');
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  private startHeartbeat(supabase: any) {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await supabase.rpc('update_viewer_heartbeat', {
          p_session_token: this.sessionToken
        });
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, 15000);
  }

  public async requestOfferManually() {
    this.addDebugLog('🔄 Manual offer request triggered');
    this.offerReceived = false;
    this.requestOfferCount = 0;
    
    this.channel.send({
      type: 'broadcast',
      event: 'request-offer',
      payload: { sessionToken: this.sessionToken }
    });
    
    this.startRequestOfferCycle();
  }

  public async tryTURNOnly(supabase: any) {
    this.addDebugLog('🔄 Forcing TURN relay only');
    this.useRelayOnly = true;
    await this.hardReconnect(supabase);
  }

  async hardReconnect(supabase: any) {
    this.addDebugLog('🔄 Hard reconnect initiated');
    this.disconnect();
    
    this.retryCount = 0;
    this.viewerJoinedSent = false;
    this.viewerAcked = false;
    this.offerReceived = false;
    this.broadcasterReadyReceived = false;
    this.requestOfferCount = 0;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.connect(supabase);
  }

  private clearAllTimers() {
    if (this.broadcasterReadyTimeout) {
      clearTimeout(this.broadcasterReadyTimeout);
      this.broadcasterReadyTimeout = null;
    }
    if (this.offerTimeout) {
      clearTimeout(this.offerTimeout);
      this.offerTimeout = null;
    }
    if (this.requestOfferTimer) {
      clearTimeout(this.requestOfferTimer);
      this.requestOfferTimer = null;
    }
    if (this.viewerJoinInterval) {
      clearInterval(this.viewerJoinInterval);
      this.viewerJoinInterval = null;
    }
    if (this.videoPlaybackTimeout) {
      clearTimeout(this.videoPlaybackTimeout);
      this.videoPlaybackTimeout = null;
    }
    if (this.dbFallbackTimeout) {
      clearTimeout(this.dbFallbackTimeout);
      this.dbFallbackTimeout = null;
    }
  }

  disconnect() {
    this.addDebugLog('🔌 Disconnecting');
    
    this.clearAllTimers();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    if (this.dbSignalingChannel) {
      this.dbSignalingChannel.unsubscribe();
      this.dbSignalingChannel = null;
    }

    if (this.remoteVideoRef) {
      this.remoteVideoRef.srcObject = null;
    }

    this.setState('disconnected');
  }
}
