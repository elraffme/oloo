import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Trash2, Lock, Globe, Loader2, Video } from 'lucide-react';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { toast } from 'sonner';
import { formatDuration } from '@/lib/streamLimits';

interface Replay {
  id: string;
  title: string;
  storage_path: string;
  duration_sec: number;
  size_bytes: number;
  is_public: boolean;
  created_at: string;
  stream_id: string | null;
}

const Replays = () => {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [replays, setReplays] = useState<Replay[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);

  const fetchReplays = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('stream_replays')
      .select('*')
      .eq('host_user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load replays');
    } else {
      setReplays((data ?? []) as Replay[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReplays();
  }, [user?.id]);

  const handlePlay = async (replay: Replay) => {
    const { data, error } = await supabase.storage
      .from('stream-replays')
      .createSignedUrl(replay.storage_path, 60 * 60);
    if (error || !data?.signedUrl) {
      toast.error('Could not load replay');
      return;
    }
    setPlaying({ id: replay.id, url: data.signedUrl });
  };

  const handleDelete = async (replay: Replay) => {
    if (!confirm('Delete this replay?')) return;
    await supabase.storage.from('stream-replays').remove([replay.storage_path]);
    const { error } = await supabase.from('stream_replays').delete().eq('id', replay.id);
    if (error) toast.error('Failed to delete');
    else {
      toast.success('Replay deleted');
      fetchReplays();
    }
  };

  const togglePublic = async (replay: Replay) => {
    const { error } = await supabase
      .from('stream_replays')
      .update({ is_public: !replay.is_public })
      .eq('id', replay.id);
    if (error) toast.error('Failed to update visibility');
    else fetchReplays();
  };

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="h-6 w-6" /> My Stream Replays
          </h1>
          <p className="text-sm text-muted-foreground">
            Saved recordings of your livestreams.
          </p>
        </div>
      </div>

      {!isPremium && (
        <UpgradePrompt
          variant="banner"
          title="Replays are a Premium feature"
          description="Upgrade to record and rewatch your livestreams later."
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : replays.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No replays yet. {isPremium ? 'Start a livestream — it will be saved automatically.' : 'Upgrade to Premium to save your livestreams.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {replays.map((replay) => (
            <Card key={replay.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="truncate">{replay.title}</span>
                  <Badge variant={replay.is_public ? 'default' : 'secondary'} className="shrink-0">
                    {replay.is_public ? <Globe className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                    {replay.is_public ? 'Public' : 'Private'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {playing?.id === replay.id ? (
                  <video src={playing.url} controls autoPlay className="w-full rounded-md bg-black aspect-video" />
                ) : (
                  <div
                    className="bg-muted rounded-md aspect-video flex items-center justify-center cursor-pointer"
                    onClick={() => handlePlay(replay)}
                  >
                    <Play className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDuration(replay.duration_sec)}</span>
                  <span>{(replay.size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                  <span>{new Date(replay.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => togglePublic(replay)}>
                    Make {replay.is_public ? 'Private' : 'Public'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(replay)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Replays;
