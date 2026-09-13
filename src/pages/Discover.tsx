import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DiscoverProfileCard, type DiscoverProfile } from '@/components/DiscoverProfileCard';
import { PublicProfileViewer } from '@/components/PublicProfileViewer';
import { SearchBar } from '@/components/SearchBar';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { sendFriendRequest } from '@/utils/friendsUtils';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 12;
type FriendState = 'idle' | 'loading' | 'sent' | 'friends' | 'error';

const Discover = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [page, setPage] = useState(1);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchedProfile, setSearchedProfile] = useState<DiscoverProfile | null>(null);
  const [friendRequestStates, setFriendRequestStates] = useState<Record<string, FriendState>>({});
  const [profileViewer, setProfileViewer] = useState<{ isOpen: boolean; profileId: string | null }>({
    isOpen: false,
    profileId: null,
  });

  const totalPages = Math.max(1, Math.ceil(totalProfiles / PAGE_SIZE));

  const loadFriendshipStates = useCallback(async (visibleProfiles: DiscoverProfile[]) => {
    if (!user?.id) return;

    const entries = await Promise.all(visibleProfiles.map(async (profile): Promise<[string, FriendState]> => {
      try {
        const { data, error } = await supabase
          .from('user_connections')
          .select('connection_type')
          .or(`and(user_id.eq.${user.id},connected_user_id.eq.${profile.user_id}),and(user_id.eq.${profile.user_id},connected_user_id.eq.${user.id})`)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        if (data?.connection_type === 'friend') return [profile.user_id, 'friends'];
        if (data?.connection_type === 'friend_request') return [profile.user_id, 'sent'];
        return [profile.user_id, 'idle'];
      } catch (error) {
        console.error('Error loading friendship state:', error);
        return [profile.user_id, 'idle'];
      }
    }));

    setFriendRequestStates((current) => ({ ...current, ...Object.fromEntries(entries) }));
  }, [user?.id]);

  const loadProfiles = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, age, location, bio, occupation, education, interests, verified, profile_photos, main_profile_photo_index, relationship_goals, height_cm, languages, gender, want_kids, have_kids, open_to_kids, onboarding_completed', { count: 'exact' })
        .eq('is_demo_profile', false)
        .eq('show_profile', true)
        .eq('onboarding_completed', true)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .order('user_id', { ascending: true })
        .range(from, to);

      if (error) throw error;

      const uniqueProfiles = Array.from(
        new Map((data ?? []).filter((profile) => profile.user_id !== user.id).map((profile) => [profile.user_id, profile])).values(),
      ) as DiscoverProfile[];

      setProfiles(uniqueProfiles);
      setTotalProfiles(count ?? uniqueProfiles.length);
      await loadFriendshipStates(uniqueProfiles);
    } catch (error) {
      console.error('Error loading profiles:', error);
      setProfiles([]);
      setTotalProfiles(0);
      toast({
        title: 'Unable to load profiles',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [loadFriendshipStates, page, toast, user?.id]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (!searchedProfile) return;
    loadFriendshipStates([searchedProfile]);
  }, [loadFriendshipStates, searchedProfile]);

  const handleViewProfile = (profile: DiscoverProfile) => {
    setProfileViewer({ isOpen: true, profileId: profile.user_id });
  };

  const handleMessage = (profile: DiscoverProfile) => {
    navigate('/app/messages', { state: { selectedUser: profile.user_id, newConversation: profile.user_id } });
  };

  const handleAddFriend = async (profile: DiscoverProfile) => {
    const targetUserId = profile.user_id;
    if (!user) {
      navigate('/auth');
      return;
    }

    setFriendRequestStates((current) => ({ ...current, [targetUserId]: 'loading' }));
    try {
      const result = await sendFriendRequest(targetUserId);
      if (result.success) {
        const nextState: FriendState = result.type === 'accepted' ? 'friends' : 'sent';
        setFriendRequestStates((current) => ({ ...current, [targetUserId]: nextState }));
        toast({
          title: result.type === 'accepted' ? "You're now friends" : 'Friend request sent',
          description: result.type === 'accepted'
            ? `You and ${profile.display_name} are now friends.`
            : `Your request was sent to ${profile.display_name}.`,
        });
        return;
      }

      setFriendRequestStates((current) => ({ ...current, [targetUserId]: 'error' }));
      toast({ title: 'Friend request', description: result.message });
    } catch (error) {
      console.error('Error sending friend request:', error);
      setFriendRequestStates((current) => ({ ...current, [targetUserId]: 'error' }));
      toast({ title: 'Unable to send request', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const visibleProfiles = searchedProfile ? [searchedProfile] : profiles;

  return (
    <section className="mx-auto w-full max-w-7xl" aria-labelledby="discover-title">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="discover-title" className="font-afro-heading text-3xl font-bold text-foreground">Discover</h1>
          <p className="mt-1 text-sm text-foreground">Meet people and explore meaningful connections.</p>
        </div>
        <SearchBar onSelectProfile={(profile) => setSearchedProfile(profile as DiscoverProfile)} className="sm:max-w-sm" />
      </div>

      {searchedProfile && (
        <div className="mb-5 flex items-center justify-between gap-3 border-y border-border bg-card px-3 py-3 sm:rounded-md sm:border">
          <p className="min-w-0 truncate text-sm text-foreground">
            <span className="font-medium text-primary">Search Result:</span>{' '}
            <span className="font-semibold">{searchedProfile.display_name}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={() => setSearchedProfile(null)}>Show all</Button>
        </div>
      )}

      {loading && !searchedProfile ? (
        <div className="flex min-h-80 items-center justify-center" role="status">
          <div className="text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-primary" />
            <p>Finding amazing people for you...</p>
          </div>
        </div>
      ) : visibleProfiles.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {visibleProfiles.map((profile) => (
              <DiscoverProfileCard
                key={profile.user_id}
                profile={profile}
                friendState={friendRequestStates[profile.user_id] ?? 'idle'}
                onView={handleViewProfile}
                onMessage={handleMessage}
                onAddFriend={handleAddFriend}
              />
            ))}
          </div>

          {!searchedProfile && totalPages > 1 && (
            <nav className="mt-8 flex flex-wrap items-center justify-center gap-3" aria-label="Discover profiles pagination">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="min-w-24 text-center text-sm font-medium text-foreground">Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages || loading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
          )}
        </>
      ) : (
        <div className="flex min-h-80 flex-col items-center justify-center border-y border-border text-center sm:rounded-md sm:border">
          <Users className="mb-3 h-9 w-9 text-primary" />
          <h2 className="font-afro-heading text-xl font-bold text-foreground">No profiles available right now</h2>
          <p className="mt-2 max-w-md px-4 text-sm text-muted-foreground">Check back later for new connections.</p>
        </div>
      )}

      <PublicProfileViewer
        profileId={profileViewer.profileId ?? ''}
        isOpen={profileViewer.isOpen}
        onClose={() => setProfileViewer({ isOpen: false, profileId: null })}
        onStartChat={(userId) => navigate('/app/messages', { state: { selectedUser: userId } })}
      />
    </section>
  );
};

export default Discover;
