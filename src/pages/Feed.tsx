import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Heart, 
  MessageCircle, 
  Video, 
  Gift, 
  Eye, 
  Users,
  Sparkles,
  Send,
  Smile,
  ThumbsUp,
  Flame,
  PartyPopper
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

interface FeedPost {
  id: string;
  user_id: string;
  content: string;
  post_type: string;
  created_at: string;
  user_profile: {
    display_name: string;
    avatar_url: string | null;
    profile_photos: string[] | null;
    main_profile_photo_index: number;
    verified: boolean;
  };
  reactions?: PostReaction[];
}

interface PostReaction {
  id: string;
  reaction_type: string;
  user_id: string;
}

interface ActivityItem {
  id: string;
  type: 'post' | 'profile_view' | 'match' | 'gift' | 'stream';
  title: string;
  description: string;
  timestamp: string;
  user?: {
    name: string;
    avatar: string;
    verified?: boolean;
  };
  icon: any;
  iconColor: string;
}

const Feed = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [statusContent, setStatusContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadFeed();
      loadRecentActivities();
      subscribeToFeed();
    }
  }, [user]);

  const loadFeed = async () => {
    try {
      setLoading(true);
      
      // Load posts from friends and own posts
      const { data: postsData, error: postsError } = await supabase
        .from('feed_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (postsError) throw postsError;

      if (postsData && postsData.length > 0) {
        // Get user profiles
        const userIds = [...new Set(postsData.map(p => p.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, profile_photos, main_profile_photo_index, verified')
          .in('user_id', userIds);

        const profilesMap = new Map(
          profilesData?.map(p => [p.user_id, p]) || []
        );

        // Get reactions for all posts
        const postIds = postsData.map(p => p.id);
        const { data: reactionsData } = await supabase
          .from('post_reactions')
          .select('*')
          .in('post_id', postIds);

        const reactionsMap = new Map<string, PostReaction[]>();
        reactionsData?.forEach(reaction => {
          const postReactions = reactionsMap.get(reaction.post_id) || [];
          postReactions.push(reaction);
          reactionsMap.set(reaction.post_id, postReactions);
        });

        const postsWithProfiles = postsData.map(post => ({
          ...post,
          user_profile: profilesMap.get(post.user_id),
          reactions: reactionsMap.get(post.id) || []
        })).filter(p => p.user_profile) as FeedPost[];

        setFeedPosts(postsWithProfiles);
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivities = async () => {
    try {
      const activityList: ActivityItem[] = [];

      // Load recent social interactions
      const { data: socialInteractions } = await supabase
        .from('social_interactions')
        .select('*')
        .eq('to_user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (socialInteractions && socialInteractions.length > 0) {
        const senderIds = socialInteractions.map(i => i.from_user_id);
        const { data: senderProfiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, profile_photos, main_profile_photo_index, verified')
          .in('user_id', senderIds);

        const profilesMap = new Map(senderProfiles?.map(p => [p.user_id, p]) || []);

        socialInteractions.forEach((interaction: any) => {
          const profile = profilesMap.get(interaction.from_user_id);
          if (profile) {
            const emoji = interaction.interaction_type === 'wave' ? '👋' : 
                         interaction.interaction_type === 'wink' ? '😉' : '❄️';
            const actionText = interaction.interaction_type === 'wave' ? 'waved at you' :
                              interaction.interaction_type === 'wink' ? 'winked at you' : 
                              'sent you an icebreaker';
            
            activityList.push({
              id: interaction.id,
              type: 'profile_view',
              title: `${emoji} ${actionText}`,
              description: interaction.message || `${profile.display_name} ${actionText}`,
              timestamp: interaction.created_at,
              user: {
                name: profile.display_name,
                avatar: profile.profile_photos?.[profile.main_profile_photo_index || 0] || profile.avatar_url || '/placeholder.svg',
                verified: profile.verified
              },
              icon: Sparkles,
              iconColor: 'text-pink-500'
            });
          }
        });
      }

      // Load recent profile views
      const { data: viewsData } = await supabase
        .from('profile_views')
        .select('id, viewer_id, viewed_at')
        .eq('viewed_profile_id', user?.id)
        .order('viewed_at', { ascending: false })
        .limit(5);

      if (viewsData && viewsData.length > 0) {
        const viewerIds = viewsData.map(v => v.viewer_id);
        const { data: viewerProfiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, profile_photos, main_profile_photo_index, verified')
          .in('user_id', viewerIds);

        const profilesMap = new Map(viewerProfiles?.map(p => [p.user_id, p]) || []);

        viewsData.forEach(view => {
          const profile = profilesMap.get(view.viewer_id);
          if (profile) {
            activityList.push({
              id: view.id,
              type: 'profile_view',
              title: 'Profile View',
              description: `${profile.display_name} viewed your profile`,
              timestamp: view.viewed_at,
              user: {
                name: profile.display_name,
                avatar: profile.profile_photos?.[profile.main_profile_photo_index || 0] || profile.avatar_url || '/placeholder.svg',
                verified: profile.verified
              },
              icon: Eye,
              iconColor: 'text-blue-500'
            });
          }
        });
      }

      // Load recent matches
      const { data: matchesData } = await supabase
        .from('user_connections')
        .select('id, connected_user_id, created_at')
        .eq('user_id', user?.id)
        .eq('connection_type', 'match')
        .order('created_at', { ascending: false })
        .limit(3);

      if (matchesData && matchesData.length > 0) {
        const matchIds = matchesData.map(m => m.connected_user_id);
        const { data: matchProfiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, profile_photos, main_profile_photo_index')
          .in('user_id', matchIds);

        const profilesMap = new Map(matchProfiles?.map(p => [p.user_id, p]) || []);

        matchesData.forEach(match => {
          const profile = profilesMap.get(match.connected_user_id);
          if (profile) {
            activityList.push({
              id: match.id,
              type: 'match',
              title: 'New Match',
              description: `You matched with ${profile.display_name}`,
              timestamp: match.created_at,
              user: {
                name: profile.display_name,
                avatar: profile.profile_photos?.[profile.main_profile_photo_index || 0] || profile.avatar_url || '/placeholder.svg'
              },
              icon: Heart,
              iconColor: 'text-red-500'
            });
          }
        });
      }

      // Load live streams
      const { data: streamsData } = await supabase
        .from('streaming_sessions')
        .select('id, host_user_id, title, started_at')
        .eq('status', 'live')
        .order('started_at', { ascending: false })
        .limit(3);

      if (streamsData) {
        const hostIds = streamsData.map(s => s.host_user_id);
        const { data: hostProfiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', hostIds);

        const profilesMap = new Map(hostProfiles?.map(p => [p.user_id, p]) || []);

        streamsData.forEach(stream => {
          const profile = profilesMap.get(stream.host_user_id);
          if (profile) {
            activityList.push({
              id: stream.id,
              type: 'stream',
              title: 'Live Now',
              description: `${profile.display_name} is streaming: ${stream.title}`,
              timestamp: stream.started_at,
              user: {
                name: profile.display_name,
                avatar: profile.avatar_url || '/placeholder.svg'
              },
              icon: Video,
              iconColor: 'text-red-600'
            });
          }
        });
      }

      // Sort all activities by timestamp
      activityList.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(activityList.slice(0, 10));
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const subscribeToFeed = () => {
    const channel = supabase
      .channel('feed-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed_posts'
        },
        () => {
          loadFeed();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handlePostStatus = async () => {
    if (!statusContent.trim()) return;

    setPosting(true);
    try {
      const { error } = await supabase
        .from('feed_posts')
        .insert({
          user_id: user?.id,
          content: statusContent.trim(),
          post_type: 'status'
        });

      if (error) throw error;

      setStatusContent('');
      toast({
        title: "Posted!",
        description: "Your status has been shared with your friends.",
      });
      
      loadFeed();
    } catch (error) {
      console.error('Error posting status:', error);
      toast({
        title: "Error",
        description: "Failed to post status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    try {
      // Check if user already reacted
      const post = feedPosts.find(p => p.id === postId);
      const existingReaction = post?.reactions?.find(
        r => r.user_id === user?.id && r.reaction_type === reactionType
      );

      if (existingReaction) {
        // Remove reaction
        await supabase
          .from('post_reactions')
          .delete()
          .eq('id', existingReaction.id);
      } else {
        // Add reaction
        await supabase
          .from('post_reactions')
          .insert({
            post_id: postId,
            user_id: user?.id,
            reaction_type: reactionType
          });
      }

      loadFeed();
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  const getPostAvatar = (post: FeedPost) => {
    const profile = post.user_profile;
    if (profile.profile_photos && profile.profile_photos.length > 0) {
      const mainIndex = profile.main_profile_photo_index || 0;
      return profile.profile_photos[mainIndex] || profile.profile_photos[0];
    }
    return profile.avatar_url || '/placeholder.svg';
  };

  const getReactionCount = (post: FeedPost, reactionType: string) => {
    return post.reactions?.filter(r => r.reaction_type === reactionType).length || 0;
  };

  const hasUserReacted = (post: FeedPost, reactionType: string) => {
    return post.reactions?.some(r => r.user_id === user?.id && r.reaction_type === reactionType) || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <Sparkles className="w-12 h-12 mx-auto text-primary" />
          </div>
          <p className="text-muted-foreground">Loading your feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-afro-heading mb-2">Social Feed</h1>
        <p className="text-muted-foreground">Stay connected with your friends and discover what's happening</p>
      </div>

      {/* Browse by Interest Card */}
      <Card 
        className="cursor-pointer hover:shadow-lg transition-all hover:border-primary"
        onClick={() => navigate('/app/browse-interest')}
      >
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Browse by Interest</h3>
              <p className="text-sm text-muted-foreground">
                Discover people who share your passions and hobbies
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <span className="text-2xl">→</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Update */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback>
                {user?.email?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                placeholder="What's on your mind?"
                value={statusContent}
                onChange={(e) => setStatusContent(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm">
                  <Smile className="w-4 h-4 mr-2" />
                  Add Emoji
                </Button>
                <Button 
                  onClick={handlePostStatus} 
                  disabled={!statusContent.trim() || posting}
                  size="sm"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {posting ? 'Posting...' : 'Post'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      {activities.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Recent Activity
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {activities.map((activity, index) => (
              <div key={activity.id}>
                {index > 0 && <Separator className="my-3" />}
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full bg-accent ${activity.iconColor}`}>
                    <activity.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {activity.title}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{activity.description}</p>
                  </div>
                  {activity.user && (
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
                      <AvatarFallback>{activity.user.name[0]}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Feed Posts */}
      <div className="space-y-4">
        {feedPosts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
              <p className="text-muted-foreground mb-4">
                Be the first to share something with your friends!
              </p>
              <Button onClick={() => document.querySelector('textarea')?.focus()}>
                Post a Status Update
              </Button>
            </CardContent>
          </Card>
        ) : (
          feedPosts.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-4">
                {/* Post Header */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={getPostAvatar(post)} alt={post.user_profile.display_name} />
                    <AvatarFallback>
                      {post.user_profile.display_name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{post.user_profile.display_name}</p>
                      {post.user_profile.verified && (
                        <Badge variant="secondary" className="text-xs">✓</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Post Content */}
                <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap">
                  {post.content}
                </p>

                <Separator className="mb-3" />

                {/* Reactions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReaction(post.id, 'like')}
                    className={hasUserReacted(post, 'like') ? 'text-primary' : ''}
                  >
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    {getReactionCount(post, 'like') || 'Like'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReaction(post.id, 'heart')}
                    className={hasUserReacted(post, 'heart') ? 'text-red-500' : ''}
                  >
                    <Heart className="w-4 h-4 mr-1" />
                    {getReactionCount(post, 'heart') || ''}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReaction(post.id, 'fire')}
                    className={hasUserReacted(post, 'fire') ? 'text-orange-500' : ''}
                  >
                    <Flame className="w-4 h-4 mr-1" />
                    {getReactionCount(post, 'fire') || ''}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReaction(post.id, 'party')}
                    className={hasUserReacted(post, 'party') ? 'text-purple-500' : ''}
                  >
                    <PartyPopper className="w-4 h-4 mr-1" />
                    {getReactionCount(post, 'party') || ''}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Feed;