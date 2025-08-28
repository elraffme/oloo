import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Edit, 
  Settings, 
  Shield, 
  Crown,
  MapPin,
  Briefcase,
  GraduationCap,
  Heart,
  Users,
  Gift,
  Video,
  Zap,
  Camera
} from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { PhotoUpload } from '@/components/PhotoUpload';
import { SensitiveInfoManager } from '@/components/SensitiveInfoManager';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [stats, setStats] = useState({
    matches: 0,
    likes: 0,
    streams: 0,
    giftsReceived: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadTokenBalance();
      loadStats();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTokenBalance = async () => {
    try {
      const { data } = await supabase.rpc('get_user_token_balance');
      setTokenBalance(data || 0);
    } catch (error) {
      console.error('Error loading token balance:', error);
    }
  };

  const updateProfilePhotos = async (photos: string[]) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ profile_photos: photos })
        .eq('user_id', user?.id);

      if (error) throw error;

      setProfile((prev: any) => ({
        ...prev,
        profile_photos: photos
      }));
    } catch (error) {
      console.error('Error updating profile photos:', error);
    }
  };

  const loadStats = async () => {
    try {
      // Load user statistics
      const [matchesRes, likesRes, streamsRes, giftsRes] = await Promise.allSettled([
        supabase.from('user_connections').select('id').eq('connection_type', 'match').eq('user_id', user?.id),
        supabase.from('user_connections').select('id').eq('connection_type', 'like').eq('connected_user_id', user?.id),
        supabase.from('streaming_sessions').select('id').eq('host_user_id', user?.id),
        supabase.from('token_transactions').select('id').eq('reason', 'gift_received').eq('user_id', user?.id)
      ]);

      setStats({
        matches: matchesRes.status === 'fulfilled' ? matchesRes.value.data?.length || 0 : 0,
        likes: likesRes.status === 'fulfilled' ? likesRes.value.data?.length || 0 : 0,
        streams: streamsRes.status === 'fulfilled' ? streamsRes.value.data?.length || 0 : 0,
        giftsReceived: giftsRes.status === 'fulfilled' ? giftsRes.value.data?.length || 0 : 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <div className="heart-logo mx-auto">
              <span className="logo-text">Ò</span>
            </div>
          </div>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 dark bg-background p-4">
      {/* Profile Header */}
      <Card className="cultural-card">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Profile Image */}
            <div className="relative">
              <Avatar className="w-32 h-32">
                <AvatarImage src={profile?.avatar_url} alt={profile?.display_name} />
                <AvatarFallback className="text-2xl">
                  {profile?.display_name?.[0] || user?.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button
                size="sm"
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary hover:bg-primary/90 p-0"
              >
                <Camera className="w-4 h-4" />
              </Button>
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold font-afro-heading">
                      {profile?.display_name || 'Complete Your Profile'}
                    </h1>
                    <VerifiedBadge verified={profile?.verified} size="sm" />
                  </div>
                  {profile?.age && (
                    <p className="text-muted-foreground">
                      {profile.age} years old
                    </p>
                  )}
                </div>
                <Button variant="outline">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>

              {/* Quick Info */}
              <div className="space-y-2">
                {profile?.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{profile.location}</span>
                  </div>
                )}
                
                {profile?.occupation && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span>{profile.occupation}</span>
                  </div>
                )}
                
                {profile?.education && (
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <span>{profile.education}</span>
                  </div>
                )}
              </div>

              {profile?.bio && (
                <p className="text-sm leading-relaxed">{profile.bio}</p>
              )}

              {/* Interests */}
              {profile?.interests && profile.interests.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {profile.interests.slice(0, 6).map((interest: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {interest}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="premium">Premium</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Heart className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-2xl font-bold">{stats.likes}</p>
                <p className="text-xs text-muted-foreground">Likes Received</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <p className="text-2xl font-bold">{stats.matches}</p>
                <p className="text-xs text-muted-foreground">Matches</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Video className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{stats.streams}</p>
                <p className="text-xs text-muted-foreground">Streams</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Gift className="w-5 h-5 text-gold" />
                </div>
                <p className="text-2xl font-bold">{stats.giftsReceived}</p>
                <p className="text-xs text-muted-foreground">Gifts</p>
              </CardContent>
            </Card>
          </div>

          {/* Token Balance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                Token Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{tokenBalance}</p>
                  <p className="text-sm text-muted-foreground">Available Tokens</p>
                </div>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  Buy Tokens
                </Button>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <p className="font-semibold">10 Tokens</p>
                  <p className="text-muted-foreground">Rose Gift</p>
                </div>
                <div>
                  <p className="font-semibold">25 Tokens</p>
                  <p className="text-muted-foreground">Heart Gift</p>
                </div>
                <div>
                  <p className="font-semibold">100 Tokens</p>
                  <p className="text-muted-foreground">Diamond Gift</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verification Status */}
          {!profile?.verified && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                  <Shield className="w-5 h-5" />
                  Account Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  Verify your identity to gain trust and increase your matches. 
                  Verified profiles get 3x more likes!
                </p>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  Start Verification
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos" className="space-y-6">
          <PhotoUpload 
            profilePhotos={profile?.profile_photos || []}
            onPhotosUpdate={updateProfilePhotos}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Privacy & Dating Preferences</h4>
                <div className="space-y-2 text-sm">
                  <label className="flex items-center justify-between">
                    <span>Show my profile to others</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Allow direct messages</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Show online status</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Open to people with kids</span>
                    <input type="checkbox" className="rounded" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Want to have kids in the future</span>
                    <input type="checkbox" className="rounded" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Already have kids</span>
                    <input type="checkbox" className="rounded" />
                  </label>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Notifications</h4>
                <div className="space-y-2 text-sm">
                  <label className="flex items-center justify-between">
                    <span>New matches</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Messages</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Live stream notifications</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </label>
                </div>
              </div>

              <Button variant="destructive" className="w-full">
                Delete Account
              </Button>
            </CardContent>
          </Card>
          {/* Secure Contact Information */}
          <SensitiveInfoManager />
        </TabsContent>

        {/* Premium Tab */}
        <TabsContent value="premium" className="space-y-6">
          <Card className="membership-card gold">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-6 h-6" />
                Òloo Premium
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Premium Features:</h4>
                <ul className="text-sm space-y-1">
                  <li>• Unlimited likes</li>
                  <li>• See who liked you</li>
                  <li>• Advanced filters</li>
                  <li>• Priority in discovery</li>
                  <li>• Exclusive premium streams</li>
                  <li>• Special gifts and badges</li>
                </ul>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold mb-1">$9.99/month</p>
                <p className="text-sm opacity-80">Cancel anytime</p>
              </div>
              
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;