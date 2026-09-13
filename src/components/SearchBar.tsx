import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  user_id?: string;
  display_name: string;
  age: number;
  location: string;
  avatar_url?: string;
  profile_photos?: string[];
  verified?: boolean;
  is_demo_profile?: boolean;
  bio?: string;
  occupation?: string;
  interests?: string[];
  education?: string;
  main_profile_photo_index?: number;
  relationship_goals?: string;
  height_cm?: number;
  languages?: string[];
  gender?: string;
  want_kids?: boolean;
  have_kids?: boolean;
  open_to_kids?: boolean;
  onboarding_completed?: boolean;
}

interface SearchBarProps {
  onSelectProfile: (profile: SearchResult) => void;
  className?: string;
}

export const SearchBar = ({ onSelectProfile, className }: SearchBarProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchProfiles = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        setShowResults(false);
        return;
      }

      setIsLoading(true);
      try {
        // Get current user to exclude them from search results
        const { data: currentUser } = await supabase.auth.getUser();
        
        let request = supabase
          .from('profiles')
          .select('id, user_id, display_name, age, location, avatar_url, profile_photos, verified, is_demo_profile, bio, occupation, education, interests, main_profile_photo_index, relationship_goals, height_cm, languages, gender, want_kids, have_kids, open_to_kids, onboarding_completed')
          .eq('is_demo_profile', false)
          .eq('show_profile', true)
          .eq('onboarding_completed', true)
          .or(`display_name.ilike.%${query}%,location.ilike.%${query}%,bio.ilike.%${query}%,occupation.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(15);

        if (currentUser?.user?.id) request = request.neq('user_id', currentUser.user.id);

        const { data, error } = await request;
        if (error) throw error;

        const unique = Array.from(new Map((data ?? []).map((profile) => [profile.user_id, profile])).values());
        setResults(unique);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchProfiles, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleSelectProfile = (profile: SearchResult) => {
    onSelectProfile(profile);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const getProfileImage = (profile: SearchResult) => {
    if (profile.avatar_url) return profile.avatar_url;
    if (profile.profile_photos && profile.profile_photos.length > 0) {
      return profile.profile_photos[0];
    }
    return '/placeholder.svg';
  };

  return (
    <div ref={searchRef} className={cn("relative w-full max-w-md", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          type="text"
          placeholder="Search for people..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10 bg-background border-border focus:border-primary/50 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              <div className="animate-pulse">Searching...</div>
            </div>
          ) : results.length > 0 ? (
            <div className="p-2">
              {results.map((profile) => (
                <Button
                  key={profile.id}
                  type="button"
                  variant="ghost"
                  onClick={() => handleSelectProfile(profile)}
                  className="h-auto w-full justify-start space-x-3 rounded-lg p-3 text-left hover:bg-muted"
                >
                  <div className="relative">
                    <img
                      src={getProfileImage(profile)}
                      alt={profile.display_name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-border"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                    {profile.verified && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-[8px] text-primary-foreground">✓</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-primary-foreground truncate">
                      {profile.display_name}
                      {!profile.verified && (
                        <span className="ml-2 text-xs text-amber-500">⏳</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {profile.age} • {profile.location}
                    </p>
                    {profile.occupation && (
                      <p className="text-xs text-muted-foreground/80 truncate">
                        {profile.occupation}
                      </p>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          ) : query.trim().length >= 2 ? (
            <div className="p-4 text-center text-muted-foreground">
              No profiles found for "{query}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};