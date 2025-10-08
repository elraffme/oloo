import { supabase } from '@/integrations/supabase/client';

export interface Friend {
  friend_user_id: string;
  display_name: string;
  avatar_url?: string;
  profile_photos?: string[];
  friend_since: string;
}

export interface FriendRequest {
  requester_user_id: string;
  display_name: string;
  avatar_url?: string;
  profile_photos?: string[];
  request_date: string;
}

export interface FriendRequestResult {
  success: boolean;
  message: string;
  type?: string;
}

export const sendFriendRequest = async (targetUserId: string): Promise<FriendRequestResult> => {
  try {
    // First check if connection already exists
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) {
      return { success: false, message: 'Authentication required' };
    }

    // Check if there's already a connection between these users
    const { data: existingConnection, error: checkError } = await supabase
      .from('user_connections')
      .select('connection_type, user_id')
      .or(`and(user_id.eq.${user.user.id},connected_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},connected_user_id.eq.${user.user.id})`)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingConnection) {
      if (existingConnection.connection_type === 'friend') {
        return { success: false, message: 'Already friends' };
      }
      if (existingConnection.connection_type === 'friend_request') {
        if (existingConnection.user_id === user.user.id) {
          return { success: false, message: 'Friend request already sent' };
        } else {
          // Accept the existing request
          const { error: acceptError } = await supabase
            .from('user_connections')
            .update({ connection_type: 'friend' })
            .eq('user_id', targetUserId)
            .eq('connected_user_id', user.user.id)
            .eq('connection_type', 'friend_request');

          if (acceptError) throw acceptError;

          // Create reciprocal friend connection
          await supabase
            .from('user_connections')
            .insert({
              user_id: user.user.id,
              connected_user_id: targetUserId,
              connection_type: 'friend'
            });

          return { success: true, message: 'Friend request accepted', type: 'accepted' };
        }
      }
      // For other connection types (like, block), we can still send friend request
    }

    // Send new friend request using the RPC function
    const { data, error } = await supabase
      .rpc('send_friend_request', { target_user_id: targetUserId });
    
    if (error) throw error;
    
    // Type guard to ensure we have the expected structure
    if (data && typeof data === 'object' && 'success' in data) {
      return data as unknown as FriendRequestResult;
    }
    
    return { success: false, message: 'Invalid response format' };
  } catch (error) {
    console.error('Error sending friend request:', error);
    return { success: false, message: 'Failed to send friend request' };
  }
};

export const acceptFriendRequest = async (requesterUserId: string): Promise<FriendRequestResult> => {
  try {
    const { data, error } = await supabase
      .rpc('accept_friend_request', { requester_user_id: requesterUserId });
    
    if (error) throw error;
    
    // Type guard to ensure we have the expected structure
    if (data && typeof data === 'object' && 'success' in data) {
      return data as unknown as FriendRequestResult;
    }
    
    return { success: false, message: 'Invalid response format' };
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return { success: false, message: 'Failed to accept friend request' };
  }
};

export const rejectFriendRequest = async (requesterUserId: string): Promise<FriendRequestResult> => {
  try {
    const { data, error } = await supabase
      .rpc('reject_friend_request', { requester_user_id: requesterUserId });
    
    if (error) throw error;
    
    // Type guard to ensure we have the expected structure
    if (data && typeof data === 'object' && 'success' in data) {
      return data as unknown as FriendRequestResult;
    }
    
    return { success: false, message: 'Invalid response format' };
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    return { success: false, message: 'Failed to reject friend request' };
  }
};

export const getUserFriends = async (): Promise<Friend[]> => {
  try {
    const { data, error } = await supabase.rpc('get_user_friends');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting user friends:', error);
    return [];
  }
};

export const getFriendRequests = async (): Promise<FriendRequest[]> => {
  try {
    const { data, error } = await supabase.rpc('get_friend_requests');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting friend requests:', error);
    return [];
  }
};

export const checkFriendshipStatus = async (targetUserId: string): Promise<'none' | 'friend' | 'request_sent' | 'request_received'> => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) return 'none';

    const { data, error } = await supabase
      .from('user_connections')
      .select('user_id, connected_user_id, connection_type')
      .or(`and(user_id.eq.${user.user.id},connected_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},connected_user_id.eq.${user.user.id})`)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return 'none';

    if (data.connection_type === 'friend') return 'friend';
    if (data.connection_type === 'friend_request') {
      if (data.user_id === user.user.id) return 'request_sent';
      return 'request_received';
    }

    return 'none';
  } catch (error) {
    console.error('Error checking friendship status:', error);
    return 'none';
  }
};