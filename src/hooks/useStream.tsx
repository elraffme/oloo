import { useState, useRef, useEffect, useCallback } from "react";
import { Device } from "mediasoup-client";
import { io } from "socket.io-client";

// Configurable server URL - can be overridden via environment variable
const SERVER_URL = import.meta.env.VITE_MEDIASOUP_SERVER_URL || "https://api.oloo.media";

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

  function cleanup() {
    console.log('🧹 Cleaning up stream resources...');
    produceTransport.current?.close();
    consumeTransports.current.forEach((transport) => transport?.close());
    localStreamRef.current?.getTracks().forEach((track) => track?.stop());
    socketRef.current?.disconnect();
    reconnectAttempts.current = 0;
    hostPeerId.current = null;
  }

  async function loadDevice(routerRtpCapabilities) {
    try {
      device.current = new Device();
      await device.current.load({ routerRtpCapabilities });
    } catch (error) {
      console.error("Error loading device:", error);
    }
  }

  async function handleProducerTransport(data) {
    try {
      produceTransport.current = device.current.createSendTransport(data.data);

      produceTransport.current.on("connect", ({ dtlsParameters }, callback) => {
        socket.emit(
          "connectTransport",
          { dtlsParameters, id: peerId.current },
          callback
        );
      });

      produceTransport.current.on("connectionstatechange", (state) => {
        switch (state) {
          case "connecting":
            console.log("connecting");
            break;
          case "connected":
            console.log("connected");
            break;
          case "failed":
            console.log("failed");
            socket.emit(
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
          socket.emit(
            "produce",
            { kind, rtpParameters, id: peerId.current, room: roomId.current, appData },
            ({ producerId }) => {
              callback({ id: producerId });
            }
          );
        }
      );

      const stream = localStreamRef.current;
      if (!stream) {
        console.log("Local stream not initialized");
        return;
      }

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (audioTrack) {
        await produceTransport.current.produce({ track: audioTrack, appData: { type: roleRef.current, peerId: peerId.current }  });
      }
      if (videoTrack) {
        await produceTransport.current.produce({ track: videoTrack,
                  encodings: [
                {
                  ssrc: 111110,
                  scalabilityMode: "L3T3_KEY",
                  maxBitrate: 1000000,
                },
              ],
              appData: { type: roleRef.current, peerId: peerId.current }
         });
      }
    } catch (error) {
      console.error("Error creating producer transport:", error);
    }
  }

  function startConsumeProducer(producer) {
    console.log("new proda came", producer);
    socket.emit("createConsumeTransport", {
      producer,
      id: peerId.current,
      room: roomId.current,
    });
  }

  async function consume(data) {
    try {
      const transport = device.current.createRecvTransport(data.data);
      consumeTransports.current.set(data.storageId, transport);

      transport.on("connect", ({ dtlsParameters }, callback) => {
        socket.emit(
          "transportConnect",
          { dtlsParameters, storageId: data.storageId },
          callback
        );
      });

      transport.on("connectionstatechange", (state) => {
        switch (state) {
          case "connecting":
            console.log("Connecting To Stream!");
            break;
          case "connected":
            console.log("subscribed!");
            break;
          case "failed":
            console.log("Failed!");
            socket.emit(
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

      socket.emit("startConsuming", {
        rtpCapabilities: device.current.rtpCapabilities,
        storageId: data.storageId,
        producerId: data.producer.producerId,
        peerId: data.producer.peerId,
        appData: data.producer.appData,
        room: roomId.current,
      });
    } catch (error) {
      console.error("Error creating consumer transport:", error);
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
    }
  }

  async function initialize(role, options = {}, liveId, existingStream = null) {
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
      }
    }

      const newSocket = io(SERVER_URL);
      socketRef.current = newSocket;
      setSocket(newSocket);
  }

  useEffect(() => {
    if (!socket) return;

    socket.on("connect", () => {
      console.log("connected socket");
      setIsConnected(true);
      socket.emit("getRTPCapabilites", async (data) => {
        console.log('emit recvd')
        await loadDevice(data.capabilities);
        socket.emit("addUserCall", {
          room: roomId.current,
          peerId: peerId.current,
          username: "User",
          type: roleRef.current,
        });
        if (roleRef.current === "streamer") {
          socket.emit("createTransport", peerId.current);
        }
      });
    });

    return () => {
      socket.off("connect");
    };
  }, [socket]);

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
      producers.forEach((producer) => startConsumeProducer(producer));
    });
    return () => {
      socket.off("currentProducers");
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    socket.on("newProducer", startConsumeProducer);
    return () => {
      socket.off("newProducer");
    };
  }, [socket]);

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
    return { isHealthy: isConnected, details: {} };
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
    peerId: peerId.current
  };
};
