import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface ProfileVisitor {
  id: string;
  viewer_id: string;
  viewed_at: string;
  is_repeat_view: boolean;
  viewer_profile: {
    display_name: string;
    age: number;
    avatar_url: string | null;
    profile_photos: string[] | null;
    main_profile_photo_index: number;
    location: string;
    verified: boolean;
  };
}

interface ProfileVisitorsProps {
  onViewProfile?: (userId: string) => void;
}

export const ProfileVisitors = ({ onViewProfile }: ProfileVisitorsProps) => {
  const { user } = useAuth();
  const [visitors, setVisitors] = useState<ProfileVisitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVisitors, setTotalVisitors] = useState(0);
  const [newVisitorsCount, setNewVisitorsCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadVisitors();
      subscribeToNewVisitors();
    }
  }, [user]);

  const loadVisitors = async () => {
    try {
      setLoading(true);
      
      // Get recent visitors with profile data
      const { data: viewsData, error: viewsError } = await supabase
        .from('profile_views')
        .select(`
          id,
          viewer_id,
          viewed_at,
          is_repeat_view
        `)
        .eq('viewed_profile_id', user?.id)
        .order('viewed_at', { ascending: false })
        .limit(20);

      if (viewsError) throw viewsError;

      if (viewsData && viewsData.length > 0) {
        // Get unique viewer IDs
        const viewerIds = [...new Set(viewsData.map(v => v.viewer_id))];
        
        // Fetch profiles for all viewers
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, display_name, age, avatar_url, profile_photos, main_profile_photo_index, location, verified')
          .in('user_id', viewerIds);

        if (profilesError) throw profilesError;

        // Map profile data to visitors
        const profilesMap = new Map(
          profilesData?.map(p => [p.user_id, p]) || []
        );

        const visitorsWithProfiles = viewsData
          .map(view => ({
            ...view,
            viewer_profile: profilesMap.get(view.viewer_id)
          }))
          .filter(v => v.viewer_profile) as ProfileVisitor[];

        setVisitors(visitorsWithProfiles);
        
        // Count total unique visitors
        setTotalVisitors(viewerIds.length);
        
        // Count new visitors (not repeat views)
        const newCount = viewsData.filter(v => !v.is_repeat_view).length;
        setNewVisitorsCount(newCount);
      }
    } catch (error) {
      console.error('Error loading visitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNewVisitors = () => {
    const channel = supabase
      .channel('profile-views-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profile_views',
          filter: `viewed_profile_id=eq.${user?.id}`
        },
        () => {
          // Reload visitors when someone new views the profile
          loadVisitors();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getVisitorPhoto = (visitor: ProfileVisitor) => {
    const profile = visitor.viewer_profile;
    if (profile.profile_photos && profile.profile_photos.length > 0) {
      const mainIndex = profile.main_profile_photo_index || 0;
      return profile.profile_photos[mainIndex] || profile.profile_photos[0];
    }
    return profile.avatar_url || '/placeholder.svg';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Who Viewed Me
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Who Viewed Me
          </div>
          <div className="flex items-center gap-2">
            {newVisitorsCount > 0 && (
              <Badge variant="default" className="bg-primary">
                {newVisitorsCount} New
              </Badge>
            )}
            <Badge variant="secondary">
              <Users className="w-3 h-3 mr-1" />
              {totalVisitors}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visitors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No profile views yet</p>
            <p className="text-sm mt-1">Your visitors will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visitors.map((visitor) => (
              <div
                key={visitor.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                onClick={() => onViewProfile?.(visitor.viewer_id)}
              >
                <Avatar className="w-12 h-12">
                  <AvatarImage src={getVisitorPhoto(visitor)} alt={visitor.viewer_profile.display_name} />
                  <AvatarFallback>
                    {visitor.viewer_profile.display_name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">
                      {visitor.viewer_profile.display_name}, {visitor.viewer_profile.age}
                    </p>
                    {visitor.viewer_profile.verified && (
                      <Badge variant="secondary" className="text-xs">✓</Badge>
                    )}
                    {!visitor.is_repeat_view && (
                      <Badge variant="default" className="text-xs bg-primary/20 text-primary">
                        New
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{visitor.viewer_profile.location}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(visitor.viewed_at), { addSuffix: true })}</span>
                  </div>
                </div>

                {onViewProfile && (
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};