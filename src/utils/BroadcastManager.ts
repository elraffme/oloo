export class BroadcastManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private channel: any = null;
  private streamId: string;
  private viewerMetadata: Map<string, { name: string; joinedAt: Date; isGuest: boolean }> = new Map();
  
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
      .subscribe();
  }

  private handleViewerJoined = async ({ payload }: any) => {
    const { sessionToken, displayName, isGuest } = payload;
    console.log(`Viewer joined: ${displayName} (${isGuest ? 'guest' : 'authenticated'})`);
    
    // Store viewer metadata
    this.viewerMetadata.set(sessionToken, {
      name: displayName || 'Anonymous',
      joinedAt: new Date(),
      isGuest: isGuest || false
    });
    
    await this.createPeerConnection(sessionToken);
  }

  private async createPeerConnection(sessionToken: string) {
    // Check if already exists
    if (this.peerConnections.has(sessionToken)) {
      console.warn(`Peer connection already exists for ${sessionToken}`);
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' }
      ]
    });

    // Verify we have tracks before adding
    const tracks = this.localStream?.getTracks() || [];
    if (tracks.length === 0) {
      console.error('No media tracks available for broadcasting');
      return;
    }

    tracks.forEach(track => {
      console.log(`Adding ${track.kind} track to peer connection`);
      pc.addTrack(track, this.localStream!);
    });

    // Enhanced ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('ice-candidate', {
          sessionToken,
          candidate: event.candidate
        });
      }
    };

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        console.error(`ICE failed, attempting restart`);
        pc.restartIce();
      }
    };

    // Monitor ICE gathering state
    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state: ${pc.iceGatheringState}`);
    };

    // Monitor overall connection state
    pc.onconnectionstatechange = () => {
      console.log(`Connection state: ${pc.connectionState}`);
      
      if (pc.connectionState === 'connected') {
        console.log(`✓ Successfully connected to viewer`);
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
      
      console.log(`Sending offer to viewer`);
      this.sendSignal('offer', { sessionToken, offer });
      
      // Set timeout for connection establishment
      setTimeout(() => {
        if (pc.connectionState !== 'connected' && pc.connectionState !== 'connecting') {
          console.error(`Connection timeout`);
          this.removePeerConnection(sessionToken);
        }
      }, 15000); // 15 second timeout
      
    } catch (error) {
      console.error(`Error creating offer:`, error);
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
