import { supabase } from '@/integrations/supabase/client';

interface RelayConnection {
  sessionToken: string;
  peerConnection: RTCPeerConnection;
  displayName: string;
}

interface ViewerCameraInfo {
  sessionToken: string;
  stream: MediaStream;
  displayName: string;
  avatarUrl?: string;
}

export class ViewerStreamRelay {
  private streamId: string;
  private relayConnections: Map<string, RelayConnection> = new Map();
  private channel: any = null;
  private cleanupFunctions: (() => void)[] = [];
  private viewerStreams: Map<string, MediaStream> = new Map();
  private allViewerTokens: Set<string> = new Set();
  private viewerDisplayNames: Map<string, string> = new Map();

  constructor(streamId: string) {
    this.streamId = streamId;
  }

  async initialize() {
    console.log('🔄 ViewerStreamRelay: Initializing for stream', this.streamId);
    await this.setupSignaling();
  }

  private async setupSignaling() {
    this.channel = supabase.channel(`viewer_relay_${this.streamId}`)
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.targetToken) {
          await this.handleAnswer(payload);
        }
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload.targetToken) {
          await this.handleICE(payload);
        }
      })
      .subscribe((status) => {
        console.log('🔄 Viewer relay channel status:', status);
      });

    this.cleanupFunctions.push(() => {
      supabase.removeChannel(this.channel);
    });
  }

  async onNewViewerCamera(viewerInfo: ViewerCameraInfo) {
    console.log('🔄 New viewer camera to relay:', viewerInfo.sessionToken);
    
    // Store this viewer's stream and display name
    this.viewerStreams.set(viewerInfo.sessionToken, viewerInfo.stream);
    this.viewerDisplayNames.set(viewerInfo.sessionToken, viewerInfo.displayName);
    this.allViewerTokens.add(viewerInfo.sessionToken);

    // Forward this stream to all OTHER viewers (not to the viewer themselves)
    const otherViewers = Array.from(this.allViewerTokens).filter(
      token => token !== viewerInfo.sessionToken
    );

    console.log(`🔄 Forwarding ${viewerInfo.displayName}'s stream to ${otherViewers.length} other viewers`);

    for (const targetToken of otherViewers) {
      await this.createRelayConnection(viewerInfo, targetToken);
    }
  }

  async onViewerLeft(sessionToken: string) {
    console.log('🔄 Viewer left, cleaning up relays:', sessionToken);
    
    this.viewerStreams.delete(sessionToken);
    this.viewerDisplayNames.delete(sessionToken);
    this.allViewerTokens.delete(sessionToken);
    
    // Close relay connections where this viewer is the source or target
    for (const [key, connection] of this.relayConnections) {
      if (key.startsWith(`${sessionToken}->`) || key.endsWith(`->${sessionToken}`)) {
        connection.peerConnection.close();
        this.relayConnections.delete(key);
        console.log('⏹️ Closed relay connection:', key);
      }
    }
  }

  private async createRelayConnection(sourceViewer: ViewerCameraInfo, targetToken: string) {
    const relayKey = `${sourceViewer.sessionToken}->${targetToken}`;
    
    // Don't create duplicate connections
    if (this.relayConnections.has(relayKey)) {
      console.log('⚠️ Relay connection already exists:', relayKey);
      return;
    }

    try {
      console.log(`🔄 Creating relay connection: ${sourceViewer.displayName} -> viewer(${targetToken})`);

      const iceConfig = await this.getICEServers();
      const peerConnection = new RTCPeerConnection({
        iceServers: iceConfig.iceServers,
        iceCandidatePoolSize: 10
      });

      // Add the source viewer's stream tracks to this connection
      sourceViewer.stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, sourceViewer.stream);
        console.log(`✅ Added track to relay: ${track.kind} from ${sourceViewer.displayName}`);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          await this.sendSignalToViewer(targetToken, 'ice', {
            candidate: event.candidate,
            sourceToken: sourceViewer.sessionToken
          });
        }
      };

      // Handle connection state
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log(`🔄 Relay connection ${relayKey} state:`, state);
        
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          this.relayConnections.delete(relayKey);
        }
      };

      // Store connection
      this.relayConnections.set(relayKey, {
        sessionToken: targetToken,
        peerConnection,
        displayName: sourceViewer.displayName
      });

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await this.sendSignalToViewer(targetToken, 'offer', {
        sdp: offer.sdp,
        type: offer.type,
        sourceToken: sourceViewer.sessionToken,
        sourceDisplayName: sourceViewer.displayName,
        sourceAvatarUrl: sourceViewer.avatarUrl
      });

      console.log(`✅ Sent relay offer to viewer ${targetToken} for ${sourceViewer.displayName}`);
    } catch (error) {
      console.error('❌ Error creating relay connection:', error);
    }
  }

  private async handleAnswer(payload: any) {
    const relayKey = `${payload.sourceToken}->${payload.targetToken}`;
    const connection = this.relayConnections.get(relayKey);

    if (!connection) {
      console.warn('⚠️ No relay connection found for answer:', relayKey);
      return;
    }

    try {
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: payload.sdp
      });
      await connection.peerConnection.setRemoteDescription(answer);
      console.log('✅ Set remote description for relay:', relayKey);
    } catch (error) {
      console.error('❌ Error handling relay answer:', error);
    }
  }

  private async handleICE(payload: any) {
    const relayKey = `${payload.sourceToken}->${payload.targetToken}`;
    const connection = this.relayConnections.get(relayKey);

    if (!connection || !payload.candidate) return;

    try {
      const candidate = new RTCIceCandidate(payload.candidate);
      await connection.peerConnection.addIceCandidate(candidate);
      console.log('✅ Added ICE candidate for relay:', relayKey);
    } catch (error) {
      console.error('❌ Error adding relay ICE candidate:', error);
    }
  }

  private async sendSignalToViewer(targetToken: string, type: string, data: any) {
    try {
      await this.channel?.send({
        type: 'broadcast',
        event: type,
        payload: {
          ...data,
          targetToken,
          fromHost: true
        }
      });
      console.log(`✅ Sent ${type} signal to viewer ${targetToken}`);
    } catch (error) {
      console.error('❌ Error sending signal to viewer:', error);
    }
  }

  private async getICEServers(): Promise<{ iceServers: RTCIceServer[] }> {
    try {
      const { data, error } = await supabase.functions.invoke('get-ice-servers');
      
      if (error || !data) {
        return {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        };
      }
      
      return {
        iceServers: data.iceServers || []
      };
    } catch (error) {
      console.error('Error fetching ICE servers:', error);
      return {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
    }
  }

  notifyViewerJoined(sessionToken: string, displayName?: string) {
    console.log(`📡 Viewer joined relay system: ${displayName || sessionToken}`);
    
    this.allViewerTokens.add(sessionToken);
    
    // Store display name if provided
    if (displayName) {
      this.viewerDisplayNames.set(sessionToken, displayName);
    }
    
    // Send all existing viewer streams to this new viewer
    for (const [sourceToken, stream] of this.viewerStreams) {
      if (sourceToken !== sessionToken) {
        const sourceDisplayName = this.viewerDisplayNames.get(sourceToken) || 'Viewer';
        const sourceViewer = {
          sessionToken: sourceToken,
          stream,
          displayName: sourceDisplayName,
        };
        this.createRelayConnection(sourceViewer, sessionToken);
      }
    }
  }

  cleanup() {
    console.log('🧹 Cleaning up viewer stream relay');
    
    for (const [key, connection] of this.relayConnections) {
      connection.peerConnection.close();
      console.log('⏹️ Closed relay connection:', key);
    }

    this.relayConnections.clear();
    this.viewerStreams.clear();
    this.viewerDisplayNames.clear();
    this.allViewerTokens.clear();

    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
  }
}
