export class BroadcastManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private channel: any = null;
  private streamId: string;
  
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
    const { viewerId } = payload;
    console.log(`Viewer joined: ${viewerId}`);
    await this.createPeerConnection(viewerId);
  }

  private async createPeerConnection(viewerId: string) {
    // Check if already exists
    if (this.peerConnections.has(viewerId)) {
      console.warn(`Peer connection already exists for ${viewerId}`);
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
      console.log(`Adding ${track.kind} track to peer connection for ${viewerId}`);
      pc.addTrack(track, this.localStream!);
    });

    // Enhanced ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('ice-candidate', {
          viewerId,
          candidate: event.candidate
        });
      }
    };

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${viewerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        console.error(`ICE failed for ${viewerId}, attempting restart`);
        pc.restartIce();
      }
    };

    // Monitor ICE gathering state
    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state for ${viewerId}: ${pc.iceGatheringState}`);
    };

    // Monitor overall connection state
    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${viewerId}: ${pc.connectionState}`);
      
      if (pc.connectionState === 'connected') {
        console.log(`✓ Successfully connected to viewer ${viewerId}`);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.warn(`Connection ${pc.connectionState} for ${viewerId}, removing`);
        this.removePeerConnection(viewerId);
      }
    };

    this.peerConnections.set(viewerId, pc);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);
      
      console.log(`Sending offer to ${viewerId}`);
      this.sendSignal('offer', { viewerId, offer });
      
      // Set timeout for connection establishment
      setTimeout(() => {
        if (pc.connectionState !== 'connected' && pc.connectionState !== 'connecting') {
          console.error(`Connection timeout for ${viewerId}`);
          this.removePeerConnection(viewerId);
        }
      }, 15000); // 15 second timeout
      
    } catch (error) {
      console.error(`Error creating offer for ${viewerId}:`, error);
      this.removePeerConnection(viewerId);
    }
  }

  private handleAnswer = async ({ payload }: any) => {
    const { viewerId, answer } = payload;
    const pc = this.peerConnections.get(viewerId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  private handleICECandidate = async ({ payload }: any) => {
    const { viewerId, candidate } = payload;
    const pc = this.peerConnections.get(viewerId);
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private handleViewerLeft = ({ payload }: any) => {
    const { viewerId } = payload;
    this.removePeerConnection(viewerId);
  }

  private sendSignal(event: string, payload: any) {
    this.channel?.send({
      type: 'broadcast',
      event,
      payload
    });
  }

  private removePeerConnection(viewerId: string) {
    const pc = this.peerConnections.get(viewerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(viewerId);
    }
  }

  cleanup() {
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.channel?.unsubscribe();
  }

  getViewerCount(): number {
    return this.peerConnections.size;
  }
}
