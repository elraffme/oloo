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
    await this.createPeerConnection(viewerId);
  }

  private async createPeerConnection(viewerId: string) {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.localStream?.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('ice-candidate', {
          viewerId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection to ${viewerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.removePeerConnection(viewerId);
      }
    };

    this.peerConnections.set(viewerId, pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sendSignal('offer', { viewerId, offer });
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
