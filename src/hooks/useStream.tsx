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
    
    // Stop local stream tracks
    localStreamRef.current?.getTracks().forEach((track) => track?.stop());
    localStreamRef.current = null;
    
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
      console.log('📤 Creating producer transport...');
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
            setConnectionPhase('streaming');
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
              callback({ id: producerId });
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
      
      console.log('📹 Stream tracks available:', {
        video: videoTrack ? { enabled: videoTrack.enabled, state: videoTrack.readyState } : null,
        audio: audioTrack ? { enabled: audioTrack.enabled, state: audioTrack.readyState } : null
      });

      let producedCount = 0;

      if (audioTrack) {
        console.log('🎤 Producing audio track...');
        await produceTransport.current.produce({ 
          track: audioTrack, 
          appData: { type: roleRef.current, peerId: peerId.current } 
        });
        producedCount++;
        console.log('✅ Audio track produced successfully');
      }
      
      if (videoTrack) {
        console.log('📹 Producing video track...');
        await produceTransport.current.produce({ 
          track: videoTrack,
          encodings: [
            {
              ssrc: 111110,
              scalabilityMode: "L3T3_KEY",
              maxBitrate: 1000000,
            },
          ],
          appData: { type: roleRef.current, peerId: peerId.current }
        });
        producedCount++;
        console.log('✅ Video track produced successfully');
      }
      
      console.log(`🎉 Host is now broadcasting ${producedCount} track(s) to room: ${roomId.current}`);
      
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

    console.log("new consumer", consumer.kind, "from", appData?.type);

    if (appData?.type === "viewer") {
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
        viewerStreamsMap.get(pId)!.stream.addTrack(c.track);
      });
      setViewerStreams(
        Array.from(viewerStreamsMap.entries()).map(([id, data]) => ({
          id,
          stream: data.stream,
          displayName: data.displayName,
        }))
      );
    } else {
      // This is the host/streamer - track their peerId for disconnect detection
      hostPeerId.current = remPeerId;
      console.log('📺 Host connected, tracking peerId:', remPeerId);
      
      const streamerConsumers = Array.from(consumers.current.values()).filter(
        (c) => c.appData?.type !== "viewer"
      );
      const newStream = new MediaStream(
        streamerConsumers.map((c) => c.track)
      );
      setRemoteStream(newStream);
      
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
           localStreamRef.current = existingStream;
           setLocalStream(existingStream);
           setIsMuted(false);
           setCameraFace("user");
        } else {
        const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: {
                width: { ideal: 1080 },
                height: { ideal: 1920 },
                facingMode: 'user',
                aspectRatio: { ideal: 9/16 }
              }
            });

            setIsMuted(false);
            setCameraFace("user");
            setLocalStream(stream);
            localStreamRef.current = stream;
        }
      } catch (error) {
        console.log("Error getting user media:", error);
        setConnectionPhase('error');
        setConnectionError('Failed to access camera/microphone');
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
    if (!socket) return;

    socket.on("connect", () => {
      console.log("✅ Socket connected to SFU server");
      setIsConnected(true);
      
      console.log('📡 Requesting RTP capabilities from SFU...');
      socket.emit("getRTPCapabilites", async (data) => {
        console.log('📡 RTP capabilities received, loading device...');
        await loadDevice(data.capabilities);
        
        console.log('🚪 Joining room:', roomId.current, 'as', roleRef.current);
        setConnectionPhase('joining_room');
        socket.emit("addUserCall", {
          room: roomId.current,
          peerId: peerId.current,
          username: "User",
          type: roleRef.current,
        });
        
        if (roleRef.current === "streamer") {
          console.log('📤 Requesting producer transport for streaming...');
          socket.emit("createTransport", peerId.current);
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
    });
    
    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
      setIsConnected(false);
      if (reason === "io server disconnect") {
        // Server disconnected, try to reconnect
        socket.connect();
      }
    });
    
    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
      setConnectionPhase('error');
      setConnectionError('Failed to connect to streaming server');
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
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
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  }

  function toggleVideo() {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "camera",
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);

      if (!produceTransport.current) {
        if (socket) {
          socket.emit("createTransport", peerId.current);
        }
      } else {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (audioTrack) {
          await produceTransport.current.produce({
            track: audioTrack,
            appData: { type: roleRef.current, peerId: peerId.current, displayName },
          });
        }
        if (videoTrack) {
          await produceTransport.current.produce({
            track: videoTrack,
            encodings: [
              {
                ssrc: 111110,
                scalabilityMode: "L3T3_KEY",
                maxBitrate: 1000000,
              },
            ],
            appData: { type: roleRef.current, peerId: peerId.current, displayName },
          });
        }
      }
      
      return stream;
    } catch (error) {
      console.error("Error publishing stream:", error);
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
    retryConnection
  };
};
