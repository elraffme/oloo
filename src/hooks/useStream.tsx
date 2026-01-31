import { useState, useRef, useEffect, useCallback } from "react";
import { Device } from "mediasoup-client";
import { io } from "socket.io-client";

// Configurable server URL - can be overridden via environment variable
const SERVER_URL = import.meta.env.VITE_MEDIASOUP_SERVER_URL || "https://api.oloo.media";

// Connection timing constants
const PRODUCER_TIMEOUT_MS = 10000; // 10 seconds before showing timeout
const PRODUCER_POLL_INTERVAL_MS = 3000; // Poll every 3 seconds
const MAX_PRODUCER_POLLS = 3; // Maximum polling attempts

// Connection phase type for granular state tracking
export type ConnectionPhase = 
  | 'idle' 
  | 'connecting' 
  | 'device_loading' 
  | 'joining_room' 
  | 'awaiting_producers' 
  | 'consuming' 
  | 'streaming' 
  | 'timeout' 
  | 'error';

export const useStream = (navigation = null) => {
  const [socket, setSocket] = useState(null);
  const [peers, setPeers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraFace, setCameraFace] = useState("user");
  const [remoteStream, setRemoteStream] = useState(null);
  const [viewerStreams, setViewerStreams] = useState([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // New state for connection phase tracking
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const device = useRef(null);
  const produceTransport = useRef(null);
  const consumeTransports = useRef(new Map());
  const consumers = useRef(new Map());
  const peerId = useRef(crypto.randomUUID());
  const roomId = useRef("");
  const roleRef = useRef("viewer");
  const socketRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const hostStreamRef = useRef<MediaStream | null>(null); // CRITICAL: Persistent host stream for audio continuity
  const remotePeerId = useRef("");
  const hostPeerId = useRef<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  
// New refs for connection timing
  const connectionStartTime = useRef<number | null>(null);
  const producerPollInterval = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeout = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimeInterval = useRef<NodeJS.Timeout | null>(null);
  const producerPollCount = useRef(0);
  const hasReceivedProducers = useRef(false);
  
  // Production tracking for host
  const producedTracksCount = useRef(0);
  const expectedTracksCount = useRef(0);
  const [isProducingReady, setIsProducingReady] = useState(false);
  const onProductionReadyCallback = useRef<(() => void) | null>(null);

  // Clear all timing intervals and timeouts
  const clearAllTimers = useCallback(() => {
    if (producerPollInterval.current) {
      clearInterval(producerPollInterval.current);
      producerPollInterval.current = null;
    }
    if (connectionTimeout.current) {
      clearTimeout(connectionTimeout.current);
      connectionTimeout.current = null;
    }
    if (elapsedTimeInterval.current) {
      clearInterval(elapsedTimeInterval.current);
      elapsedTimeInterval.current = null;
    }
    producerPollCount.current = 0;
    hasReceivedProducers.current = false;
  }, []);

  // Start elapsed time counter
  const startElapsedTimeCounter = useCallback(() => {
    connectionStartTime.current = Date.now();
    setElapsedTime(0);
    
    elapsedTimeInterval.current = setInterval(() => {
      if (connectionStartTime.current) {
        setElapsedTime(Math.floor((Date.now() - connectionStartTime.current) / 1000));
      }
    }, 1000);
  }, []);

  // Request current producers from SFU
  const requestProducers = useCallback(() => {
    if (socketRef.current && roomId.current) {
      console.log(`🔄 Polling for producers (attempt ${producerPollCount.current + 1}/${MAX_PRODUCER_POLLS})`);
      socketRef.current.emit('getCurrentProducers', { room: roomId.current });
    }
  }, []);

  // Start producer polling
  const startProducerPolling = useCallback(() => {
    producerPollCount.current = 0;
    
    producerPollInterval.current = setInterval(() => {
      if (hasReceivedProducers.current) {
        // Producers received, stop polling
        if (producerPollInterval.current) {
          clearInterval(producerPollInterval.current);
          producerPollInterval.current = null;
        }
        return;
      }
      
      producerPollCount.current++;
      requestProducers();
      
      if (producerPollCount.current >= MAX_PRODUCER_POLLS) {
        // Max polls reached, stop polling but wait for timeout
        if (producerPollInterval.current) {
          clearInterval(producerPollInterval.current);
          producerPollInterval.current = null;
        }
        console.log('⏱️ Max producer polls reached, waiting for timeout...');
      }
    }, PRODUCER_POLL_INTERVAL_MS);
  }, [requestProducers]);

  // Start connection timeout
  const startConnectionTimeout = useCallback(() => {
    connectionTimeout.current = setTimeout(() => {
      if (!hasReceivedProducers.current && roleRef.current === 'viewer') {
        console.log('⏰ Connection timeout - no producers found');
        setConnectionPhase('timeout');
        setConnectionError('Could not find host video. The host may not be streaming yet.');
        clearAllTimers();
      }
    }, PRODUCER_TIMEOUT_MS);
  }, [clearAllTimers]);

  // Retry connection - re-poll for producers
  const retryConnection = useCallback(() => {
    console.log('🔄 Retrying connection...');
    setConnectionPhase('awaiting_producers');
    setConnectionError(null);
    hasReceivedProducers.current = false;
    reconnectAttempts.current++;
    
    // Clear existing timers
    clearAllTimers();
    
    // Start fresh polling and timeout
    startElapsedTimeCounter();
    startProducerPolling();
    startConnectionTimeout();
    
    // Request producers immediately
    requestProducers();
  }, [clearAllTimers, startElapsedTimeCounter, startProducerPolling, startConnectionTimeout, requestProducers]);

  function cleanup() {
    console.log('🧹 Cleaning up stream resources...');
    
    // Clear all timers first
    clearAllTimers();
    
    // Close transports
    produceTransport.current?.close();
    produceTransport.current = null;
    
    consumeTransports.current.forEach((transport) => transport?.close());
    consumeTransports.current.clear();
    
    // Close all consumers
    consumers.current.forEach((consumer) => consumer?.close());
    consumers.current.clear();
    
    // CRITICAL: Stop and cleanup local stream tracks properly
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        // Remove event listeners
        track.onended = null;
        track.onmute = null;
        track.onunmute = null;
        // Stop the track
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track:`, track.label);
      });
      localStreamRef.current = null;
    }
    
    // CRITICAL: Reset host stream ref for clean rejoin
    if (hostStreamRef.current) {
      hostStreamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.onmute = null;
        track.onunmute = null;
      });
      hostStreamRef.current = null;
      console.log('🧹 Cleared host stream reference');
    }
    
    // Disconnect socket
    socketRef.current?.disconnect();
    socketRef.current = null;
    
    // Reset refs
    device.current = null;
    reconnectAttempts.current = 0;
    hostPeerId.current = null;
    remotePeerId.current = "";
    roomId.current = "";
    connectionStartTime.current = null;
    
    // CRITICAL: Reset production tracking refs for restart
    producedTracksCount.current = 0;
    expectedTracksCount.current = 0;
    onProductionReadyCallback.current = null;
    
    // Reset state - critical for rejoin
    setSocket(null);
    setLocalStream(null);
    setRemoteStream(null);
    setViewerStreams([]);
    setIsConnected(false);
    setIsReconnecting(false);
    setPeers([]);
    setConnectionPhase('idle');
    setConnectionError(null);
    setElapsedTime(0);
    setIsProducingReady(false);
    setIsMuted(false);
    
    // Generate new peerId for fresh connection
    peerId.current = crypto.randomUUID();
    
    console.log('✅ Stream cleanup complete, ready for rejoin');
  }

  async function loadDevice(routerRtpCapabilities) {
    try {
      setConnectionPhase('device_loading');
      device.current = new Device();
      await device.current.load({ routerRtpCapabilities });
    } catch (error) {
      console.error("Error loading device:", error);
      setConnectionPhase('error');
      setConnectionError('Failed to load media device');
    }
  }

  async function handleProducerTransport(data) {
    try {
      console.log('📤 Creating producer transport...', data);
      produceTransport.current = device.current.createSendTransport(data.data);

      produceTransport.current.on("connect", ({ dtlsParameters }, callback) => {
        console.log('🔗 Producer transport connecting...');
        // Use socketRef for stable reference
        socketRef.current?.emit(
          "connectTransport",
          { dtlsParameters, id: peerId.current },
          callback
        );
      });

      produceTransport.current.on("connectionstatechange", (state) => {
        console.log('📤 Producer transport state:', state);
        switch (state) {
          case "connecting":
            console.log("🔄 Producer transport connecting...");
            break;
          case "connected":
            console.log("✅ Producer transport connected!");
            // Don't set streaming phase here - wait for production confirmation
            break;
          case "failed":
            console.log("❌ Producer transport failed, restarting ICE...");
            socketRef.current?.emit(
              "producerRestartIce",
              peerId.current,
              async (params) => {
                await produceTransport.current.restartIce({
                  iceParameters: params,
                });
              }
            );
            break;
          default:
            break;
        }
      });

      produceTransport.current.on(
        "produce",
        ({ kind, rtpParameters, appData }, callback) => {
          console.log(`🎬 Producing ${kind} track to SFU...`);
          socketRef.current?.emit(
            "produce",
            { kind, rtpParameters, id: peerId.current, room: roomId.current, appData },
            ({ producerId }) => {
              console.log(`✅ ${kind} producer created with ID:`, producerId);
              if (!producerId) {
                console.error(`❌ Invalid producerId returned for ${kind}!`);
              }
              callback({ id: producerId });
              
              // Track production progress
              producedTracksCount.current++;
              console.log(`📊 Production progress: ${producedTracksCount.current}/${expectedTracksCount.current}`);
              
              // Check if all tracks are produced
              if (producedTracksCount.current >= expectedTracksCount.current && expectedTracksCount.current > 0) {
                console.log('🎉 All tracks produced successfully! Host is now fully broadcasting.');
                setConnectionPhase('streaming');
                setIsProducingReady(true);
                
                // Trigger callback if registered
                if (onProductionReadyCallback.current) {
                  console.log('📢 Triggering production ready callback');
                  onProductionReadyCallback.current();
                }
              }
            }
          );
        }
      );

      const stream = localStreamRef.current;
      if (!stream) {
        console.error("❌ Local stream not initialized - cannot produce");
        setConnectionPhase('error');
        setConnectionError('Local stream not available');
        return;
      }

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      // CRITICAL: Verify and prepare audio track before production
      let audioTrackReady = false;
      if (audioTrack) {
        // Force enable audio track
        if (!audioTrack.enabled) {
          console.warn('⚠️ Audio track was disabled, enabling before production...');
          audioTrack.enabled = true;
        }
        
        // Wait a tick for track state to stabilize (mobile fix)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check track state
        if (audioTrack.readyState === 'live') {
          audioTrackReady = true;
          console.log('🎤 Audio track verified ready for production:', {
            label: audioTrack.label,
            enabled: audioTrack.enabled,
            readyState: audioTrack.readyState,
            muted: audioTrack.muted,
            id: audioTrack.id
          });
        } else {
          console.error('❌ Audio track not live after wait, state:', audioTrack.readyState);
        }
      } else {
        console.warn('⚠️ No audio track in stream - host will be muted');
      }
      
      // Calculate expected tracks count BEFORE producing
      expectedTracksCount.current = (audioTrackReady ? 1 : 0) + (videoTrack ? 1 : 0);
      producedTracksCount.current = 0;
      
      console.log('📹 Stream tracks for production:', {
        video: videoTrack ? { enabled: videoTrack.enabled, state: videoTrack.readyState } : null,
        audio: audioTrackReady ? { enabled: audioTrack!.enabled, state: audioTrack!.readyState } : null,
        expectedTracks: expectedTracksCount.current
      });

      // PRODUCE AUDIO FIRST (priority for communication)
      if (audioTrackReady && audioTrack) {
        try {
          console.log('🎤 Producing audio track to SFU...');
          await produceTransport.current.produce({ 
            track: audioTrack, 
            appData: { 
              type: roleRef.current, 
              peerId: peerId.current,
              mediaType: 'audio'
            } 
          });
          console.log('✅ Audio track production initiated');
        } catch (audioError) {
          console.error('❌ Failed to produce audio track:', audioError);
          // Continue with video even if audio fails
        }
      }
      
      // PRODUCE VIDEO
      if (videoTrack) {
        try {
          console.log('📹 Producing video track to SFU...');
          await produceTransport.current.produce({ 
            track: videoTrack,
            encodings: [
              {
                ssrc: 111110,
                scalabilityMode: "L3T3_KEY",
                maxBitrate: 1000000,
              },
            ],
            appData: { 
              type: roleRef.current, 
              peerId: peerId.current,
              mediaType: 'video'
            }
          });
          console.log('✅ Video track production initiated');
        } catch (videoError) {
          console.error('❌ Failed to produce video track:', videoError);
        }
      }
      
      console.log(`📤 Host initiated production of ${expectedTracksCount.current} track(s) to room: ${roomId.current}`);
      
    } catch (error) {
      console.error("❌ Error creating producer transport:", error);
      setConnectionPhase('error');
      setConnectionError('Failed to create broadcast connection');
    }
  }

  function startConsumeProducer(producer) {
    console.log("🎬 New producer received, creating consume transport...", producer);
    setConnectionPhase('consuming');
    socketRef.current?.emit("createConsumeTransport", {
      producer,
      id: peerId.current,
      room: roomId.current,
    });
  }

  async function consume(data) {
    try {
      console.log('📥 Creating receive transport for consumption...');
      const transport = device.current.createRecvTransport(data.data);
      consumeTransports.current.set(data.storageId, transport);

      transport.on("connect", ({ dtlsParameters }, callback) => {
        console.log('🔗 Consumer transport connecting...');
        socketRef.current?.emit(
          "transportConnect",
          { dtlsParameters, storageId: data.storageId },
          callback
        );
      });

      transport.on("connectionstatechange", (state) => {
        console.log('📥 Consumer transport state:', state);
        switch (state) {
          case "connecting":
            console.log("🔄 Connecting to stream...");
            break;
          case "connected":
            console.log("✅ Subscribed to stream!");
            break;
          case "failed":
            console.log("❌ Consumer connection failed, restarting ICE...");
            socketRef.current?.emit(
              "consumerRestartIce",
              data.storageId,
              async (params) => {
                await transport.restartIce({
                  iceParameters: params,
                });
              }
            );
            break;
          default:
            break;
        }
      });

      console.log('📡 Starting to consume producer:', data.producer.producerId);
      socketRef.current?.emit("startConsuming", {
        rtpCapabilities: device.current.rtpCapabilities,
        storageId: data.storageId,
        producerId: data.producer.producerId,
        peerId: data.producer.peerId,
        appData: data.producer.appData,
        room: roomId.current,
      });
    } catch (error) {
      console.error("❌ Error creating consumer transport:", error);
      setConnectionPhase('error');
      setConnectionError('Failed to receive stream');
    }
  }


  // CRITICAL: State to force re-render when tracks are added to streams
  // This counter increments when new tracks are added to trigger React updates
  const [streamUpdateCounter, setStreamUpdateCounter] = useState(0);

  async function handleNewConsumer(data) {
    const {
      producerId,
      id,
      kind,
      rtpParameters,
      storageId,
      peerId: remPeerId,
      appData,
    } = data;
    const transport = consumeTransports.current.get(storageId);
    if (!transport) return;

    const consumer = await transport.consume({
      id,
      producerId,
      kind,
      rtpParameters,
      appData: { ...appData, peerId: remPeerId },
    });
    consumers.current.set(consumer.id, consumer);
    remotePeerId.current = remPeerId;

    // CRITICAL: Log consumer details
    console.log(`📥 New consumer created: ${consumer.kind} from ${appData?.type || 'host'}`, {
      consumerId: consumer.id,
      producerId,
      trackId: consumer.track.id,
      trackEnabled: consumer.track.enabled,
      trackReadyState: consumer.track.readyState,
      trackMuted: consumer.track.muted,
      totalConsumers: consumers.current.size
    });

    // For audio consumers, ensure track is enabled and setup event listeners
    // CRITICAL: This must happen BEFORE attaching to any MediaStream
    if (consumer.kind === 'audio') {
      // CRITICAL: Force-enable audio track immediately - this is the key fix
      // Audio tracks must be enabled at the consumer level, not just the stream level
      consumer.track.enabled = true;
      
      console.log(`🔊 AUDIO CONSUMER CONFIGURED: track=${consumer.track.id}, enabled=${consumer.track.enabled}, state=${consumer.track.readyState}`);
      
      consumer.track.onended = () => {
        console.log(`🔇 Audio consumer track ended: ${consumer.id}`);
      };
      
      consumer.track.onmute = () => {
        console.log(`🔇 Audio consumer track muted by system: ${consumer.id}`);
        // CRITICAL: Re-enable audio on system mute (happens on mobile/participant changes)
        setTimeout(() => {
          if (consumer.track.readyState === 'live') {
            consumer.track.enabled = true;
            console.log(`🔊 Re-enabled audio track after system mute`);
            setStreamUpdateCounter(c => c + 1); // Force UI update
          }
        }, 100);
      };
      
      consumer.track.onunmute = () => {
        console.log(`🔊 Audio consumer track unmuted by system: ${consumer.id}`);
      };
    }

    if (appData?.type === "viewer") {
      // VIEWER TRACK: Rebuild viewer streams map
      const viewerConsumers = Array.from(consumers.current.values()).filter(
        (c) => c.appData?.type === "viewer"
      );
      const viewerStreamsMap = new Map<string, { stream: MediaStream; displayName: string }>();
      viewerConsumers.forEach((c) => {
        const pId = c.appData?.peerId || "unknown";
        const displayName = c.appData?.displayName || "Viewer";
        if (!viewerStreamsMap.has(pId)) {
          viewerStreamsMap.set(pId, { stream: new MediaStream(), displayName });
        }
        // Ensure track is enabled before adding
        c.track.enabled = true;
        viewerStreamsMap.get(pId)!.stream.addTrack(c.track);
      });
      setViewerStreams(
        Array.from(viewerStreamsMap.entries()).map(([vid, vdata]) => ({
          id: vid,
          stream: vdata.stream,
          displayName: vdata.displayName,
        }))
      );
      console.log(`👥 Viewer streams updated: ${viewerStreamsMap.size} viewers`);
    } else {
      // HOST/STREAMER TRACK: Handle with special care for audio continuity
      hostPeerId.current = remPeerId;
      
      // CRITICAL FIX FOR PARTICIPANT-COUNT BUG:
      // The issue was that when adding tracks to an existing MediaStream,
      // React doesn't detect the change because the object reference stays the same.
      // Solution: Create a NEW MediaStream and copy all tracks (old + new) to it.
      // This ensures React sees a new object and re-renders properly.
      
      const isFirstTrack = !hostStreamRef.current;
      
      if (isFirstTrack) {
        // First track from host - create the stream
        hostStreamRef.current = new MediaStream();
        console.log('📺 Created new host MediaStream for first track');
      }
      
      // Check if this track is already in the stream
      const existingTrackIds = hostStreamRef.current.getTracks().map(t => t.id);
      const isNewTrack = !existingTrackIds.includes(consumer.track.id);
      
      if (isNewTrack) {
        // CRITICAL: Ensure the track is enabled before adding
        consumer.track.enabled = true;
        
        // Add the new track to the existing stream
        hostStreamRef.current.addTrack(consumer.track);
        
        console.log(`📺 Added ${consumer.kind} track to host stream. All tracks:`, 
          hostStreamRef.current.getTracks().map(t => ({ 
            kind: t.kind, 
            id: t.id,
            enabled: t.enabled, 
            state: t.readyState 
          }))
        );
        
        // CRITICAL FIX: Create a new MediaStream instance to trigger React re-render
        // Copy all tracks from the ref to a new stream
        const newStream = new MediaStream();
        hostStreamRef.current.getTracks().forEach(track => {
          // Double-ensure all tracks are enabled
          track.enabled = true;
          newStream.addTrack(track);
        });
        
        // Update the ref with the new stream
        hostStreamRef.current = newStream;
        
        // Set the new stream to state - React will now see this as a change
        setRemoteStream(newStream);
        
        // Force a UI update counter increment to ensure downstream components re-render
        setStreamUpdateCounter(c => c + 1);
        
        console.log(`📺 Created new MediaStream instance for React update. Stream ID: ${newStream.id}`);
      } else {
        console.log(`📺 Track ${consumer.track.id} already in host stream, skipping`);
      }
      
      // Log audio status specifically
      const audioTracks = hostStreamRef.current.getAudioTracks();
      const videoTracks = hostStreamRef.current.getVideoTracks();
      console.log(`📺 Host stream status: ${audioTracks.length} audio, ${videoTracks.length} video tracks`);
      
      if (audioTracks.length > 0) {
        console.log(`🔊 HOST AUDIO ACTIVE:`, audioTracks.map(t => ({
          id: t.id,
          enabled: t.enabled,
          muted: t.muted,
          state: t.readyState
        })));
      } else {
        console.warn(`⚠️ HOST HAS NO AUDIO TRACKS YET - waiting for audio producer`);
      }
      
      // Successfully streaming - clear all timers and update phase
      setConnectionPhase('streaming');
      clearAllTimers();
    }
  }

  async function initialize(role, options = {}, liveId, existingStream = null) {
    console.log('🚀 Initializing stream...', { role, liveId });
    
    // Set initial connection phase
    setConnectionPhase('connecting');
    setConnectionError(null);
    
    // Clean up any existing connection before reinitializing
    if (socketRef.current) {
      console.log('⚠️ Existing socket found, cleaning up first...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
    
    // Reset state for fresh connection
    if (device.current) {
      device.current = null;
    }
    consumeTransports.current.clear();
    consumers.current.clear();
    hasReceivedProducers.current = false;
    
    roleRef.current = role;
    roomId.current = liveId;

    if (role === "streamer") {
      try {
        if (existingStream) {
          console.log("Using existing stream as local stream");
          
          // Verify and setup existing stream's audio tracks
          const audioTracks = existingStream.getAudioTracks();
          if (audioTracks.length > 0) {
            const audioTrack = audioTracks[0];
            // Ensure track is enabled
            audioTrack.enabled = true;
            
            // Setup event listeners
            audioTrack.onended = () => console.log('🎤 Host audio track ended');
            audioTrack.onmute = () => console.log('🎤 Host audio track muted by system');
            audioTrack.onunmute = () => console.log('🎤 Host audio track unmuted by system');
            
            console.log('🎤 Host audio track from existing stream:', {
              label: audioTrack.label,
              enabled: audioTrack.enabled,
              readyState: audioTrack.readyState,
              muted: audioTrack.muted,
              id: audioTrack.id
            });
          } else {
            console.warn('⚠️ Existing stream has no audio tracks!');
          }
          
          localStreamRef.current = existingStream;
          setLocalStream(existingStream);
          setIsMuted(false);
          setCameraFace("user");
        } else {
          // Request fresh media stream
          console.log('🎤 Requesting fresh media stream for host...');
          
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: { ideal: 48000 },
              channelCount: { ideal: 1 },
            },
            video: {
              width: { ideal: 1080 },
              height: { ideal: 1920 },
              facingMode: 'user',
              aspectRatio: { ideal: 9/16 }
            }
          });
          
          // Wait a tick for track stabilization (mobile fix)
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Verify and setup audio tracks
          const audioTracks = stream.getAudioTracks();
          if (audioTracks.length > 0) {
            const audioTrack = audioTracks[0];
            
            // Force enable
            audioTrack.enabled = true;
            
            // Setup event listeners for debugging
            audioTrack.onended = () => {
              console.log('🎤 Host audio track ended unexpectedly');
              setIsMuted(true);
            };
            audioTrack.onmute = () => console.log('🎤 Host audio track muted by system');
            audioTrack.onunmute = () => console.log('🎤 Host audio track unmuted by system');
            
            console.log('✅ Host audio track acquired:', {
              label: audioTrack.label,
              enabled: audioTrack.enabled,
              readyState: audioTrack.readyState,
              muted: audioTrack.muted,
              id: audioTrack.id
            });
          } else {
            console.error('❌ No audio tracks acquired for host! Microphone may not be available.');
          }

          setIsMuted(false);
          setCameraFace("user");
          setLocalStream(stream);
          localStreamRef.current = stream;
        }
      } catch (error: any) {
        let errorMessage = 'Failed to access camera/microphone';
        
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera/microphone permission denied. Please allow access.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera or microphone found on this device.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera/microphone is in use by another application.';
        }
        
        console.error("❌ Error getting user media:", error.name, error.message);
        setConnectionPhase('error');
        setConnectionError(errorMessage);
        return;
      }
    }

    console.log('🔌 Creating new socket connection to:', SERVER_URL);
    const newSocket = io(SERVER_URL);
    socketRef.current = newSocket;
    setSocket(newSocket);
    
    // Start elapsed time counter for viewers
    if (role === 'viewer') {
      startElapsedTimeCounter();
    }
  }

  useEffect(() => {
    const currentSocket = socketRef.current;
    if (!currentSocket) return;

    const handleConnect = () => {
      console.log("✅ Socket connected to SFU server");
      setIsConnected(true);
      
      console.log('📡 Requesting RTP capabilities from SFU...');
      // Use socketRef.current for stable reference in async callback
      socketRef.current?.emit("getRTPCapabilites", async (data) => {
        console.log('📡 RTP capabilities received, loading device...');
        await loadDevice(data.capabilities);
        
        console.log('🚪 Joining room:', roomId.current, 'as', roleRef.current);
        setConnectionPhase('joining_room');
        socketRef.current?.emit("addUserCall", {
          room: roomId.current,
          peerId: peerId.current,
          username: "User",
          type: roleRef.current,
        });
        
        if (roleRef.current === "streamer") {
          console.log('📤 Requesting producer transport for streaming...');
          socketRef.current?.emit("createTransport", peerId.current);
        } else {
          // Viewer: start polling and timeout
          setConnectionPhase('awaiting_producers');
          console.log('👁️ Viewer mode - requesting producers immediately...');
          // Request producers immediately (don't wait for first poll interval)
          requestProducers();
          // Then start polling for subsequent attempts
          startProducerPolling();
          startConnectionTimeout();
        }
      });
    };
    
    const handleDisconnect = (reason: string) => {
      console.log("❌ Socket disconnected:", reason);
      setIsConnected(false);
      setIsProducingReady(false);
      
      if (reason === "io server disconnect") {
        // Server disconnected, try to reconnect
        console.log("🔄 Server initiated disconnect, attempting reconnect...");
        socketRef.current?.connect();
      } else if (reason === "transport close" || reason === "ping timeout") {
        // Network issue, try to reconnect
        console.log("🔄 Network issue detected, attempting reconnect...");
        setTimeout(() => {
          if (socketRef.current && !socketRef.current.connected) {
            socketRef.current.connect();
          }
        }, 1000);
      }
    };
    
    const handleConnectError = (error: Error) => {
      console.error("❌ Socket connection error:", error);
      setConnectionPhase('error');
      setConnectionError('Failed to connect to streaming server: ' + error.message);
    };

    currentSocket.on("connect", handleConnect);
    currentSocket.on("disconnect", handleDisconnect);
    currentSocket.on("connect_error", handleConnectError);

    // If socket is already connected (e.g., from a previous effect run), trigger connect handler
    if (currentSocket.connected) {
      console.log("🔄 Socket already connected, triggering connect handler");
      handleConnect();
    }

    return () => {
      currentSocket.off("connect", handleConnect);
      currentSocket.off("disconnect", handleDisconnect);
      currentSocket.off("connect_error", handleConnectError);
    };
  }, [socket, startProducerPolling, startConnectionTimeout, requestProducers]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("transportCreated", handleProducerTransport);
    return () => {
      socket.off("transportCreated");
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    socket.on("currentProducers", (producers) => {
      console.log(`📡 Received currentProducers: ${producers.length} producer(s)`);
      
      if (producers.length > 0) {
        // Found producers! Mark as received and consume them
        hasReceivedProducers.current = true;
        clearAllTimers();
        setConnectionPhase('consuming');
        producers.forEach((producer) => startConsumeProducer(producer));
      } else {
        // Empty response - polling will continue if still active
        console.log('📭 No producers yet, waiting...');
      }
    });
    return () => {
      socket.off("currentProducers");
    };
  }, [socket, clearAllTimers]);

  useEffect(() => {
    if (!socket) return;
    socket.on("newProducer", (producer) => {
      console.log('🆕 New producer arrived');
      hasReceivedProducers.current = true;
      clearAllTimers();
      setConnectionPhase('consuming');
      startConsumeProducer(producer);
    });
    return () => {
      socket.off("newProducer");
    };
  }, [socket, clearAllTimers]);

  useEffect(() => {
    if (!socket) return;
    socket.on("ConsumeTransportCreated", consume);
    return () => {
      socket.off("ConsumeTransportCreated");
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    socket.on("consumerCreated", handleNewConsumer);
    return () => {
      socket.off("consumerCreated");
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    socket.on("userLeft", (leftPeer) => {
      console.log('👤 User left event:', leftPeer);
      
      if (roleRef.current === "streamer") {
        // Host: just remove the viewer's stream
        for (const [key, consumer] of consumers.current) {
          if (consumer.appData?.peerId === leftPeer?.peerId) {
             consumer.close();
             consumers.current.delete(key);
          }
        }
        setViewerStreams(prev => prev.filter(v => v.id !== leftPeer?.peerId));
      } else {
        // Viewer: only react if the HOST left, not just any peer
        const isHostLeaving = leftPeer?.appData?.type === 'streamer' || 
                              leftPeer?.peerId === hostPeerId.current ||
                              leftPeer?.peerId === remotePeerId.current;
        
        if (isHostLeaving) {
          console.log('🔴 Host left the stream, clearing remote stream');
          remotePeerId.current = null;
          hostPeerId.current = null;
          setRemoteStream(null);
          cleanup();
          if (navigation) navigation.navigate("Home");
        } else {
          console.log('👤 Another viewer left, ignoring (not the host)');
        }
      }
    });
    return () => {
      socket.off("userLeft");
    };
  }, [socket]);


  function toggleCamera() {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        (videoTrack as any)._switchCamera();
        setCameraFace((prev) => (prev === "user" ? "environment" : "user"));
      }
    }
  }

  function toggleMute() {
    if (!localStreamRef.current) {
      console.warn('⚠️ No local stream to toggle mute');
      return false;
    }
    
    const audioTracks = localStreamRef.current.getAudioTracks();
    
    if (audioTracks.length === 0) {
      console.warn('⚠️ No audio tracks to toggle mute');
      return false;
    }
    
    // Toggle all audio tracks
    let newMutedState = !isMuted;
    audioTracks.forEach((track) => {
      track.enabled = !newMutedState; // enabled = opposite of muted
      console.log(`🎤 Audio track ${track.enabled ? 'UNMUTED' : 'MUTED'}:`, {
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
        id: track.id
      });
    });
    
    setIsMuted(newMutedState);
    return true;
  }

  function toggleVideo() {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
        console.log(`📹 Video track ${track.enabled ? 'enabled' : 'disabled'}`);
      });
    }
  }


  function checkChannelHealth() {
    return { 
      isHealthy: isConnected && connectionPhase !== 'error' && connectionPhase !== 'timeout', 
      details: {
        socketConnected: !!socketRef.current?.connected,
        deviceLoaded: !!device.current,
        hasProducers: hasReceivedProducers.current,
        consumersActive: consumers.current.size > 0,
        connectionPhase,
        elapsedTime
      } 
    };
  }



  async function publishStream(type = "camera", displayName = "Viewer"): Promise<MediaStream | null> {
    try {
      console.log(`📤 Publishing viewer stream (type: ${type})...`);
      
      // Determine media constraints based on type
      const isAudioOnly = type === "mic" || type === "audio";
      const isVideoOnly = type === "video";
      
      const constraints: MediaStreamConstraints = {
        audio: isVideoOnly ? false : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
        },
        video: isAudioOnly ? false : { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      };
      
      console.log('🎤 Requesting media with constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Wait a tick for track initialization (mobile fix)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Process audio tracks
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        // Force enable audio track
        track.enabled = true;
        
        // Setup event listeners for debugging
        track.onended = () => console.log('🎤 Viewer audio track ended');
        track.onmute = () => {
          console.log('🎤 Viewer audio track muted by system');
          // Re-enable after system mute
          setTimeout(() => {
            if (track.readyState === 'live') {
              track.enabled = true;
              console.log('🎤 Viewer audio track re-enabled after system mute');
            }
          }, 100);
        };
        track.onunmute = () => console.log('🎤 Viewer audio track unmuted by system');
        
        console.log('🎤 Viewer audio track acquired:', {
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted
        });
      });

      // Process video tracks
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = true;
        console.log('📹 Viewer video track acquired:', {
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState
        });
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);

      // CRITICAL: Wait for transport to be created if not available
      if (!produceTransport.current) {
        console.log('📤 No produce transport yet, requesting and waiting for one...');
        
        if (!socketRef.current) {
          console.error('❌ No socket connection available');
          return stream;
        }
        
        // Create a promise that resolves when transport is ready
        const transportPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Transport creation timed out'));
          }, 10000); // 10 second timeout
          
          const checkTransport = () => {
            if (produceTransport.current) {
              clearTimeout(timeout);
              resolve();
            } else {
              setTimeout(checkTransport, 100);
            }
          };
          
          // Start checking after emitting the request
          socketRef.current!.emit("createTransport", peerId.current);
          setTimeout(checkTransport, 100);
        });
        
        try {
          await transportPromise;
          console.log('✅ Producer transport is now ready');
          
          // Wait a bit for transport to stabilize
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error('❌ Failed to create producer transport:', err);
          return stream;
        }
      }
      
      // Double-check transport is available
      if (!produceTransport.current) {
        console.error('❌ Producer transport still not available after wait');
        return stream;
      }
      
      // Produce tracks to SFU
      const audioTrack = audioTracks[0];
      const videoTrack = videoTracks[0];

      // PRODUCE AUDIO FIRST (critical for communication)
      if (audioTrack) {
        if (audioTrack.readyState !== 'live') {
          console.error('❌ Viewer audio track not live:', audioTrack.readyState);
        } else {
          try {
            console.log('🎤 Producing viewer audio track to SFU...');
            await produceTransport.current.produce({
              track: audioTrack,
              appData: { 
                type: 'viewer', 
                peerId: peerId.current, 
                displayName,
                mediaType: 'audio'
              },
            });
            console.log('✅ Viewer audio track produced to SFU successfully');
          } catch (audioError) {
            console.error('❌ Failed to produce viewer audio:', audioError);
          }
        }
      } else {
        console.warn('⚠️ No audio track to produce');
      }
      
      // PRODUCE VIDEO
      if (videoTrack) {
        if (videoTrack.readyState !== 'live') {
          console.error('❌ Viewer video track not live:', videoTrack.readyState);
        } else {
          try {
            console.log('📹 Producing viewer video track to SFU...');
            await produceTransport.current.produce({
              track: videoTrack,
              encodings: [
                {
                  ssrc: 111110,
                  scalabilityMode: "L3T3_KEY",
                  maxBitrate: 1000000,
                },
              ],
              appData: { 
                type: 'viewer', 
                peerId: peerId.current, 
                displayName,
                mediaType: 'video'
              },
            });
            console.log('✅ Viewer video track produced to SFU successfully');
          } catch (videoError) {
            console.error('❌ Failed to produce viewer video:', videoError);
          }
        }
      }
      
      return stream;
    } catch (error: any) {
      let errorMessage = 'Failed to access media devices';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permission denied. Please allow camera/microphone access.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Device is in use by another app.';
      }
      
      console.error("❌ Error publishing viewer stream:", error.name, error.message, errorMessage);
      return null;
    }
  }

  function unpublishStream() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (produceTransport.current) {
      produceTransport.current.close();
      produceTransport.current = null;
    }
  }

  // Register a callback for when production is ready
  const onProductionReady = useCallback((callback: () => void) => {
    onProductionReadyCallback.current = callback;
    // If already ready, call immediately
    if (isProducingReady) {
      callback();
    }
  }, [isProducingReady]);

  return {
    initialize,
    cleanup,
    isConnected,
    isReconnecting,
    localStream,
    peers,
    toggleCamera,
    toggleMute,
    toggleVideo,
    isMuted,
    cameraFace,
    remoteStream,
    checkChannelHealth,
    viewerStreams,
    publishStream,
    unpublishStream,
    peerId: peerId.current,
    // New exports for connection phase tracking
    connectionPhase,
    connectionError,
    elapsedTime,
    retryConnection,
    // Production tracking
    isProducingReady,
    onProductionReady
  };
};
