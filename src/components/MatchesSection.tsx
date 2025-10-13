import React, { useState, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { OnlineStatusBadge } from '@/components/OnlineStatusBadge';

interface Match {
  match_user_id: string;
  display_name: string;
  avatar_url?: string;
  profile_photos?: string[];
  match_created_at: string;
}

interface MatchesSectionProps {
  onStartConversation: (matchId: string) => void;
}

const MatchesSection: React.FC<MatchesSectionProps> = ({ onStartConversation }) => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadMatches();
    }
  }, [user]);

  const loadMatches = async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_matches');
      
      if (error) throw error;
      
      setMatches(data || []);
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="heart-logo mb-4 opacity-50">
          <span className="logo-text">Ò</span>
        </div>
        <h3 className="text-lg font-semibold mb-2 text-white">No matches yet</h3>
        <p className="text-muted-foreground">
          Keep swiping to find your perfect match!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="w-5 h-5 text-primary fill-current" />
        <h2 className="text-xl font-afro-heading">Your Matches</h2>
        <Badge variant="secondary">{matches.length}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {matches.map((match) => (
          <Card key={match.match_user_id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="relative aspect-[3/4]">
                <img
                  src={match.profile_photos?.[0] || match.avatar_url || '/placeholder.svg'}
                  alt={match.display_name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{match.display_name}</h3>
                    <OnlineStatusBadge userId={match.match_user_id} showDot={true} showText={false} />
                  </div>
                  <p className="text-xs opacity-90">
                    Matched {formatDistanceToNow(new Date(match.match_created_at), { addSuffix: true })}
                  </p>
                </div>

                <div className="absolute top-2 right-2">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Heart className="w-3 h-3 text-primary-foreground fill-current" />
                  </div>
                </div>
              </div>
              
              <div className="p-3">
                <Button
                  onClick={() => onStartConversation(match.match_user_id)}
                  className="w-full text-sm"
                  size="sm"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Message
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MatchesSection;