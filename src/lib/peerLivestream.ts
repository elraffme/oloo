import { SupabaseClient } from '@supabase/supabase-js';

type PeerState = 'connecting' | 'connected' | 'failed' | 'closed';

const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

export class PeerBroadcastManager {
  private channel: ReturnType<SupabaseClient['channel']> | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();

  constructor(
    private readonly streamId: string,
    private readonly localStream: MediaStream,
    private readonly onState?: (state: PeerState, detail?: string) => void,
  ) {}

  async connect(supabase: SupabaseClient): Promise<void> {
    if (!this.localStream.getVideoTracks().some(track => track.readyState === 'live')) {
      throw new Error('Camera track is not live');
    }

    this.onState?.('connecting');
    this.channel = supabase
      .channel(`live_stream_${this.streamId}`, { config: { broadcast: { ack: true } } })
      .on('broadcast', { event: 'viewer-joined' }, ({ payload }) => {
        void this.createOffer(String(payload.viewerId));
      })
      .on('broadcast', { event: 'answer' }, ({ payload }) => {
        void this.acceptAnswer(String(payload.viewerId), payload.answer);
      })
      .on('broadcast', { event: 'viewer-ice' }, ({ payload }) => {
        void this.acceptIce(String(payload.viewerId), payload.candidate);
      })
      .on('broadcast', { event: 'viewer-left' }, ({ payload }) => {
        this.closePeer(String(payload.viewerId));
      });

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Peer signaling channel timed out')), 10000);
      this.channel?.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timeout);
          this.onState?.('connected', 'signaling-ready');
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(timeout);
          reject(new Error(`Peer signaling failed: ${status}`));
        }
      });
    });
  }

  private async createOffer(viewerId: string) {
    this.closePeer(viewerId);
    const peer = new RTCPeerConnection(rtcConfiguration);
    this.peers.set(viewerId, peer);
    this.localStream.getTracks().forEach(track => peer.addTrack(track, this.localStream));
    peer.onicecandidate = event => {
      if (event.candidate) void this.send('host-ice', { viewerId, candidate: event.candidate.toJSON() });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') this.onState?.('connected', `viewer:${viewerId}`);
      if (peer.connectionState === 'failed') this.onState?.('failed', `viewer:${viewerId}`);
      if (peer.connectionState === 'closed') this.closePeer(viewerId);
    };
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await this.send('offer', { viewerId, offer: peer.localDescription?.toJSON() });
  }

  private async acceptAnswer(viewerId: string, answer: RTCSessionDescriptionInit) {
    const peer = this.peers.get(viewerId);
    if (!peer || peer.signalingState === 'closed') return;
    await peer.setRemoteDescription(answer);
    const queued = this.pendingIce.get(viewerId) || [];
    for (const candidate of queued) await peer.addIceCandidate(candidate);
    this.pendingIce.delete(viewerId);
  }

  private async acceptIce(viewerId: string, candidate: RTCIceCandidateInit) {
    const peer = this.peers.get(viewerId);
    if (!peer || !peer.remoteDescription) {
      this.pendingIce.set(viewerId, [...(this.pendingIce.get(viewerId) || []), candidate]);
      return;
    }
    await peer.addIceCandidate(candidate);
  }

  private async send(event: string, payload: Record<string, unknown>) {
    const response = await this.channel?.send({ type: 'broadcast', event, payload });
    if (response !== 'ok') throw new Error(`Peer signaling send failed: ${event}`);
  }

  private closePeer(viewerId: string) {
    this.peers.get(viewerId)?.close();
    this.peers.delete(viewerId);
    this.pendingIce.delete(viewerId);
  }

  disconnect() {
    this.peers.forEach(peer => peer.close());
    this.peers.clear();
    this.pendingIce.clear();
    void this.channel?.unsubscribe();
    this.channel = null;
    this.onState?.('closed');
  }
}

export class PeerViewerConnection {
  private channel: ReturnType<SupabaseClient['channel']> | null = null;
  private peer: RTCPeerConnection | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private readonly viewerId = crypto.randomUUID();

  constructor(
    private readonly streamId: string,
    private readonly onStream: (stream: MediaStream) => void,
    private readonly onState?: (state: PeerState, detail?: string) => void,
  ) {}

  async connect(supabase: SupabaseClient): Promise<void> {
    this.onState?.('connecting');
    this.peer = new RTCPeerConnection(rtcConfiguration);
    this.peer.ontrack = event => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      this.onStream(stream);
    };
    this.peer.onicecandidate = event => {
      if (event.candidate) void this.send('viewer-ice', { viewerId: this.viewerId, candidate: event.candidate.toJSON() });
    };
    this.peer.onconnectionstatechange = () => {
      const state = this.peer?.connectionState;
      if (state === 'connected') this.onState?.('connected');
      if (state === 'failed' || state === 'disconnected') this.onState?.('failed', state);
    };

    // Realtime allows several channel objects on the same broadcast topic, but
    // the client de-duplicates identical topic names. Remove any stale viewer
    // instance left by a prior join before subscribing this connection.
    const topic = `realtime:live_stream_${this.streamId}`;
    for (const existingChannel of supabase.getChannels()) {
      if (existingChannel.topic === topic && existingChannel !== this.channel) {
        await supabase.removeChannel(existingChannel);
      }
    }
    this.channel = supabase
      .channel(`live_stream_${this.streamId}`, { config: { broadcast: { ack: true } } })
      .on('broadcast', { event: 'offer' }, ({ payload }) => {
        if (payload.viewerId === this.viewerId) void this.acceptOffer(payload.offer);
      })
      .on('broadcast', { event: 'host-ice' }, ({ payload }) => {
        if (payload.viewerId === this.viewerId) void this.acceptIce(payload.candidate);
      });

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Peer signaling channel timed out')), 10000);
      this.channel?.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timeout);
          await this.send('viewer-joined', { viewerId: this.viewerId });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(timeout);
          reject(new Error(`Peer signaling failed: ${status}`));
        }
      });
    });
  }

  private async acceptOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peer) return;
    await this.peer.setRemoteDescription(offer);
    for (const candidate of this.pendingIce) await this.peer.addIceCandidate(candidate);
    this.pendingIce = [];
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    await this.send('answer', { viewerId: this.viewerId, answer: this.peer.localDescription?.toJSON() });
  }

  private async acceptIce(candidate: RTCIceCandidateInit) {
    if (!this.peer?.remoteDescription) {
      this.pendingIce.push(candidate);
      return;
    }
    await this.peer.addIceCandidate(candidate);
  }

  private async send(event: string, payload: Record<string, unknown>) {
    const response = await this.channel?.send({ type: 'broadcast', event, payload });
    if (response !== 'ok') throw new Error(`Peer signaling send failed: ${event}`);
  }

  disconnect() {
    void this.send('viewer-left', { viewerId: this.viewerId }).catch(() => undefined);
    this.peer?.close();
    this.peer = null;
    void this.channel?.unsubscribe();
    this.channel = null;
    this.pendingIce = [];
    this.onState?.('closed');
  }
}