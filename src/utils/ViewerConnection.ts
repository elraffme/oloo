export class ViewerConnection {
  private peerConnection: RTCPeerConnection | null = null;
  private channel: any = null;
  private streamId: string;
  private sessionToken: string;
  private remoteVideoRef: HTMLVideoElement | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(streamId: string, sessionToken: string, videoElement: HTMLVideoElement) {
    this.streamId = streamId;
    this.sessionToken = sessionToken;
    this.remoteVideoRef = videoElement;
  }

  async connect(supabase: any) {
    try {
      await this.establishConnection(supabase);
      this.startHeartbeat(supabase);
    } catch (error) {
      console.error('Connection failed:', error);
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying connection (${this.retryCount}/${this.maxRetries})`);
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
        console.error('Heartbeat failed:', error);
      }
    }, 30000);
  }

  private async establishConnection(supabase: any) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' }
      ]
    });

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      console.log(`Viewer connection state: ${this.peerConnection?.connectionState}`);
      if (this.peerConnection?.connectionState === 'connected') {
        console.log('✓ Successfully connected to broadcaster');
        this.retryCount = 0; // Reset retry count on success
      }
    };

    // Monitor ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(`Viewer ICE state: ${this.peerConnection?.iceConnectionState}`);
      if (this.peerConnection?.iceConnectionState === 'failed' && this.retryCount < this.maxRetries) {
        console.warn('ICE connection failed, attempting restart');
        this.retryCount++;
        this.peerConnection?.restartIce();
      }
    };

    // Monitor ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log(`Viewer ICE gathering state: ${this.peerConnection?.iceGatheringState}`);
    };

    this.peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (this.remoteVideoRef && event.streams[0]) {
        this.remoteVideoRef.srcObject = event.streams[0];
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('ice-candidate', {
          sessionToken: this.sessionToken,
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
          console.log('Viewer subscribed to channel, sending join signal');
          this.sendSignal('viewer-joined', { sessionToken: this.sessionToken });
        }
      });
  }

  private handleOffer = async ({ payload }: any) => {
    if (payload.sessionToken !== this.sessionToken) return;

    const { offer } = payload;
    await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await this.peerConnection?.createAnswer();
    await this.peerConnection?.setLocalDescription(answer);
    
    this.sendSignal('answer', {
      sessionToken: this.sessionToken,
      answer
    });
  }

  private handleICECandidate = async ({ payload }: any) => {
    if (payload.sessionToken !== this.sessionToken) return;

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
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.sendSignal('viewer-left', { sessionToken: this.sessionToken });
    this.peerConnection?.close();
    this.channel?.unsubscribe();
  }
}
