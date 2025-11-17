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
  private signalingLog: string[] = [];
  private broadcasterReadyReceived = false;
  private videoPlaybackTimeout: NodeJS.Timeout | null = null;

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
    if (this.debugLog.length > 30) {
      this.debugLog.shift();
    }
  }

  private addSignalingLog(event: string, details: string = '') {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const logEntry = `[${timestamp}] 📡 ${event}${details ? ': ' + details : ''}`;
    console.log(logEntry);
    this.signalingLog.push(logEntry);
    this.addDebugLog(logEntry);
    if (this.signalingLog.length > 30) {
      this.signalingLog.shift();
    }
  }

  getDebugLog(): string[] {
    return [...this.debugLog];
  }

  getSignalingLog(): string[] {
    return [...this.signalingLog];
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
      this.addSignalingLog('🔒 Using TURN relay-only mode');
    }

    console.log('🧊 ICE servers:', iceConfig.iceServers.map(s => ({ urls: s.urls, hasAuth: !!(s as any).username })));
    this.addSignalingLog(`🧊 ICE servers configured (TURN: ${iceConfig.hasTURN ? 'yes' : 'no'})`);

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
      this.addSignalingLog('ontrack', `${event.track.kind} track received`);
      console.log('Track details:', {
        kind: event.track.kind,
        id: event.track.id,
        label: event.track.label,
        enabled: event.track.enabled,
        muted: event.track.muted,
        readyState: event.track.readyState
      });
      
      console.log('Stream details:', {
        id: event.streams[0]?.id,
        active: event.streams[0]?.active,
        trackCount: event.streams[0]?.getTracks().length
      });
      
      event.streams[0]?.getTracks().forEach((track, index) => {
        console.log(`Stream track ${index}:`, {
          kind: track.kind,
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        });
      });

      if (event.streams && event.streams[0] && this.remoteVideoRef) {
        console.log('Setting srcObject on video element');
        
        // Only set srcObject once
        if (!this.remoteVideoRef.srcObject) {
          this.remoteVideoRef.srcObject = event.streams[0];
        }
        
        // Check and unmute video tracks if needed
        const videoTracks = event.streams[0].getVideoTracks();
        videoTracks.forEach(track => {
          if (track.muted) {
            console.warn('⚠️ Video track is muted, attempting to enable');
            track.enabled = true;
          }
        });
        
        const hasLiveVideo = videoTracks.some(track => 
          track.enabled && 
          track.readyState === 'live'
        );
        
        console.log(`Video tracks status: ${videoTracks.length} tracks, live: ${hasLiveVideo}`);
        
        if (hasLiveVideo) {
          // Set a timeout to detect black/stuck video
          this.videoPlaybackTimeout = setTimeout(() => {
            if (this.remoteVideoRef && (this.remoteVideoRef.videoWidth === 0 || this.remoteVideoRef.videoHeight === 0)) {
              console.error('❌ Video timeout: No video dimensions after 5 seconds');
              this.setState('failed');
            }
          }, 5000);
          
          // Try to play the video with proper error handling
          this.remoteVideoRef.play()
            .then(() => {
              console.log('✅ Video autoplay succeeded');
              if (this.videoPlaybackTimeout) {
                clearTimeout(this.videoPlaybackTimeout);
                this.videoPlaybackTimeout = null;
              }
              // Log video dimensions
              setTimeout(() => {
                if (this.remoteVideoRef) {
                  console.log(`📐 Video dimensions: ${this.remoteVideoRef.videoWidth}x${this.remoteVideoRef.videoHeight}`);
                }
              }, 1000);
              this.setState('streaming');
            })
            .catch((error) => {
              console.error('❌ Video play failed:', error);
              if (error.name === 'NotAllowedError') {
                console.warn('⚠️ Autoplay blocked by browser - need user interaction');
                this.setState('awaiting_user_interaction');
              } else {
                console.error('❌ Unknown play error:', error.name, error.message);
                this.setState('failed');
              }
            });
        } else {
          console.warn('⚠️ No live video tracks available yet');
        }
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
    let channelSubscribed = false;
    
    this.channel = supabase
      .channel(`live_stream_${this.streamId}`)
      .on('broadcast', { event: 'broadcaster-ready' }, ({ payload }: any) => {
        if (payload.streamId === this.streamId) {
          broadcasterReady = true;
          this.broadcasterReadyReceived = true;
          this.addSignalingLog('✓ Broadcaster ready signal received');
          
          if (this.broadcasterReadyTimeout) {
            clearTimeout(this.broadcasterReadyTimeout);
            this.broadcasterReadyTimeout = null;
          }
          
          // Only send viewer-joined if channel is subscribed
          if (channelSubscribed && !this.viewerJoinedSent) {
            this.setState('joining');
            this.sendSignal('viewer-joined', {
              sessionToken: this.sessionToken,
              displayName: this.displayName,
              isGuest: this.isGuest
            });
            this.viewerJoinedSent = true;
            this.addSignalingLog(`📤 Sent viewer-joined (${this.displayName})`);
            console.log('📤 Sent viewer-joined signal');
            
            // Set up retry with exponential backoff
            let retryDelay = 2000;
            let retryAttempts = 0;
            const maxRetryAttempts = 5;
            
            const sendRetry = () => {
              if (!this.viewerAcked && retryAttempts < maxRetryAttempts) {
                retryAttempts++;
                console.log(`⚠️ No ack yet, resending viewer-joined (attempt ${retryAttempts})...`);
                this.sendSignal('viewer-joined', {
                  sessionToken: this.sessionToken,
                  displayName: this.displayName,
                  isGuest: this.isGuest
                });
                this.addSignalingLog(`🔄 Resent viewer-joined (attempt ${retryAttempts})`);
                
                // Exponential backoff
                retryDelay = Math.min(retryDelay * 1.5, 10000);
                this.viewerJoinInterval = setTimeout(sendRetry, retryDelay) as any;
              } else if (retryAttempts >= maxRetryAttempts) {
                console.error('❌ Max retry attempts reached for viewer-joined');
                this.setState('failed');
              }
            };
            
            this.viewerJoinInterval = setTimeout(sendRetry, retryDelay) as any;
          }
        }
      })
      .on('broadcast', { event: 'viewer-ack' }, ({ payload }: any) => {
        if (payload.sessionToken === this.sessionToken) {
          console.log('✓ Received viewer acknowledgment from broadcaster');
          this.addSignalingLog('✓ Received viewer-ack');
          this.viewerAcked = true;
          
          // Stop resending viewer-joined
          if (this.viewerJoinInterval) {
            clearTimeout(this.viewerJoinInterval as any);
            this.viewerJoinInterval = null;
          }
        }
      })
      .on('broadcast', { event: 'offer' }, this.handleOffer)
      .on('broadcast', { event: 'ice-candidate' }, this.handleICECandidate)
      .subscribe(async (status: string) => {
        console.log('📡 Channel subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          channelSubscribed = true;
          console.log('✓ Viewer subscribed to channel');
          this.addSignalingLog('✓ Channel subscribed, ready to communicate');
          
          // Now safe to send viewer-joined if broadcaster is already ready
          if (broadcasterReady && !this.viewerJoinedSent) {
            this.setState('joining');
            this.sendSignal('viewer-joined', {
              sessionToken: this.sessionToken,
              displayName: this.displayName,
              isGuest: this.isGuest
            });
            this.viewerJoinedSent = true;
            this.addSignalingLog(`📤 Sent viewer-joined (${this.displayName})`);
            console.log('📤 Sent viewer-joined signal');
          }
          
          // Set up broadcaster ready timeout
          this.broadcasterReadyTimeout = setTimeout(() => {
            if (!broadcasterReady) {
              console.error('❌ Timeout: Broadcaster is not online');
              this.addSignalingLog('❌ Timeout waiting for broadcaster');
              this.setState('timeout');
            }
          }, 10000);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ Channel status: ${status}`);
          this.addSignalingLog(`⚠️ Channel status: ${status}`);
        }
      });
  }

  private handleOffer = async ({ payload }: any) => {
    if (payload.sessionToken !== this.sessionToken) return;

    this.addSignalingLog('📥 Received offer from broadcaster');
    console.log('📥 Received offer from broadcaster');
    
    // Mark as acknowledged - stop resending viewer-joined
    this.viewerAcked = true;
    if (this.viewerJoinInterval) {
      clearTimeout(this.viewerJoinInterval as any);
      this.viewerJoinInterval = null;
    }
    
    if (this.offerTimeout) {
      clearTimeout(this.offerTimeout);
      this.offerTimeout = null;
    }
    
    this.setState('processing_offer');

    try {
      const { offer } = payload;
      await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✓ Set remote description');
      
      // Send confirmation that offer was received
      this.sendSignal('offer-received', { sessionToken: this.sessionToken });
      this.addSignalingLog('📤 Sent offer-received confirmation');
      
      const answer = await this.peerConnection?.createAnswer();
      await this.peerConnection?.setLocalDescription(answer);
      
      this.sendSignal('answer', {
        sessionToken: this.sessionToken,
        answer
      });
      this.addSignalingLog('📤 Sent answer to broadcaster');
      console.log('📤 Sent answer to broadcaster');
      
      this.setState('awaiting_ice');
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
    console.log('🧹 Disconnecting viewer');
    this.addSignalingLog('🧹 Disconnecting viewer');
    
    // Clear all intervals and timeouts
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.broadcasterReadyTimeout) {
      clearTimeout(this.broadcasterReadyTimeout);
      this.broadcasterReadyTimeout = null;
    }
    
    if (this.offerTimeout) {
      clearTimeout(this.offerTimeout);
      this.offerTimeout = null;
    }
    
    if (this.viewerJoinInterval) {
      clearTimeout(this.viewerJoinInterval as any);
      this.viewerJoinInterval = null;
    }
    
    if (this.videoPlaybackTimeout) {
      clearTimeout(this.videoPlaybackTimeout);
      this.videoPlaybackTimeout = null;
    }
    
    // Send viewer-left signal before closing
    this.sendSignal('viewer-left', { sessionToken: this.sessionToken });
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Unsubscribe from channel
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    
    this.setState('disconnected');
  }
}
