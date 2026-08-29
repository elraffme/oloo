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

export interface PeerViewerMedia {
  viewerId: string;
  stream: MediaStream | null;
  displayName: string;
}

export class PeerBroadcastManager {
  private channel: ReturnType<SupabaseClient['channel']> | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private viewerNames = new Map<string, string>();
  private viewerStreams = new Map<string, MediaStream>();

  constructor(
    private readonly streamId: string,
    private readonly localStream: MediaStream,
    private readonly onState?: (state: PeerState, detail?: string) => void,
    private readonly onViewerMedia?: (media: PeerViewerMedia) => void,
  ) {}

  async connect(supabase: SupabaseClient): Promise<void> {
    if (!this.localStream.getVideoTracks().some(track => track.readyState === 'live')) {
      throw new Error('Camera track is not live');
    }

    this.onState?.('connecting');
    this.channel = supabase
      .channel(`live_stream_${this.streamId}`, { config: { broadcast: { ack: true } } })
      .on('broadcast', { event: 'viewer-joined' }, ({ payload }) => {
        const viewerId = String(payload.viewerId);
        this.viewerNames.set(viewerId, String(payload.displayName || 'Viewer'));
        void this.createOffer(viewerId);
      })
      .on('broadcast', { event: 'viewer-media' }, ({ payload }) => {
        const viewerId = String(payload.viewerId);
        // Viewer turned their camera/mic off: drop their tile immediately.
        if (payload.active === false) {
          this.viewerStreams.delete(viewerId);
          this.onViewerMedia?.({ viewerId, stream: null, displayName: this.viewerNames.get(viewerId) || 'Viewer' });
        }
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
    // Pre-negotiated receive slots so the viewer can start/stop publishing their
    // own camera and mic later without any renegotiation round trip.
    peer.addTransceiver('video', { direction: 'recvonly' });
    peer.addTransceiver('audio', { direction: 'recvonly' });
    peer.ontrack = event => {
      const existing = this.viewerStreams.get(viewerId) || new MediaStream();
      if (!existing.getTracks().some(t => t.id === event.track.id)) existing.addTrack(event.track);
      this.viewerStreams.set(viewerId, existing);
      event.track.onended = () => {
        existing.removeTrack(event.track);
        const stillLive = existing.getTracks().length > 0;
        if (!stillLive) this.viewerStreams.delete(viewerId);
        this.onViewerMedia?.({ viewerId, stream: stillLive ? existing : null, displayName: this.viewerNames.get(viewerId) || 'Viewer' });
      };
      this.onViewerMedia?.({ viewerId, stream: existing, displayName: this.viewerNames.get(viewerId) || 'Viewer' });
    };
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
    if (this.viewerStreams.delete(viewerId)) {
      this.onViewerMedia?.({ viewerId, stream: null, displayName: this.viewerNames.get(viewerId) || 'Viewer' });
    }
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
  private sendTransceivers = new Map<'video' | 'audio', RTCRtpTransceiver>();
  private localStream: MediaStream | null = null;

  constructor(
    private readonly streamId: string,
    private readonly onStream: (stream: MediaStream) => void,
    private readonly onState?: (state: PeerState, detail?: string) => void,
    private readonly displayName: string = 'Viewer',
  ) {}

  /**
   * Attach (or detach) the viewer's own camera/mic to the already negotiated
   * send slots offered by the host. Uses replaceTrack so no renegotiation is
   * needed and the host stream is never interrupted.
   */
  async setLocalMedia(stream: MediaStream | null): Promise<void> {
    this.localStream = stream;
    for (const kind of ['video', 'audio'] as const) {
      const transceiver = this.sendTransceivers.get(kind);
      if (!transceiver) continue;
      const track = stream ? (kind === 'video' ? stream.getVideoTracks()[0] : stream.getAudioTracks()[0]) || null : null;
      await transceiver.sender.replaceTrack(track);
    }
    await this.send('viewer-media', { viewerId: this.viewerId, active: !!stream, displayName: this.displayName }).catch(() => undefined);
  }

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
          await this.send('viewer-joined', { viewerId: this.viewerId, displayName: this.displayName });
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

    // The host offers two recvonly slots for us; claim them as sendonly BEFORE
    // answering so the viewer camera can be published later without a new offer.
    // Browsers report every freshly created transceiver as "recvonly", so the
    // slots are identified from the offer SDP m-section order instead.
    const sectionDirections = (offer.sdp || '')
      .split(/^m=/m)
      .slice(1)
      .map(section => /a=(sendrecv|sendonly|recvonly|inactive)/.exec(section)?.[1] || 'sendrecv');
    const transceivers = this.peer.getTransceivers();
    transceivers.forEach((transceiver, index) => {
      const remoteDirection = sectionDirections[index];
      if (remoteDirection !== 'recvonly' && remoteDirection !== 'inactive') return;
      const kind = transceiver.receiver.track?.kind as 'video' | 'audio' | undefined;
      if (!kind || this.sendTransceivers.has(kind)) return;
      transceiver.direction = 'sendonly';
      this.sendTransceivers.set(kind, transceiver);
    });
    if (this.localStream) await this.setLocalMedia(this.localStream);

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
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.sendTransceivers.clear();
    void this.send('viewer-left', { viewerId: this.viewerId }).catch(() => undefined);
    this.peer?.close();
    this.peer = null;
    void this.channel?.unsubscribe();
    this.channel = null;
    this.pendingIce = [];
    this.onState?.('closed');
  }
}