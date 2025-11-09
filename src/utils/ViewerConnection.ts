export class ViewerConnection {
  private peerConnection: RTCPeerConnection | null = null;
  private channel: any = null;
  private streamId: string;
  private viewerId: string;
  private remoteVideoRef: HTMLVideoElement | null = null;

  constructor(streamId: string, viewerId: string, videoElement: HTMLVideoElement) {
    this.streamId = streamId;
    this.viewerId = viewerId;
    this.remoteVideoRef = videoElement;
  }

  async connect(supabase: any) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.peerConnection.ontrack = (event) => {
      if (this.remoteVideoRef && event.streams[0]) {
        this.remoteVideoRef.srcObject = event.streams[0];
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('ice-candidate', {
          viewerId: this.viewerId,
          candidate: event.candidate
        });
      }
    };

    this.channel = supabase
      .channel(`live_stream_${this.streamId}`)
      .on('broadcast', { event: 'offer' }, this.handleOffer)
      .on('broadcast', { event: 'ice-candidate' }, this.handleICECandidate)
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          this.sendSignal('viewer-joined', { viewerId: this.viewerId });
        }
      });
  }

  private handleOffer = async ({ payload }: any) => {
    if (payload.viewerId !== this.viewerId) return;

    const { offer } = payload;
    await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await this.peerConnection?.createAnswer();
    await this.peerConnection?.setLocalDescription(answer);
    
    this.sendSignal('answer', {
      viewerId: this.viewerId,
      answer
    });
  }

  private handleICECandidate = async ({ payload }: any) => {
    if (payload.viewerId !== this.viewerId) return;

    const { candidate } = payload;
    if (this.peerConnection && candidate) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private sendSignal(event: string, payload: any) {
    this.channel?.send({
      type: 'broadcast',
      event,
      payload
    });
  }

  disconnect() {
    this.sendSignal('viewer-left', { viewerId: this.viewerId });
    this.peerConnection?.close();
    this.channel?.unsubscribe();
  }
}
