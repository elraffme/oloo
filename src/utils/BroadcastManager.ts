interface ICEServerConfig {
  iceServers: RTCIceServer[];
  hasTURN: boolean;
  warning?: string;
}

export class BroadcastManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private channel: any = null;
  private dbSignalingChannel: any = null;
  private streamId: string;
  private viewerMetadata: Map<string, { name: string; joinedAt: Date; isGuest: boolean }> = new Map();
  private broadcasterReadyInterval: NodeJS.Timeout | null = null;
  private retryAttempts: Map<string, number> = new Map();
  private iceConfig: ICEServerConfig | null = null;
  private iceConfigExpiry: number = 0;
  private answerReceived: Map<string, boolean> = new Map();
  private offerAcked: Map<string, boolean> = new Map();
  private offerRetryTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastSignalingEvents: Array<{time: string, event: string}> = [];
  
  constructor(streamId: string, localStream: MediaStream) {
    this.streamId = streamId;
    this.localStream = localStream;
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

  private logSignalingEvent(event: string) {
    const time = new Date().toISOString().split('T')[1].slice(0, 12);
    this.lastSignalingEvents.push({ time, event });
    if (this.lastSignalingEvents.length > 20) {
      this.lastSignalingEvents.shift();
    }
  }

  getLastSignalingEvents() {
    return [...this.lastSignalingEvents];
  }

  async initializeChannel(supabase: any) {
    await this.fetchIceServers(supabase);
    
    this.channel = supabase
      .channel(`live_stream_${this.streamId}`, {
        config: {
          broadcast: { ack: true },
          presence: { key: `broadcaster:${this.streamId}` }
        }
      })
      .on('broadcast', { event: 'viewer-joined' }, (payload: any) => this.handleViewerJoined(payload, supabase))
      .on('broadcast', { event: 'offer-received' }, this.handleOfferReceived)
      .on('broadcast', { event: 'request-offer' }, (payload: any) => this.handleRequestOffer(payload, supabase))
      .on('broadcast', { event: 'answer' }, this.handleAnswer)
      .on('broadcast', { event: 'ice-candidate' }, this.handleICECandidate)
      .on('broadcast', { event: 'viewer-left' }, this.handleViewerLeft)
      .subscribe(async (status: string) => {
        this.logSignalingEvent(`Channel: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log('✓ Broadcaster channel ready, broadcasting ready signal');
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const result = await this.sendSignal('broadcaster-ready', { streamId: this.streamId });
          if (result !== 'ok') {
            console.warn('⚠️ broadcaster-ready send failed');
          }
          
          this.broadcasterReadyInterval = setInterval(async () => {
            await this.sendSignal('broadcaster-ready', { streamId: this.streamId });
          }, 2000);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ Channel status: ${status}, attempting reconnect...`);
          if (this.broadcasterReadyInterval) {
            clearInterval(this.broadcasterReadyInterval);
            this.broadcasterReadyInterval = null;
          }
        }
      });

    this.setupDbSignalingFallback(supabase);
  }

  private setupDbSignalingFallback(supabase: any) {
    this.dbSignalingChannel = supabase
      .channel('db-signaling-broadcaster')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `stream_id=eq.${this.streamId}`
        },
        async (payload: any) => {
          const signal = payload.new;
          
          if (signal.type === 'viewer_joined' && signal.role === 'viewer') {
            console.log('📨 DB fallback: viewer joined', signal.session_token);
            await this.handleViewerJoined({ payload: signal.payload }, supabase);
          } else if (signal.type === 'request_offer' && signal.role === 'viewer') {
            console.log('📨 DB fallback: offer requested', signal.session_token);
            await this.handleRequestOffer({ payload: signal.payload }, supabase);
          } else if (signal.type === 'answer' && signal.role === 'viewer') {
            console.log('📨 DB fallback: answer received', signal.session_token);
            await this.handleAnswer({ payload: signal.payload });
          } else if (signal.type === 'ice' && signal.role === 'viewer') {
            await this.handleICECandidate({ payload: signal.payload });
          }
        }
      )
      .subscribe();
  }

  private async sendSignalViaDb(supabase: any, sessionToken: string, type: string, payload: any) {
    try {
      await supabase.from('webrtc_signals').insert({
        stream_id: this.streamId,
        session_token: sessionToken,
        role: 'broadcaster',
        type,
        payload
      });
      console.log(`✓ Sent ${type} via DB to ${sessionToken.substring(0, 8)}`);
    } catch (err) {
      console.error('DB signal send failed:', err);
    }
  }

  private handleViewerJoined = async ({ payload }: any, supabase: any) => {
    const { sessionToken, displayName, isGuest } = payload;
    console.log(`👤 Viewer joined: ${displayName} (${sessionToken.substring(0, 8)}...)`);
    this.logSignalingEvent(`Viewer joined: ${displayName}`);
    
    this.viewerMetadata.set(sessionToken, {
      name: displayName || 'Anonymous',
      joinedAt: new Date(),
      isGuest: isGuest || false
    });

    const ackResult = await this.sendSignal('viewer-ack', { sessionToken });
    if (ackResult !== 'ok') {
      console.warn('⚠️ viewer-ack send failed, using DB');
      await this.sendSignalViaDb(supabase, sessionToken, 'viewer_ack', { sessionToken });
    }
    console.log(`✓ Sent viewer-ack to ${sessionToken.substring(0, 8)}...`);
    
    const existingPeer = this.peerConnections.get(sessionToken);
    if (existingPeer && existingPeer.connectionState !== 'failed' && existingPeer.connectionState !== 'closed') {
      console.log(`⚠️ Peer already exists for ${sessionToken.substring(0, 8)}... (${existingPeer.connectionState})`);
      return;
    }
    
    this.retryAttempts.set(sessionToken, 0);
    await this.createPeerConnection(sessionToken, false, supabase);
  };

  private handleOfferReceived = ({ payload }: any) => {
    const { sessionToken } = payload;
    console.log(`✓ Offer received ACK from ${sessionToken?.substring(0, 8)}...`);
    this.logSignalingEvent(`Offer ACK: ${sessionToken?.substring(0, 8)}`);
    
    this.offerAcked.set(sessionToken, true);
    
    const timer = this.offerRetryTimers.get(sessionToken);
    if (timer) {
      clearTimeout(timer);
      this.offerRetryTimers.delete(sessionToken);
    }
  };

  private handleRequestOffer = async ({ payload }: any, supabase: any) => {
    const { sessionToken } = payload;
    console.log(`🔔 Viewer ${sessionToken?.substring(0, 8)}... requesting offer`);
    this.logSignalingEvent(`Offer requested: ${sessionToken?.substring(0, 8)}`);
    
    const pc = this.peerConnections.get(sessionToken);
    if (pc) {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: true
      });
      await pc.setLocalDescription(offer);

      console.log(`📤 Re-sending offer to ${sessionToken.substring(0, 8)}...`);
      const result = await this.sendSignal('offer', { offer, sessionToken });
      
      if (result !== 'ok') {
        console.warn('⚠️ Offer resend failed, using DB');
        await this.sendSignalViaDb(supabase, sessionToken, 'offer', { offer, sessionToken });
      }
    } else {
      console.log(`📤 Creating new connection for ${sessionToken.substring(0, 8)}...`);
      await this.createPeerConnection(sessionToken, false, supabase);
    }
  };

  private async createPeerConnection(sessionToken: string, useRelayOnly: boolean, supabase: any) {
    try {
      const iceConfig = await this.fetchIceServers(supabase);
      
      const pcConfig: RTCConfiguration = {
        iceServers: useRelayOnly && iceConfig.hasTURN
          ? iceConfig.iceServers.filter(server => 
              server.urls?.toString().includes('turn')
            )
          : iceConfig.iceServers,
        iceTransportPolicy: useRelayOnly ? 'relay' : 'all',
        iceCandidatePoolSize: 10
      };

      const pc = new RTCPeerConnection(pcConfig);
      
      pc.onconnectionstatechange = () => {
        console.log(`🔗 Peer ${sessionToken.substring(0, 8)}... connection: ${pc.connectionState}`);
        
        if (pc.connectionState === 'failed') {
          console.warn(`❌ Connection failed for ${sessionToken.substring(0, 8)}...`);
          
          const attempts = this.retryAttempts.get(sessionToken) || 0;
          if (attempts < 2 && !useRelayOnly && iceConfig.hasTURN) {
            console.log(`🔄 Retrying with TURN for ${sessionToken.substring(0, 8)}...`);
            this.retryAttempts.set(sessionToken, attempts + 1);
            this.removePeerConnection(sessionToken);
            setTimeout(() => {
              this.createPeerConnection(sessionToken, true, supabase);
            }, 1000);
          } else {
            this.removePeerConnection(sessionToken);
          }
        } else if (pc.connectionState === 'connected') {
          console.log(`✅ Connected to ${sessionToken.substring(0, 8)}...`);
          this.retryAttempts.delete(sessionToken);
        }
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log(`🧊 Sending ICE to ${sessionToken.substring(0, 8)}...`);
          
          const result = await this.sendSignal('ice-candidate', {
            candidate: event.candidate,
            sessionToken
          });

          if (result !== 'ok') {
            console.warn('⚠️ ICE send failed, using DB');
            await this.sendSignalViaDb(supabase, sessionToken, 'ice', {
              candidate: event.candidate,
              sessionToken
            });
          }
        }
      };

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (this.localStream) {
            pc.addTrack(track, this.localStream);
          }
        });
      }

      this.peerConnections.set(sessionToken, pc);
      this.answerReceived.set(sessionToken, false);
      this.offerAcked.set(sessionToken, false);

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      
      await pc.setLocalDescription(offer);

      console.log(`📤 Sending offer to ${sessionToken.substring(0, 8)}...${useRelayOnly ? ' (TURN only)' : ''}`);
      
      const result = await this.sendSignal('offer', { offer, sessionToken });
      
      if (result !== 'ok') {
        console.warn('⚠️ Initial offer send failed, using DB');
        await this.sendSignalViaDb(supabase, sessionToken, 'offer', { offer, sessionToken });
      }

      let retryCount = 0;
      const maxRetries = 5;
      
      const retryTimer = setInterval(async () => {
        const acked = this.offerAcked.get(sessionToken);
        const answered = this.answerReceived.get(sessionToken);
        
        if (acked || answered) {
          console.log(`✓ Offer delivered to ${sessionToken.substring(0, 8)}... (${acked ? 'acked' : 'answered'})`);
          clearInterval(retryTimer);
          this.offerRetryTimers.delete(sessionToken);
          return;
        }

        retryCount++;
        if (retryCount >= maxRetries) {
          console.warn(`⚠️ Max offer retries for ${sessionToken.substring(0, 8)}...`);
          clearInterval(retryTimer);
          this.offerRetryTimers.delete(sessionToken);
          
          await this.sendSignal('request-offer-ready', { sessionToken });
          return;
        }

        console.log(`🔁 Resending offer to ${sessionToken.substring(0, 8)}... (attempt ${retryCount}/${maxRetries})`);
        const retryResult = await this.sendSignal('offer', { offer, sessionToken });
        
        if (retryResult !== 'ok' && retryCount > 2) {
          await this.sendSignalViaDb(supabase, sessionToken, 'offer', { offer, sessionToken });
        }
      }, 2000);

      this.offerRetryTimers.set(sessionToken, retryTimer);

    } catch (error) {
      console.error(`Error creating peer connection for ${sessionToken.substring(0, 8)}:`, error);
      this.removePeerConnection(sessionToken);
    }
  }

  private handleAnswer = async ({ payload }: any) => {
    const { answer, sessionToken } = payload;
    const pc = this.peerConnections.get(sessionToken);

    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`✅ Answer set for ${sessionToken.substring(0, 8)}...`);
        this.logSignalingEvent(`Answer set: ${sessionToken.substring(0, 8)}`);
        
        this.answerReceived.set(sessionToken, true);
        
        const timer = this.offerRetryTimers.get(sessionToken);
        if (timer) {
          clearTimeout(timer);
          this.offerRetryTimers.delete(sessionToken);
        }
      } catch (error) {
        console.error(`Error setting answer for ${sessionToken.substring(0, 8)}:`, error);
      }
    }
  };

  private handleICECandidate = async ({ payload }: any) => {
    const { candidate, sessionToken } = payload;
    const pc = this.peerConnections.get(sessionToken);

    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`🧊 ICE added for ${sessionToken.substring(0, 8)}...`);
      } catch (error) {
        console.error(`Error adding ICE for ${sessionToken.substring(0, 8)}:`, error);
      }
    }
  };

  private handleViewerLeft = ({ payload }: any) => {
    const { sessionToken } = payload;
    console.log(`👋 Viewer left: ${sessionToken?.substring(0, 8)}...`);
    this.logSignalingEvent(`Viewer left: ${sessionToken?.substring(0, 8)}`);
    this.removePeerConnection(sessionToken);
    this.viewerMetadata.delete(sessionToken);
  };

  private async sendSignal(event: string, payload: any): Promise<string> {
    if (!this.channel) return 'error';
    
    try {
      const result = await this.channel.send({
        type: 'broadcast',
        event,
        payload
      });
      
      this.logSignalingEvent(`Sent: ${event}`);
      return result;
    } catch (err) {
      console.error(`Failed to send ${event}:`, err);
      return 'error';
    }
  }

  private removePeerConnection(sessionToken: string) {
    const pc = this.peerConnections.get(sessionToken);
    if (pc) {
      pc.close();
      this.peerConnections.delete(sessionToken);
    }
    
    const timer = this.offerRetryTimers.get(sessionToken);
    if (timer) {
      clearTimeout(timer);
      this.offerRetryTimers.delete(sessionToken);
    }
    
    this.retryAttempts.delete(sessionToken);
    this.answerReceived.delete(sessionToken);
    this.offerAcked.delete(sessionToken);
  }

  cleanup() {
    console.log('🧹 Cleaning up broadcast manager');
    
    if (this.broadcasterReadyInterval) {
      clearInterval(this.broadcasterReadyInterval);
      this.broadcasterReadyInterval = null;
    }

    this.offerRetryTimers.forEach(timer => clearTimeout(timer));
    this.offerRetryTimers.clear();

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    if (this.dbSignalingChannel) {
      this.dbSignalingChannel.unsubscribe();
      this.dbSignalingChannel = null;
    }

    this.viewerMetadata.clear();
    this.retryAttempts.clear();
    this.answerReceived.clear();
    this.offerAcked.clear();
  }

  getViewerCount(): number {
    return Array.from(this.peerConnections.values()).filter(
      pc => pc.connectionState === 'connected'
    ).length;
  }

  getViewers(): Array<{ sessionToken: string; name: string; joinedAt: Date; connectionState: string; isGuest: boolean }> {
    return Array.from(this.peerConnections.entries()).map(([sessionToken, pc]) => ({
      sessionToken,
      name: this.viewerMetadata.get(sessionToken)?.name || 'Unknown',
      joinedAt: this.viewerMetadata.get(sessionToken)?.joinedAt || new Date(),
      connectionState: pc.connectionState,
      isGuest: this.viewerMetadata.get(sessionToken)?.isGuest || false
    }));
  }

  hasTURN(): boolean {
    return this.iceConfig?.hasTURN || false;
  }

  isChannelSubscribed(): boolean {
    return this.channel?.state === 'joined';
  }
}
