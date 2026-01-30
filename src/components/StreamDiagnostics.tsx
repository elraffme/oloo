import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiagnosticsData {
  streamId: string | null;
  lifecycle: string;
  channelStatus: string;
  viewerCount: number;
  videoTracks: number;
  audioTracks: number;
  videoEnabled: boolean;
  audioEnabled: boolean;
  hasTURN: boolean;
  broadcastReady: boolean;
  // Audio-specific fields
  audioTrackState?: string;
  audioTrackLabel?: string;
  audioTrackMuted?: boolean;
}

interface StreamDiagnosticsProps {
  data: DiagnosticsData;
}

export const StreamDiagnostics: React.FC<StreamDiagnosticsProps> = ({ data }) => {
  return (
    <Card className="bg-muted/50">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Stream Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stream ID:</span>
            <span className="font-mono">{data.streamId?.substring(0, 8) || 'None'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lifecycle:</span>
            <span className={cn(
              "font-semibold",
              data.lifecycle === 'live' && "text-green-500",
              data.lifecycle === 'preparing' && "text-yellow-500",
              data.lifecycle === 'waiting' && "text-blue-500"
            )}>{data.lifecycle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Channel:</span>
            <span className={cn(
              "font-semibold",
              data.channelStatus === 'connected' && "text-green-500",
              data.channelStatus === 'connecting' && "text-yellow-500",
              data.channelStatus === 'error' && "text-red-500"
            )}>{data.channelStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Viewers:</span>
            <span className="font-semibold">{data.viewerCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Video Tracks:</span>
            <span className="font-semibold">{data.videoTracks}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Audio Tracks:</span>
            <span className="font-semibold">{data.audioTracks}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Camera:</span>
            <span>{data.videoEnabled ? '✅' : '❌'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mic:</span>
            <span>{data.audioEnabled ? '✅' : '❌'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TURN:</span>
            <span>{data.hasTURN ? '✅' : '⚠️ STUN only'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Broadcast:</span>
            <span className={cn(
              "font-semibold",
              data.broadcastReady ? "text-green-500" : "text-yellow-500"
            )}>{data.broadcastReady ? '✅ Ready' : '⏳ Preparing'}</span>
          </div>
          {data.audioTrackState && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Audio State:</span>
              <span className={cn(
                "font-semibold",
                data.audioTrackState === 'live' ? "text-green-500" : "text-yellow-500"
              )}>{data.audioTrackState}</span>
            </div>
          )}
          {data.audioTrackLabel && (
            <div className="flex justify-between col-span-2">
              <span className="text-muted-foreground">Audio Device:</span>
              <span className="font-mono text-xs truncate max-w-32">{data.audioTrackLabel}</span>
            </div>
          )}
          {data.audioTrackMuted !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Audio Muted:</span>
              <span>{data.audioTrackMuted ? '🔇' : '🔊'}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
