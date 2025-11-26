import { supabase } from '@/integrations/supabase/client';

interface ViewerCameraStream {
  sessionToken: string;
  stream: MediaStream;
  displayName: string;
  avatarUrl?: string;
  peerConnection: RTCPeerConnection;
}

interface ICEServerConfig {
  iceServers: RTCIceServer[];
  hasTURN: boolean;
}

export class ViewerCameraReceiver {
  private streamId: string;
  private viewerCameras: Map<string, ViewerCameraStream> = new Map();
  private channel: any = null;
  private cleanupFunctions: (() => void)[] = [];
  private onViewerCamerasUpdate?: (cameras: Map<string, ViewerCameraStream>) => void;
  private processedSignals: Set<string> = new Set(); // Track processed offers

  constructor(
    streamId: string,
    onViewerCamerasUpdate?: (cameras: Map<string, ViewerCameraStream>) => void
  ) {
    this.streamId = streamId;
    this.onViewerCamerasUpdate = onViewerCamerasUpdate;
  }

  async initialize() {
    console.log('📹 ViewerCameraReceiver: Initializing for stream', this.streamId);
    
    try {
      await this.setupSignaling();
      await this.loadExistingViewerCameras();
      console.log('✅ ViewerCameraReceiver: Initialization complete');
    } catch (error) {
      console.error('❌ ViewerCameraReceiver: Initialization failed', error);
      throw error;
    }
  }

