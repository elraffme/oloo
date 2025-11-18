import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Activity, CheckCircle2, XCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ConnectionStats {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  iceType: 'host' | 'srflx' | 'relay' | 'unknown';
  packetLoss: number;
  rtt: number;
  bitrate: number;
}

interface ConnectionStatusIndicatorProps {
  peerConnection: RTCPeerConnection | null;
  isConnected: boolean;
  compact?: boolean;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  peerConnection,
  isConnected,
  compact = false
}) => {
  const [stats, setStats] = useState<ConnectionStats>({
    quality: 'excellent',
    iceType: 'unknown',
    packetLoss: 0,
    rtt: 0,
    bitrate: 0
  });

  useEffect(() => {
    if (!peerConnection || !isConnected) return;

    const monitorInterval = setInterval(async () => {
      try {
        const stats = await peerConnection.getStats();
        let packetLoss = 0;
        let rtt = 0;
        let bitrate = 0;
        let iceType: 'host' | 'srflx' | 'relay' | 'unknown' = 'unknown';

        for (const report of stats.values()) {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            const received = report.packetsReceived || 0;
            const lost = report.packetsLost || 0;
            if (received > 0) {
              packetLoss = (lost / (received + lost)) * 100;
            }
            bitrate = (report.bytesReceived || 0) * 8 / 1000; // kbps
          }

          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
            
            // Determine ICE connection type
            const localCandidate = stats.get(report.localCandidateId);
            if (localCandidate) {
              if (localCandidate.candidateType === 'relay') {
                iceType = 'relay';
              } else if (localCandidate.candidateType === 'srflx') {
                iceType = 'srflx';
              } else if (localCandidate.candidateType === 'host') {
                iceType = 'host';
              }
            }
          }
        }

        // Determine quality
        let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
        if (packetLoss > 5 || rtt > 300) {
          quality = 'poor';
        } else if (packetLoss > 2 || rtt > 200) {
          quality = 'fair';
        } else if (packetLoss > 1 || rtt > 100) {
          quality = 'good';
        }

        setStats({ quality, iceType, packetLoss, rtt, bitrate });
      } catch (error) {
        console.error('Error monitoring connection:', error);
      }
    }, 3000);

    return () => clearInterval(monitorInterval);
  }, [peerConnection, isConnected]);

  if (!isConnected) {
    return (
      <Badge variant="outline" className="bg-muted">
        <WifiOff className="mr-1 h-3 w-3" />
        Disconnected
      </Badge>
    );
  }

  const qualityConfig = {
    excellent: { color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle2, text: 'Excellent' },
    good: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Activity, text: 'Good' },
    fair: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: AlertCircle, text: 'Fair' },
    poor: { color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle, text: 'Poor' }
  };

  const iceTypeConfig = {
    host: { text: 'Direct P2P', icon: Wifi, tip: 'Direct peer-to-peer connection' },
    srflx: { text: 'NAT P2P', icon: Wifi, tip: 'Connection through NAT' },
    relay: { text: 'TURN Relay', icon: Activity, tip: 'Connection through TURN server' },
    unknown: { text: 'Connecting...', icon: Activity, tip: 'Establishing connection' }
  };

  const config = qualityConfig[stats.quality];
  const iceConfig = iceTypeConfig[stats.iceType];
  const Icon = config.icon;
  const IceIcon = iceConfig.icon;

  if (compact) {
    return (
      <div className="flex gap-2">
        <Badge variant="outline" className={config.color}>
          <Icon className="mr-1 h-3 w-3" />
          {config.text}
        </Badge>
        <Badge variant="outline" className="bg-muted">
          <IceIcon className="mr-1 h-3 w-3" />
          {iceConfig.text}
        </Badge>
      </div>
    );
  }

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection Quality</span>
          <Badge variant="outline" className={config.color}>
            <Icon className="mr-1 h-3 w-3" />
            {config.text}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Connection Type</span>
          <Badge variant="outline" className="bg-muted" title={iceConfig.tip}>
            <IceIcon className="mr-1 h-3 w-3" />
            {iceConfig.text}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
          <div>
            <div className="text-muted-foreground">Packet Loss</div>
            <div className="font-medium">{stats.packetLoss.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Latency</div>
            <div className="font-medium">{stats.rtt.toFixed(0)}ms</div>
          </div>
          <div>
            <div className="text-muted-foreground">Bitrate</div>
            <div className="font-medium">{(stats.bitrate / 1000).toFixed(1)}M</div>
          </div>
        </div>

        {stats.quality === 'poor' && (
          <div className="text-xs text-destructive border-t pt-2">
            ⚠️ Poor connection detected. Stream quality may be affected.
          </div>
        )}
      </div>
    </Card>
  );
};
