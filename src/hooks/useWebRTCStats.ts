import { useEffect, useRef, useState, useCallback } from 'react';

interface WebRTCStats {
  outgoingBitrate: number; // kbps
  incomingBitrate: number; // kbps
  packetLossPercent: number;
  iceConnectionState: string;
  roundTripTime: number; // ms
  jitter: number; // ms
  frameRate: number;
  resolution: { width: number; height: number };
  codec: string;
  viewerBitrates: Map<string, number>; // per-viewer incoming kbps
}

const STATS_INTERVAL_MS = 3000;

export const useWebRTCStats = (
  produceTransport: any,
  consumeTransports: Map<string, any>,
  enabled: boolean = false
) => {
  const [stats, setStats] = useState<WebRTCStats | null>(null);
  const prevBytesSent = useRef(0);
  const prevBytesReceived = useRef(0);
  const prevTimestamp = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const collectStats = useCallback(async () => {
    try {
      let outgoingBitrate = 0;
      let incomingBitrate = 0;
      let packetLossPercent = 0;
      let roundTripTime = 0;
      let jitter = 0;
      let frameRate = 0;
      let resolution = { width: 0, height: 0 };
      let codec = '';
      let iceConnectionState = 'unknown';
      const viewerBitrates = new Map<string, number>();

      const now = Date.now();
      const elapsed = prevTimestamp.current ? (now - prevTimestamp.current) / 1000 : STATS_INTERVAL_MS / 1000;

      // Outgoing stats from producer transport
      if (produceTransport?.connectionState) {
        iceConnectionState = produceTransport.connectionState;
      }

      if (produceTransport && typeof produceTransport.getStats === 'function') {
        try {
          const senderStats = await produceTransport.getStats();
          let totalBytesSent = 0;
          let totalPacketsSent = 0;
          let totalPacketsLost = 0;

          senderStats.forEach((report: any) => {
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
              totalBytesSent += report.bytesSent || 0;
              totalPacketsSent += report.packetsSent || 0;
              frameRate = report.framesPerSecond || frameRate;
              resolution = {
                width: report.frameWidth || 0,
                height: report.frameHeight || 0,
              };
              if (report.encoderImplementation) {
                codec = report.encoderImplementation;
              }
            }
            if (report.type === 'remote-inbound-rtp') {
              totalPacketsLost += report.packetsLost || 0;
              roundTripTime = (report.roundTripTime || 0) * 1000;
              jitter = (report.jitter || 0) * 1000;
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              roundTripTime = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : roundTripTime;
            }
          });

          if (prevBytesSent.current > 0 && elapsed > 0) {
            outgoingBitrate = Math.round(((totalBytesSent - prevBytesSent.current) * 8) / elapsed / 1000);
          }
          prevBytesSent.current = totalBytesSent;

          if (totalPacketsSent > 0) {
            packetLossPercent = Math.round((totalPacketsLost / (totalPacketsSent + totalPacketsLost)) * 100 * 100) / 100;
          }
        } catch (e) {
          // Stats not available yet
        }
      }

      // Incoming stats from consumer transports
      let totalBytesReceived = 0;
      for (const [storageId, transport] of consumeTransports) {
        if (transport && typeof transport.getStats === 'function') {
          try {
            const receiverStats = await transport.getStats();
            let transportBytes = 0;
            receiverStats.forEach((report: any) => {
              if (report.type === 'inbound-rtp') {
                transportBytes += report.bytesReceived || 0;
              }
            });
            totalBytesReceived += transportBytes;
          } catch (e) {
            // ignore
          }
        }
      }

      if (prevBytesReceived.current > 0 && elapsed > 0) {
        incomingBitrate = Math.round(((totalBytesReceived - prevBytesReceived.current) * 8) / elapsed / 1000);
      }
      prevBytesReceived.current = totalBytesReceived;

      prevTimestamp.current = now;

      const newStats: WebRTCStats = {
        outgoingBitrate: Math.max(0, outgoingBitrate),
        incomingBitrate: Math.max(0, incomingBitrate),
        packetLossPercent,
        iceConnectionState,
        roundTripTime: Math.round(roundTripTime),
        jitter: Math.round(jitter * 10) / 10,
        frameRate: Math.round(frameRate),
        resolution,
        codec,
        viewerBitrates,
      };

      setStats(newStats);

      // Log performance metrics
      if (outgoingBitrate > 0 || incomingBitrate > 0) {
        console.log(`📊 WebRTC Stats: out=${outgoingBitrate}kbps in=${incomingBitrate}kbps loss=${packetLossPercent}% rtt=${Math.round(roundTripTime)}ms fps=${Math.round(frameRate)} ice=${iceConnectionState}`);
      }

      // Warn on high packet loss
      if (packetLossPercent > 5) {
        console.warn(`⚠️ High packet loss: ${packetLossPercent}% - quality may degrade`);
      }

    } catch (error) {
      console.error('Error collecting WebRTC stats:', error);
    }
  }, [produceTransport, consumeTransports]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Reset counters
    prevBytesSent.current = 0;
    prevBytesReceived.current = 0;
    prevTimestamp.current = 0;

    intervalRef.current = setInterval(collectStats, STATS_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, collectStats]);

  return stats;
};
