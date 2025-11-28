import { supabase } from '@/integrations/supabase/client';

interface ICEServerConfig {
  iceServers: RTCIceServer[];
  hasTURN: boolean;
}

export class ViewerToHostBroadcast {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream;
  private streamId: string;
  private sessionToken: string;
  private channel: any = null;
  private cleanupFunctions: (() => void)[] = [];
  private signalCleanupTimer: NodeJS.Timeout | null = null;
  private onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  private answerReceived: boolean = false;
  private answerTimeout: NodeJS.Timeout | null = null;
  private iceCandidateBuffer: RTCIceCandidate[] = [];

  constructor(
    streamId: string,
    sessionToken: string,
    localStream: MediaStream,
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  ) {
    this.streamId = streamId;
    this.sessionToken = sessionToken;
    this.localStream = localStream;
    this.onConnectionStateChange = onConnectionStateChange;
  }

  async initialize() {
    console.log('📹 ViewerToHostBroadcast: Initializing camera stream to host');
    
    try {
      // Get ICE servers
      const iceConfig = await this.getICEServers();
      
      // Create peer connection
      await this.createPeerConnection(iceConfig);
      
      // Setup signaling channels
      await this.setupSignaling();
      
      // Create and send offer
      await this.createAndSendOffer();
      
      console.log('✅ ViewerToHostBroadcast: Initialization complete');
    } catch (error) {
      console.error('❌ ViewerToHostBroadcast: Initialization failed', error);
      throw error;
    }
  }

