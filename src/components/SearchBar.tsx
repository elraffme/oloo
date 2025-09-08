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
        // Search in both real profiles and demo profiles
        const [realProfilesRes, demoProfilesRes] = await Promise.allSettled([
          supabase
            .from('profiles')
            .select('id, user_id, display_name, age, location, avatar_url, profile_photos, verified, is_demo_profile')
            .eq('verified', true)
            .eq('is_demo_profile', false)
            .or(`display_name.ilike.%${query}%,location.ilike.%${query}%`)
            .limit(10),
          supabase
            .from('demo_profiles')
            .select('id, display_name, age, location, profile_photos')
            .or(`display_name.ilike.%${query}%,location.ilike.%${query}%`)
            .limit(5)
        ]);

        let searchResults: SearchResult[] = [];

        // Add real profiles
        if (realProfilesRes.status === 'fulfilled' && realProfilesRes.value.data) {
          searchResults = [...searchResults, ...realProfilesRes.value.data];
        }

        // Add demo profiles
        if (demoProfilesRes.status === 'fulfilled' && demoProfilesRes.value.data) {
          const demoResults = demoProfilesRes.value.data.map(profile => ({
            ...profile,
            is_demo_profile: true,
            verified: false
          }));
          searchResults = [...searchResults, ...demoResults];
        }

        setResults(searchResults);
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
          className="pl-10 pr-10 bg-background border-border focus:border-primary/50 focus:ring-primary/20"
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
                <button
                  key={profile.id}
                  onClick={() => handleSelectProfile(profile)}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-muted rounded-lg transition-colors text-left"
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
                    <p className="font-medium text-foreground truncate">
                      {profile.display_name}
                      {profile.is_demo_profile && (
                        <span className="ml-2 text-xs text-muted-foreground">(Demo)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {profile.age} • {profile.location}
                    </p>
                  </div>
                </button>
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