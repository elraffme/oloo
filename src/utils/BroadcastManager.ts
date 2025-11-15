interface ICEServerConfig {
  iceServers: RTCIceServer[];
  hasTURN: boolean;
  warning?: string;
}

export class BroadcastManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private channel: any = null;
  private streamId: string;
  private viewerMetadata: Map<string, { name: string; joinedAt: Date; isGuest: boolean }> = new Map();
  private broadcasterReadyInterval: NodeJS.Timeout | null = null;
  private retryAttempts: Map<string, number> = new Map();
  private iceConfig: ICEServerConfig | null = null;
  private iceConfigExpiry: number = 0;
  private answerReceived: Map<string, boolean> = new Map();
  
  constructor(streamId: string, localStream: MediaStream) {
    this.streamId = streamId;
    this.localStream = localStream;
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
      this.iceConfigExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
      
      if (data.warning) {
        console.warn('⚠️ ICE server warning:', data.warning);
      }
      
      console.log(`✓ Fetched ICE config: ${data.hasTURN ? 'TURN+STUN' : 'STUN only'}`);
      return data;
    } catch (error) {
      console.error('Failed to fetch ICE servers, using STUN fallback:', error);
      
      // Fallback to STUN only
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

  async initializeChannel(supabase: any) {
    // Prefetch ICE servers
    await this.fetchIceServers(supabase);
    
    this.channel = supabase
      .channel(`live_stream_${this.streamId}`)
      .on('broadcast', { event: 'viewer-joined' }, (payload: any) => this.handleViewerJoined(payload, supabase))
      .on('broadcast', { event: 'answer' }, this.handleAnswer)
      .on('broadcast', { event: 'ice-candidate' }, this.handleICECandidate)
      .on('broadcast', { event: 'viewer-left' }, this.handleViewerLeft)
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('✓ Broadcaster channel ready, broadcasting ready signal');
          await new Promise(resolve => setTimeout(resolve, 500));
          this.sendSignal('broadcaster-ready', { streamId: this.streamId });
          
          this.broadcasterReadyInterval = setInterval(() => {
            this.sendSignal('broadcaster-ready', { streamId: this.streamId });
          }, 2000);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ Channel status: ${status}, attempting reconnect...`);
          if (this.broadcasterReadyInterval) {
            clearInterval(this.broadcasterReadyInterval);
            this.broadcasterReadyInterval = null;
          }
        }
      });
  }

  private handleViewerJoined = async ({ payload }: any, supabase: any) => {
    const { sessionToken, displayName, isGuest } = payload;
    console.log(`👤 Viewer joined: ${displayName} (${sessionToken.substring(0, 8)}...)`);
    
    // Store viewer metadata
    this.viewerMetadata.set(sessionToken, {
      name: displayName || 'Anonymous',
      joinedAt: new Date(),
      isGuest: isGuest || false
    });

    // Send acknowledgment to viewer
    this.sendSignal('viewer-ack', { sessionToken });
    console.log(`✓ Sent viewer-ack to ${sessionToken.substring(0, 8)}...`);
    
    await this.createPeerConnection(sessionToken, false, supabase);
  }

  private async createPeerConnection(sessionToken: string, useRelayOnly = false, supabase: any) {
    if (this.peerConnections.has(sessionToken)) {
      console.warn(`Peer connection already exists for ${sessionToken}`);
      return;
    }

    const tracks = this.localStream?.getTracks() || [];
    if (tracks.length === 0) {
      console.error('❌ No media tracks available for broadcasting');
      return;
    }

    const activeTracks = tracks.filter(track => track.readyState === 'live' && track.enabled);
    if (activeTracks.length === 0) {
      console.error('❌ No active media tracks available');
      return;
    }

    console.log(`✓ Verified ${activeTracks.length} active tracks:`, 
      activeTracks.map(t => `${t.kind}:${t.label}:${t.readyState}`));

    // Fetch dynamic ICE servers
    const iceConfig = await this.fetchIceServers(supabase);

    const config: RTCConfiguration = { iceServers: iceConfig.iceServers };
    if (useRelayOnly && iceConfig.hasTURN) {
      config.iceTransportPolicy = 'relay';
      console.log('🔒 Using relay-only mode (TURN-only)');
    }

    console.log('🧊 Broadcaster ICE servers:', iceConfig.iceServers.map(s => ({ urls: s.urls, hasAuth: !!(s as any).username })));

    const pc = new RTCPeerConnection(config);

    // Prefer H.264 codec for Safari compatibility
    const videoTransceiver = pc.addTransceiver('video', { direction: 'sendonly' });
    const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendonly' });
    
    if (RTCRtpSender.getCapabilities) {
      const videoCapabilities = RTCRtpSender.getCapabilities('video');
      if (videoCapabilities?.codecs) {
        const h264Codecs = videoCapabilities.codecs.filter(c => c.mimeType.toLowerCase().includes('h264'));
        if (h264Codecs.length > 0) {
          try {
            videoTransceiver.setCodecPreferences([...h264Codecs, ...videoCapabilities.codecs.filter(c => !c.mimeType.toLowerCase().includes('h264'))]);
            console.log('✓ H.264 codec preference set');
          } catch (e) {
            console.warn('⚠️ Could not set codec preferences:', e);
          }
        }
      }
    }

    activeTracks.forEach(track => {
      console.log(`➕ Adding ${track.kind} track (${track.label}) to peer connection`);
      const sender = track.kind === 'video' ? videoTransceiver.sender : audioTransceiver.sender;
      sender.replaceTrack(track);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 Broadcaster ICE candidate type: ${event.candidate.type} (${event.candidate.protocol})`);
        this.sendSignal('ice-candidate', {
          sessionToken,
          candidate: event.candidate
        });
      } else {
        console.log('✓ ICE gathering complete');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'connected') {
        pc.getStats().then(stats => {
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              console.log(`✓ Active candidate pair: local=${report.localCandidateId}, remote=${report.remoteCandidateId}`);
            }
          });
        });
      } else if (pc.iceConnectionState === 'failed') {
        console.error(`❌ ICE failed for ${sessionToken}`);
        const retries = this.retryAttempts.get(sessionToken) || 0;
        if (retries < 2 && !useRelayOnly && iceConfig.hasTURN) {
          console.log(`🔄 Retrying with relay-only mode (attempt ${retries + 1})`);
          this.retryAttempts.set(sessionToken, retries + 1);
          this.removePeerConnection(sessionToken);
          setTimeout(() => this.createPeerConnection(sessionToken, true, supabase), 1000);
        } else {
          pc.restartIce();
        }
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`🧊 ICE gathering state: ${pc.iceGatheringState}`);
    };

    pc.onconnectionstatechange = () => {
      console.log(`📡 Connection state: ${pc.connectionState}`);
      
      if (pc.connectionState === 'connected') {
        console.log(`✓ Successfully connected to viewer`);
        this.retryAttempts.delete(sessionToken);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.warn(`Connection ${pc.connectionState}, removing`);
        this.removePeerConnection(sessionToken);
      }
    };

    this.peerConnections.set(sessionToken, pc);

    try {
      // Log track count before creating offer
      const transceivers = pc.getTransceivers();
      const attachedTracks = transceivers.filter(t => t.sender.track).length;
      console.log(`📊 Transceivers with attached tracks: ${attachedTracks}/${transceivers.length}`);
      
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);
      
      // Initialize answer received flag
      this.answerReceived.set(sessionToken, false);
      
      console.log(`📤 Sending offer to viewer (session: ${sessionToken.substring(0, 8)}...)`);
      this.sendSignal('offer', { sessionToken, offer });
      
      // Retry sending offer until answer is received
      let retryCount = 0;
      const maxRetries = 5;
      const resendInterval = setInterval(() => {
        if (this.answerReceived.get(sessionToken) || pc.signalingState === 'closed') {
          console.log(`✓ Answer received or connection closed, stopping offer retries`);
          clearInterval(resendInterval);
          return;
        }
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.warn(`⚠️ No answer received yet, resending offer (retry ${retryCount}/${maxRetries})`);
          this.sendSignal('offer', { sessionToken, offer });
        } else {
          console.error(`❌ No answer after ${maxRetries} retries`);
          clearInterval(resendInterval);
          this.removePeerConnection(sessionToken);
        }
      }, 3000);
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      this.removePeerConnection(sessionToken);
    }
  }

  private handleAnswer = async ({ payload }: any) => {
    const { sessionToken, answer } = payload;
    console.log(`✓ Received answer from viewer ${sessionToken.substring(0, 8)}...`);
    
    const pc = this.peerConnections.get(sessionToken);
    if (pc && answer) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      // Mark answer as received to stop offer retries
      this.answerReceived.set(sessionToken, true);
    }
  }

  private handleICECandidate = async ({ payload }: any) => {
    const { sessionToken, candidate } = payload;
    const pc = this.peerConnections.get(sessionToken);
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private handleViewerLeft = ({ payload }: any) => {
    const { sessionToken } = payload;
    console.log(`Viewer left`);
    this.removePeerConnection(sessionToken);
  }

  private sendSignal(event: string, payload: any) {
    this.channel?.send({
      type: 'broadcast',
      event,
      payload
    });
  }

  private removePeerConnection(sessionToken: string) {
    const pc = this.peerConnections.get(sessionToken);
    if (pc) {
      pc.close();
      this.peerConnections.delete(sessionToken);
      this.viewerMetadata.delete(sessionToken);
      this.answerReceived.delete(sessionToken);
    }
  }

  cleanup() {
    // Clear broadcaster ready interval
    if (this.broadcasterReadyInterval) {
      clearInterval(this.broadcasterReadyInterval);
      this.broadcasterReadyInterval = null;
    }
    
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.viewerMetadata.clear();
    this.channel?.unsubscribe();
  }

  getViewerCount(): number {
    return this.peerConnections.size;
  }

  getViewers() {
    return Array.from(this.viewerMetadata.entries()).map(([sessionToken, metadata]) => ({
      sessionToken,
      displayName: metadata.name,
      joinedAt: metadata.joinedAt,
      isGuest: metadata.isGuest
    }));
  }
}