  private async getICEServers(): Promise<ICEServerConfig> {
    try {
      const { data, error } = await supabase.functions.invoke('get-ice-servers');
      
      if (error || !data) {
        console.warn('⚠️ Using default STUN servers');
        return {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ],
          hasTURN: false
        };
      }
      
      return {
        iceServers: data.iceServers || [],
        hasTURN: data.hasTURN || false
      };
    } catch (error) {
      console.error('Error fetching ICE servers:', error);
      return {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ],
        hasTURN: false
      };
    }
  }

  private async createPeerConnection(iceConfig: ICEServerConfig) {
    console.log('🔗 Creating peer connection for viewer camera');
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: iceConfig.iceServers,
      iceCandidatePoolSize: 10
    });

    // Add local stream tracks
    this.localStream.getTracks().forEach(track => {
      console.log(`➕ Adding ${track.kind} track to peer connection`);
      this.peerConnection!.addTrack(track, this.localStream);
    });

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔄 Viewer camera connection state:', state);
      this.onConnectionStateChange?.(state!);
      
      // Update camera_stream_active status when connected
      if (state === 'connected') {
        console.log('✅ Viewer camera connected, updating database status');
        this.updateCameraStatus(true);
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        console.log('⚠️ Viewer camera disconnected, updating database status');
        this.updateCameraStatus(false);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('📤 Sending viewer camera ICE candidate');
        await this.sendSignal('ice', { candidate: event.candidate });
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', this.peerConnection?.iceConnectionState);
    };
  }

  private async setupSignaling() {
    console.log('📡 Setting up viewer camera signaling');
    
    // Use shared channel that host is listening on
    this.channel = supabase.channel(`viewer_cameras_${this.streamId}`)
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        // Only handle answers meant for this viewer
        if (payload.sessionToken === this.sessionToken) {
          console.log('📥 Received answer from host');
          await this.handleAnswer(payload);
        }
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        // Only handle ICE candidates meant for this viewer
        if (payload.role === 'host' && payload.sessionToken === this.sessionToken) {
          console.log('📥 Received ICE candidate from host');
          await this.handleICECandidate(payload);
        }
      })
      .subscribe(async (status) => {
        console.log('📡 Viewer camera channel status:', status);
      });

    this.cleanupFunctions.push(() => {
      supabase.removeChannel(this.channel);
    });

    // Also listen for signals in database (fallback)
    this.startDatabasePolling();
  }

  private startDatabasePolling() {
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('viewer_webrtc_signals')
          .select('*')
          .eq('stream_id', this.streamId)
          .eq('viewer_session_token', this.sessionToken)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!error && data) {
          for (const signal of data) {
            if (signal.signal_type === 'answer') {
              await this.handleAnswer(signal.signal_data);
            } else if (signal.signal_type === 'ice') {
              await this.handleICECandidate(signal.signal_data);
            }
          }
        }
      } catch (error) {
        console.error('Error polling for signals:', error);
      }
    }, 2000);

    this.cleanupFunctions.push(() => clearInterval(pollInterval));
  }

  private async createAndSendOffer() {
    if (!this.peerConnection) return;

    console.log('📤 Creating viewer camera offer');
    
    const offer = await this.peerConnection.createOffer({
      offerToReceiveVideo: false,
      offerToReceiveAudio: false
    });

    await this.peerConnection.setLocalDescription(offer);
    console.log('✅ Local description set');

    // Send offer via both channels
    await this.sendSignal('offer', { 
      sdp: offer.sdp,
      type: offer.type 
    });

    // Set answer timeout with retry
    this.answerTimeout = setTimeout(async () => {
      if (!this.answerReceived) {
        console.warn('⚠️ Answer not received within 10s, retrying offer...');
        await this.createAndSendOffer();
      }
    }, 10000);
  }

  private async sendSignal(type: string, data: any) {
    try {
      // Send via realtime channel
      await this.channel?.send({
        type: 'broadcast',
        event: type,
        payload: {
          ...data,
          role: 'viewer',
          sessionToken: this.sessionToken
        }
      });

      // Store in database as fallback
      await supabase
        .from('viewer_webrtc_signals')
        .insert({
          stream_id: this.streamId,
          viewer_session_token: this.sessionToken,
          signal_type: type,
          signal_data: data
        });

      console.log(`✅ Viewer camera signal sent: ${type}`);
    } catch (error) {
      console.error(`❌ Error sending viewer camera signal (${type}):`, error);
    }
  }

  private async handleAnswer(payload: any) {
    if (!this.peerConnection || !payload.sdp) return;

    try {
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: payload.sdp
      });

      if (this.peerConnection.signalingState === 'have-local-offer') {
        await this.peerConnection.setRemoteDescription(answer);
        console.log('✅ Remote description set from host answer');
        
        this.answerReceived = true;
        if (this.answerTimeout) {
          clearTimeout(this.answerTimeout);
          this.answerTimeout = null;
        }

        // Process buffered ICE candidates
        console.log(`📋 Processing ${this.iceCandidateBuffer.length} buffered ICE candidates`);
        for (const candidate of this.iceCandidateBuffer) {
          try {
            await this.peerConnection.addIceCandidate(candidate);
          } catch (error) {
            console.error('❌ Error adding buffered ICE candidate:', error);
          }
        }
        this.iceCandidateBuffer = [];
      }
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }

  private async handleICECandidate(payload: any) {
    if (!this.peerConnection || !payload.candidate) return;

    try {
      const candidate = new RTCIceCandidate(payload.candidate);
      
      // Buffer ICE candidates if we haven't set remote description yet
      if (!this.peerConnection.remoteDescription) {
        console.log('📋 Buffering ICE candidate (no remote description yet)');
        this.iceCandidateBuffer.push(candidate);
        return;
      }
      
      await this.peerConnection.addIceCandidate(candidate);
      console.log('✅ Added ICE candidate from host');
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  }

  async updateCameraStatus(enabled: boolean) {
    try {
      await supabase
        .from('stream_viewer_sessions')
        .update({
          camera_enabled: enabled,
          camera_stream_active: enabled && this.peerConnection?.connectionState === 'connected'
        })
        .eq('session_token', this.sessionToken);
    } catch (error) {
      console.error('Error updating camera status:', error);
    }
  }

  async updateMicStatus(enabled: boolean) {
    try {
      await supabase
        .from('stream_viewer_sessions')
        .update({
          mic_enabled: enabled
        })
        .eq('session_token', this.sessionToken);
    } catch (error) {
      console.error('Error updating mic status:', error);
    }
  }

  cleanup(stopTracks: boolean = true) {
    console.log('🧹 Cleaning up viewer camera broadcast', { stopTracks });
    
    // Clear timeouts
    if (this.answerTimeout) {
      clearTimeout(this.answerTimeout);
      this.answerTimeout = null;
    }
    
    // Only stop tracks if explicitly requested
    if (stopTracks) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`⏹️ Stopped ${track.kind} track`);
      });
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Run all cleanup functions
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];

    // Clear timers
    if (this.signalCleanupTimer) {
      clearTimeout(this.signalCleanupTimer);
    }

    // Update database
    this.updateCameraStatus(false);
  }
}
