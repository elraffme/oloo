export class BroadcastManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private channel: any = null;
  private streamId: string;
  private viewerMetadata: Map<string, { name: string; joinedAt: Date; isGuest: boolean }> = new Map();
  private broadcasterReadyInterval: NodeJS.Timeout | null = null;
  private retryAttempts: Map<string, number> = new Map();
  
  constructor(streamId: string, localStream: MediaStream) {
    this.streamId = streamId;
    this.localStream = localStream;
  }

  async initializeChannel(supabase: any) {
    this.channel = supabase
      .channel(`live_stream_${this.streamId}`)
      .on('broadcast', { event: 'viewer-joined' }, this.handleViewerJoined)
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

  private handleViewerJoined = async ({ payload }: any) => {
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
    
    await this.createPeerConnection(sessionToken);
  }

  private async createPeerConnection(sessionToken: string, useRelayOnly = false) {
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
    if (useRelayOnly && turnServers.length > 0) {
      config.iceTransportPolicy = 'relay';
      console.log('🔒 Using relay-only mode (TURN-only)');
    }

    console.log('🧊 Broadcaster ICE servers:', iceServers.map(s => ({ urls: s.urls, hasAuth: !!(s as any).username })));

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
        if (retries < 2 && !useRelayOnly && turnServers.length > 0) {
          console.log(`🔄 Retrying with relay-only mode (attempt ${retries + 1})`);
          this.retryAttempts.set(sessionToken, retries + 1);
          this.removePeerConnection(sessionToken);
          setTimeout(() => this.createPeerConnection(sessionToken, true), 1000);
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
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);
      
      console.log(`📤 Sending offer to viewer (session: ${sessionToken.substring(0, 8)}...)`);
      this.sendSignal('offer', { sessionToken, offer });
      
      // Set timeout for answer with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      const checkAnswer = () => {
        setTimeout(() => {
          const state = pc.connectionState;
          if (state === 'connected') {
            console.log(`✓ Connection established successfully`);
            return;
          }
          
          if (state === 'new' && retryCount < maxRetries) {
            retryCount++;
            console.warn(`⚠️ No answer received, resending offer (retry ${retryCount}/${maxRetries})`);
            this.sendSignal('offer', { sessionToken, offer });
            checkAnswer();
          } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
            console.error(`❌ Connection ${state} after ${retryCount} retries`);
            this.removePeerConnection(sessionToken);
          }
        }, 5000);
      };
      checkAnswer();
    } catch (error) {
      console.error('❌ Error creating offer:', error);
      this.removePeerConnection(sessionToken);
    }
  }

  private handleAnswer = async ({ payload }: any) => {
    const { sessionToken, answer } = payload;
    const pc = this.peerConnections.get(sessionToken);
    if (pc && answer) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
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
