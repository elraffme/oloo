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
  private supabaseClient: any = null;
  private streamId: string;
  private sessionToken: string;
  private remoteVideoRef: HTMLVideoElement | null = null;
  private displayName: string;
  private isGuest: boolean;
  private retryCount = 0;
  private maxRetries = 4;
  private reconnectAttempt = 0;
  private maxReconnectAttempts = 3;
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
  private heartbeatFailures = 0;
  private maxHeartbeatFailures = 8;

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

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
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
    this.supabaseClient = supabase;
    console.log('🎬 ViewerConnection.connect() called for stream:', this.streamId);
    console.log('  Session token:', this.sessionToken?.substring(0, 8) + '...');
    console.log('  Display name:', this.displayName);
    
    try {
      this.addDebugLog('🔌 Starting connection process');
      this.setState('checking_broadcaster');

      const iceConfig = await this.fetchIceServers(supabase);
      console.log('✅ Fetched ICE servers:', iceConfig.hasTURN ? 'with TURN' : 'STUN only');
      
      if (this.shouldUseTURNEarly() && iceConfig.hasTURN) {
        this.addDebugLog('📱 Using TURN relay from start due to network conditions');
        this.useRelayOnly = true;
      }

      await this.establishConnection(supabase);
      this.startHeartbeat(supabase);

    } catch (error) {
      console.error('❌ Connection failed with error:', error);
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
        console.log(`📡 Channel subscription status: ${status}`);
        this.addSignalingLog('Channel status', status);

        if (status === 'SUBSCRIBED') {
          this.addDebugLog('✓ Channel subscribed');
          console.log('✅ Realtime channel SUBSCRIBED, channel object:', this.channel ? 'exists' : 'NULL');
          
          // Start DB fallback proactively for better reliability
          this.setupDbSignalingFallback(supabase);
          
          // Send viewer-joined immediately after subscribe
          if (!this.viewerJoinedSent) {
            console.log('🚀 Attempting to send viewer-joined immediately after SUBSCRIBED');
            this.addSignalingLog('Sending viewer-joined immediately after subscribe');
            this.sendViewerJoined();
            this.startRequestOfferCycle();
          }
          
          this.broadcasterReadyTimeout = setTimeout(() => {
            if (!this.broadcasterReadyReceived && !this.viewerJoinedSent) {
              this.addDebugLog('⏰ No broadcaster-ready after 2s, sending viewer-joined anyway');
              this.sendViewerJoined();
              this.startRequestOfferCycle();
            }
          }, 2000);
          
          // Set offer timeout to 15s
          this.offerTimeout = setTimeout(() => {
            if (!this.offerReceived) {
              this.addSignalingLog('Offer timeout', 'No offer received from broadcaster');
              this.setState('timeout');
              this.startRequestOfferCycle();
              this.setupDbSignalingFallback(supabase);
              this.tryTURNOnly(supabase);
            }
          }, 15000);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel subscription ERROR');
          this.addDebugLog('❌ Channel subscription error');
          this.setState('failed');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Channel subscription TIMED OUT');
          this.addDebugLog('❌ Channel subscription timed out');
          this.setState('timeout');
        }
      });

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
        this.reconnectAttempt = 0; // Reset reconnect counter on success
      } else if (state === 'failed') {
        this.addDebugLog('❌ Connection failed');
        this.setState('failed');
        
        // Try TURN-only first
        if (!this.useRelayOnly && iceConfig.hasTURN) {
          this.addDebugLog('🔄 Retrying with TURN relay only');
          this.useRelayOnly = true;
          this.disconnect();
          setTimeout(() => this.connect(this.supabaseClient), 1000);
        } else if (this.supabaseClient) {
          // Attempt reconnection with exponential backoff
          this.attemptReconnection(this.supabaseClient);
        }
      } else if (state === 'disconnected') {
        // Don't immediately reconnect on disconnect - monitor connection health
        this.addDebugLog('⚠️ Connection disconnected, monitoring...');
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
      const track = event.track;
      this.addDebugLog(`📹 Received ${track.kind} track: enabled=${track.enabled}, state=${track.readyState}`);
      
      // Set srcObject only once when first track arrives
      if (this.remoteVideoRef && event.streams[0] && !this.remoteVideoRef.srcObject) {
        this.remoteVideoRef.srcObject = event.streams[0];
        this.addDebugLog('✓ Set srcObject to remote stream');
        
        // Log all tracks in the stream
        event.streams[0].getTracks().forEach(t => {
          this.addDebugLog(`  Track in stream: ${t.kind}, enabled=${t.enabled}, state=${t.readyState}`);
        });
      }
      
      // Check if we have both audio and video
      if (this.remoteVideoRef?.srcObject) {
        const stream = this.remoteVideoRef.srcObject as MediaStream;
        const hasAudio = stream.getAudioTracks().length > 0;
        const hasVideo = stream.getVideoTracks().length > 0;
        
        this.addDebugLog(`Stream status: audio=${hasAudio}, video=${hasVideo}`);
        
        // Only set to streaming when we have video (audio is optional)
        if (hasVideo) {
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
          
          if (result !== 'ok' && this.supabaseClient) {
            this.addDebugLog('⚠️ ICE send failed, using DB fallback');
            await this.sendSignalViaDb(this.supabaseClient, 'ice', { candidate: event.candidate });
          }
        } catch (err) {
          this.addDebugLog('❌ ICE broadcast error, using DB');
          if (this.supabaseClient) {
            await this.sendSignalViaDb(this.supabaseClient, 'ice', { candidate: event.candidate });
          }
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
    
    if (!this.channel) {
      console.error('❌ Cannot send viewer-joined: channel is null');
      return;
    }
    
    this.addSignalingLog('Sending viewer-joined');
    this.viewerJoinedSent = true;
    this.setState('awaiting_offer');
    
    try {
      const sendPromise = this.channel.send({
        type: 'broadcast',
        event: 'viewer-joined',
        payload: {
          sessionToken: this.sessionToken,
          displayName: this.displayName,
          isGuest: this.isGuest
        }
      });
      
      // Log send result
      if (sendPromise && typeof sendPromise.then === 'function') {
        sendPromise.then((result: any) => {
          console.log('✅ viewer-joined broadcast sent:', result);
        }).catch((err: any) => {
          console.error('❌ viewer-joined broadcast failed:', err);
        });
      }
    } catch (err) {
      console.error('❌ Exception sending viewer-joined:', err);
    }

    this.viewerJoinInterval = setInterval(() => {
      if (!this.viewerAcked && this.channel) {
        this.addDebugLog('🔁 Resending viewer-joined (no ack yet)');
        try {
          this.channel.send({
            type: 'broadcast',
            event: 'viewer-joined',
            payload: {
              sessionToken: this.sessionToken,
              displayName: this.displayName,
              isGuest: this.isGuest
            }
          });
        } catch (err) {
          console.error('❌ Exception resending viewer-joined:', err);
        }
      } else if (this.viewerAcked) {
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
        
        if (!this.channel) {
          console.error('❌ Cannot request offer: channel is null');
          this.setState('failed');
          return;
        }
        
        try {
          this.channel.send({
            type: 'broadcast',
            event: 'request-offer',
            payload: { sessionToken: this.sessionToken }
          });
        } catch (err) {
          console.error('❌ Exception requesting offer:', err);
        }

        if (this.requestOfferCount > 2 && !this.usingDbFallback && this.supabaseClient) {
          this.addDebugLog('⚠️ Broadcast unreliable, activating DB fallback');
          this.sendSignalViaDb(
            this.supabaseClient,
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
    
    // CRITICAL: Send offer-received ACK immediately
    this.channel.send({
      type: 'broadcast',
      event: 'offer-received',
      payload: { sessionToken: this.sessionToken }
    });
    
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
      
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
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

      if (result !== 'ok' && this.supabaseClient) {
        this.addDebugLog('⚠️ Answer send failed, using DB');
        await this.sendSignalViaDb(
          this.supabaseClient,
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
        const { data, error } = await supabase.rpc('update_viewer_heartbeat', {
          p_session_token: this.sessionToken
        });

        if (error) {
          console.error('Heartbeat error:', error);
          this.heartbeatFailures++;
          this.addDebugLog(`⚠️ Heartbeat failed (${this.heartbeatFailures}/${this.maxHeartbeatFailures})`);
        } else if (!data) {
          // Function returned false → session invalid
          console.warn('Heartbeat failed: session invalid');
          this.heartbeatFailures++;
          this.addDebugLog(`⚠️ Session invalid (${this.heartbeatFailures}/${this.maxHeartbeatFailures})`);
        } else {
          // Heartbeat successful, reset counter
          this.heartbeatFailures = 0;
        }

        if (this.heartbeatFailures >= this.maxHeartbeatFailures) {
          this.addDebugLog('❌ Multiple heartbeat failures – reconnecting');
          this.heartbeatFailures = 0;
          // Only reconnect if not already connected
          if (this.peerConnection?.connectionState !== 'connected') {
            await this.hardReconnect(supabase);
          } else {
            this.addDebugLog('✓ WebRTC still connected, ignoring heartbeat failures');
          }
        }
      } catch (error) {
        console.error('Heartbeat exception:', error);
        this.heartbeatFailures++;
        
        if (this.heartbeatFailures >= this.maxHeartbeatFailures) {
          this.addDebugLog('❌ Multiple heartbeat failures – reconnecting');
          this.heartbeatFailures = 0;
          // Only reconnect if not already connected
          if (this.peerConnection?.connectionState !== 'connected') {
            await this.hardReconnect(supabase);
          } else {
            this.addDebugLog('✓ WebRTC still connected, ignoring heartbeat failures');
          }
        }
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
    this.addDebugLog('♻️ Hard reconnect starting');
    
    // Close peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        console.warn('Error closing PC during hardReconnect:', e);
      }
      this.peerConnection = null;
    }

    // Clear signaling state
    this.offerReceived = false;
    this.viewerAcked = false;
    this.broadcasterReadyReceived = false;
    this.viewerJoinedSent = false;
    this.requestOfferCount = 0;
    this.retryCount = 0;

    // Clear timers
    if (this.offerTimeout) {
      clearTimeout(this.offerTimeout);
      this.offerTimeout = null;
    }
    if (this.broadcasterReadyTimeout) {
      clearTimeout(this.broadcasterReadyTimeout);
      this.broadcasterReadyTimeout = null;
    }
    if (this.requestOfferTimer) {
      clearTimeout(this.requestOfferTimer);
      this.requestOfferTimer = null;
    }
    if (this.viewerJoinInterval) {
      clearInterval(this.viewerJoinInterval);
      this.viewerJoinInterval = null;
    }

    // Close existing channels
    if (this.channel) {
      try {
        await this.channel.unsubscribe();
      } catch (e) {
        console.warn('Error unsubscribing channel during hardReconnect:', e);
      }
      this.channel = null;
    }
    if (this.dbSignalingChannel) {
      try {
        await this.dbSignalingChannel.unsubscribe();
      } catch (e) {
        console.warn('Error unsubscribing DB channel during hardReconnect:', e);
      }
      this.dbSignalingChannel = null;
    }

    // Wait a moment before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Resubscribe / re-establish connection
    await this.establishConnection(supabase);
  }

  private attemptReconnection(supabase: any) {
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      this.addDebugLog(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      this.setState('failed');
      return;
    }

    this.reconnectAttempt++;
    const delays = [1000, 2000, 5000, 10000]; // Exponential backoff: 1s, 2s, 5s, 10s
    const delay = delays[Math.min(this.reconnectAttempt - 1, delays.length - 1)];

    this.addDebugLog(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}/${this.maxReconnectAttempts})`);
    this.setState('checking_broadcaster');

    setTimeout(async () => {
      this.disconnect();
      this.retryCount = 0;
      this.viewerJoinedSent = false;
      this.viewerAcked = false;
      this.offerReceived = false;
      this.broadcasterReadyReceived = false;
      this.requestOfferCount = 0;
      
      await this.connect(supabase);
    }, delay);
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
