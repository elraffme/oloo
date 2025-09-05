import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { MainPhotoSelector } from '@/components/MainPhotoSelector';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    location: '',
    occupation: '',
    education: '',
    interests: [] as string[],
    relationship_goals: '',
    age: 0
  });

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
        setEditForm({
          display_name: data.display_name || '',
          bio: data.bio || '',
          location: data.location || '',
          occupation: data.occupation || '',
          education: data.education || '',
          interests: data.interests || [],
          relationship_goals: data.relationship_goals || '',
          age: data.age || 0
        });
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

  const getMainProfilePhoto = () => {
    if (!profile?.profile_photos || profile.profile_photos.length === 0) {
      return profile?.avatar_url;
    }
    
    const mainIndex = profile.main_profile_photo_index || 0;
    return profile.profile_photos[mainIndex] || profile.profile_photos[0];
  };

  const handleMainPhotoUpdate = (newIndex: number) => {
    setProfile((prev: any) => ({
      ...prev,
      main_profile_photo_index: newIndex,
      avatar_url: prev.profile_photos?.[newIndex] || prev.avatar_url
    }));
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

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (!isEditing && profile) {
      // Reset form when entering edit mode
      setEditForm({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        location: profile.location || '',
        occupation: profile.occupation || '',
        education: profile.education || '',
        interests: profile.interests || [],
        relationship_goals: profile.relationship_goals || '',
        age: profile.age || 0
      });
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(editForm)
        .eq('user_id', user?.id);

      if (error) throw error;

      setProfile({ ...profile, ...editForm });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleInterestAdd = (interest: string) => {
    if (interest.trim() && !editForm.interests.includes(interest.trim())) {
      setEditForm(prev => ({
        ...prev,
        interests: [...prev.interests, interest.trim()]
      }));
    }
  };

  const handleInterestRemove = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      interests: prev.interests.filter((_, i) => i !== index)
    }));
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
                <AvatarImage src={getMainProfilePhoto()} alt={profile?.display_name} />
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
                <div className="flex-1 mr-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="display_name">Display Name</Label>
                        <Input
                          id="display_name"
                          value={editForm.display_name}
                          onChange={(e) => handleInputChange('display_name', e.target.value)}
                          placeholder="Your display name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="age">Age</Label>
                        <Input
                          id="age"
                          type="number"
                          value={editForm.age}
                          onChange={(e) => handleInputChange('age', parseInt(e.target.value) || 0)}
                          placeholder="Your age"
                          min="18"
                          max="100"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {profile?.display_name ? (
                          <h1 className="text-2xl font-bold font-afro-heading">
                            {profile.display_name}
                          </h1>
                        ) : (
                          <Button
                            variant="link"
                            className="text-2xl font-bold font-afro-heading p-0 h-auto text-primary hover:text-primary/80"
                            onClick={() => window.location.href = '/app'}
                          >
                            Complete Your Profile
                          </Button>
                        )}
                        <VerifiedBadge verified={profile?.verified} size="sm" />
                      </div>
                      {profile?.age && (
                        <p className="text-muted-foreground">
                          {profile.age} years old
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button onClick={handleSave} size="sm">
                      Save
                    </Button>
                    <Button variant="outline" onClick={handleEditToggle} size="sm">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={handleEditToggle}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>

              {/* Quick Info */}
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={editForm.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder="Your location"
                    />
                  </div>
                  <div>
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      value={editForm.occupation}
                      onChange={(e) => handleInputChange('occupation', e.target.value)}
                      placeholder="Your occupation"
                    />
                  </div>
                  <div>
                    <Label htmlFor="education">Education</Label>
                    <Input
                      id="education"
                      value={editForm.education}
                      onChange={(e) => handleInputChange('education', e.target.value)}
                      placeholder="Your education"
                    />
                  </div>
                  <div>
                    <Label htmlFor="relationship_goals">Relationship Goals</Label>
                    <Input
                      id="relationship_goals"
                      value={editForm.relationship_goals}
                      onChange={(e) => handleInputChange('relationship_goals', e.target.value)}
                      placeholder="What are you looking for?"
                    />
                  </div>
                </div>
              ) : (
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
              )}

              {isEditing ? (
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={editForm.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                  />
                </div>
              ) : (
                profile?.bio && (
                  <p className="text-sm leading-relaxed">{profile.bio}</p>
                )
              )}

              {/* Interests */}
              {isEditing ? (
                <div className="space-y-3">
                  <Label>Interests</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editForm.interests.map((interest, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleInterestRemove(index)}
                      >
                        {interest} ×
                      </Badge>
                    ))}
                  </div>
                  <Input
                    placeholder="Add an interest and press Enter"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInterestAdd(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              ) : (
                profile?.interests && profile.interests.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.slice(0, 6).map((interest: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                )
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
            <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800" style={{borderColor: '#93C5A6', backgroundColor: 'rgba(147, 197, 166, 0.1)'}}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2" style={{color: '#93C5A6'}}>
                  <Shield className="w-5 h-5" />
                  Account Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm" style={{color: '#7BA688'}}>
                  Verify your identity to gain trust and increase your matches. 
                  Verified profiles get 3x more likes!
                </p>
                <Button className="text-white hover:opacity-90" style={{backgroundColor: '#93C5A6'}}>
                  Start Verification
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos" className="space-y-6">
          {/* Main Photo Selection */}
          {profile?.profile_photos && profile.profile_photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Main Profile Photo</CardTitle>
              </CardHeader>
              <CardContent>
                <MainPhotoSelector 
                  profilePhotos={profile.profile_photos}
                  mainPhotoIndex={profile.main_profile_photo_index || 0}
                  userId={user?.id || ''}
                  onUpdate={handleMainPhotoUpdate}
                />
              </CardContent>
            </Card>
          )}
          
          {/* Photo Upload */}
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