  private async setupSignaling() {
    console.log('📡 Setting up host signaling for viewer cameras');
    
    // Listen for viewer camera offers
    this.channel = supabase.channel(`viewer_cameras_${this.streamId}`)
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.role === 'viewer' && payload.sessionToken) {
          console.log('📥 Received camera offer from viewer:', payload.sessionToken);
          await this.handleViewerOffer(payload);
        }
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload.role === 'viewer' && payload.sessionToken) {
          console.log('📥 Received ICE candidate from viewer:', payload.sessionToken);
          await this.handleViewerICE(payload);
        }
      })
      .subscribe(async (status) => {
        console.log('📡 Viewer cameras channel status:', status);
      });

    this.cleanupFunctions.push(() => {
      supabase.removeChannel(this.channel);
    });

    // Also poll database for signals
    this.startDatabasePolling();
  }

  private startDatabasePolling() {
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('viewer_webrtc_signals')
          .select('*')
          .eq('stream_id', this.streamId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          const offersByViewer = new Map<string, any>();
          const icesByViewer = new Map<string, any[]>();

          for (const signal of data) {
            if (signal.signal_type === 'offer') {
              offersByViewer.set(signal.viewer_session_token, signal);
            } else if (signal.signal_type === 'ice') {
              if (!icesByViewer.has(signal.viewer_session_token)) {
                icesByViewer.set(signal.viewer_session_token, []);
              }
              icesByViewer.get(signal.viewer_session_token)!.push(signal);
            }
          }

          // Process offers
          for (const [sessionToken, signal] of offersByViewer) {
            if (!this.viewerCameras.has(sessionToken)) {
              await this.handleViewerOffer({
                sessionToken,
                ...signal.signal_data
              });
            }
          }

          // Process ICE candidates
          for (const [sessionToken, signals] of icesByViewer) {
            for (const signal of signals) {
              await this.handleViewerICE({
                sessionToken,
                candidate: signal.signal_data.candidate
              });
            }
          }
        }
      } catch (error) {
        console.error('Error polling for viewer signals:', error);
      }
    }, 3000);

    this.cleanupFunctions.push(() => clearInterval(pollInterval));
  }

  private async loadExistingViewerCameras() {
    try {
      const { data, error } = await supabase
        .from('stream_viewer_sessions')
        .select('*')
        .eq('stream_id', this.streamId)
        .eq('camera_enabled', true);

      if (!error && data) {
        console.log(`Found ${data.length} viewers with cameras enabled`);
      }
    } catch (error) {
      console.error('Error loading existing viewer cameras:', error);
    }
  }

  private async handleViewerOffer(payload: any) {
    const sessionToken = payload.sessionToken;
    
    // Don't create duplicate connections
    if (this.viewerCameras.has(sessionToken)) {
      console.log('⚠️ Already have connection for viewer:', sessionToken);
      return;
    }

    // Track this signal to prevent duplicate processing
    const signalKey = `${sessionToken}-${payload.sdp?.substring(0, 50)}`;
    if (this.processedSignals.has(signalKey)) {
      console.log('⚠️ Already processed this offer for viewer:', sessionToken);
      return;
    }
    this.processedSignals.add(signalKey);

    try {
      console.log('🔗 Creating peer connection for viewer camera:', sessionToken);
      
      // Get ICE servers
      const iceConfig = await this.getICEServers();
      
      // Create peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: iceConfig.iceServers,
        iceCandidatePoolSize: 10
      });

      // Handle incoming tracks (viewer's camera)
      peerConnection.ontrack = (event) => {
        console.log('📹 Received track from viewer:', event.track.kind, 'sessionToken:', sessionToken);
        
        const stream = event.streams[0];
        if (stream) {
          console.log('✅ Got viewer stream, adding immediately to map');
          
          // Store viewer camera immediately with placeholder name
          const viewerCamera: ViewerCameraStream = {
            sessionToken,
            stream,
            displayName: 'Loading...',
            peerConnection
          };

          this.viewerCameras.set(sessionToken, viewerCamera);
          this.notifyUpdate();
          console.log('✅ Added viewer camera stream (placeholder):', sessionToken);

          // Update viewer info asynchronously
          this.getViewerInfo(sessionToken).then(viewerInfo => {
            const updatedCamera = this.viewerCameras.get(sessionToken);
            if (updatedCamera) {
              updatedCamera.displayName = viewerInfo.displayName;
              updatedCamera.avatarUrl = viewerInfo.avatarUrl;
              this.notifyUpdate();
              console.log('✅ Updated viewer camera info:', sessionToken, viewerInfo.displayName);
            }
          }).catch(err => {
            console.error('Error fetching viewer info:', err);
          });
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('📤 Sending ICE candidate to viewer:', sessionToken);
          await this.sendSignalToViewer(sessionToken, 'ice', {
            candidate: event.candidate
          });
        }
      };

      // Handle connection state
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log(`🔄 Viewer ${sessionToken} connection state:`, state);
        
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          this.removeViewerCamera(sessionToken);
        }
      };

      // Set remote description from offer
      const offer = new RTCSessionDescription({
        type: 'offer',
        sdp: payload.sdp
      });
      await peerConnection.setRemoteDescription(offer);
      console.log('✅ Set remote description from viewer offer');

      // Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log('✅ Created answer for viewer');

      await this.sendSignalToViewer(sessionToken, 'answer', {
        sdp: answer.sdp,
        type: answer.type
      });

      console.log('✅ Sent answer to viewer:', sessionToken);
    } catch (error) {
      console.error('❌ Error handling viewer offer:', error);
    }
  }

  private async handleViewerICE(payload: any) {
    const sessionToken = payload.sessionToken;
    const viewerCamera = this.viewerCameras.get(sessionToken);
    
    if (!viewerCamera || !payload.candidate) return;

    try {
      const candidate = new RTCIceCandidate(payload.candidate);
      await viewerCamera.peerConnection.addIceCandidate(candidate);
      console.log('✅ Added ICE candidate from viewer:', sessionToken);
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  }

  private async sendSignalToViewer(sessionToken: string, type: string, data: any) {
    try {
      // Send via realtime
      await this.channel?.send({
        type: 'broadcast',
        event: type,
        payload: {
          ...data,
          role: 'host',
          sessionToken
        }
      });

      // Store in database
      await supabase
        .from('viewer_webrtc_signals')
        .insert({
          stream_id: this.streamId,
          viewer_session_token: sessionToken,
          signal_type: type,
          signal_data: data
        });

      console.log(`✅ Signal sent to viewer ${sessionToken}: ${type}`);
    } catch (error) {
      console.error(`❌ Error sending signal to viewer:`, error);
    }
  }

  private async getViewerInfo(sessionToken: string): Promise<{ displayName: string, avatarUrl?: string }> {
    try {
      const { data, error } = await supabase
        .from('stream_viewer_sessions')
        .select('viewer_display_name, viewer_id')
        .eq('session_token', sessionToken)
        .single();

      if (!error && data) {
        // Try to get avatar from profile if authenticated viewer
        if (data.viewer_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('user_id', data.viewer_id)
            .single();

          return {
            displayName: data.viewer_display_name,
            avatarUrl: profile?.avatar_url
          };
        }

        return { displayName: data.viewer_display_name };
      }
    } catch (error) {
      console.error('Error getting viewer info:', error);
    }

    return { displayName: 'Viewer' };
  }

  private async getICEServers(): Promise<ICEServerConfig> {
    try {
      const { data, error } = await supabase.functions.invoke('get-ice-servers');
      
      if (error || !data) {
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
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        hasTURN: false
      };
    }
  }

  private removeViewerCamera(sessionToken: string) {
    const viewerCamera = this.viewerCameras.get(sessionToken);
    if (viewerCamera) {
      viewerCamera.peerConnection.close();
      this.viewerCameras.delete(sessionToken);
      this.notifyUpdate();
      console.log('🗑️ Removed viewer camera:', sessionToken);
    }
  }

  private notifyUpdate() {
    this.onViewerCamerasUpdate?.(this.viewerCameras);
  }

  getViewerCameras() {
    return this.viewerCameras;
  }

  cleanup() {
    console.log('🧹 Cleaning up viewer camera receiver');
    
    // Close all peer connections
    for (const [sessionToken, viewerCamera] of this.viewerCameras) {
      viewerCamera.peerConnection.close();
      console.log('⏹️ Closed connection for viewer:', sessionToken);
    }

    this.viewerCameras.clear();

    // Run cleanup functions
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
  }
}
