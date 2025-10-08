import { supabase } from '@/integrations/supabase/client';

export interface Match {
  match_user_id: string;
  display_name: string;
  avatar_url?: string;
  profile_photos?: string[];
  match_created_at: string;
}

export const createLike = async (targetUserId: string) => {
  try {
    const { error } = await supabase
      .from('user_connections')
      .insert({
        connected_user_id: targetUserId,
        connection_type: 'like'
      });
    
    if (error && error.code !== '23505') { // Ignore duplicate key errors
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error creating like:', error);
    return { success: false, error };
  }
};

export const checkMutualMatch = async (targetUserId: string) => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) return false;

    const { data, error } = await supabase
      .rpc('check_mutual_match', {
        user1_id: user.user.id,
        user2_id: targetUserId
      });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error checking mutual match:', error);
    return false;
  }
};

export const getUserMatches = async (): Promise<Match[]> => {
  try {
    const { data, error } = await supabase.rpc('get_user_matches');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting user matches:', error);
    return [];
  }
};

export const hasUserLikedProfile = async (targetUserId: string): Promise<boolean> => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) return false;

    const { data, error } = await supabase
      .from('user_connections')
      .select('id')
      .eq('user_id', user.user.id)
      .eq('connected_user_id', targetUserId)
      .eq('connection_type', 'like')
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') { // Ignore "no rows returned" error
      throw error;
    }
    
    return !!data;
  } catch (error) {
    console.error('Error checking if user liked profile:', error);
    return false;
  }
};