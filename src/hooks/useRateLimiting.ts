import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RateLimitResult {
  allowed: boolean;
  remainingQuota: number;
  resetTime: Date | null;
}

/**
 * Rate Limiting Hook
 * Prevents abuse by limiting actions per time window
 */
export const useRateLimiting = () => {
  const { user } = useAuth();

  /**
   * Check if user can perform profile view action
   * Limit: 50 profile views per hour
   */
  const checkProfileViewLimit = async (): Promise<RateLimitResult> => {
    if (!user) {
      return { allowed: false, remainingQuota: 0, resetTime: null };
    }

    try {
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id,
        p_action_type: 'profile_view',
        p_max_attempts: 50,
        p_window_minutes: 60
      });

      if (error) {
        console.error('Rate limit check error:', error);
        return { allowed: false, remainingQuota: 0, resetTime: null };
      }

      const result = data as any;
      return {
        allowed: result?.allowed || false,
        remainingQuota: result?.remaining || 0,
        resetTime: result?.reset_at ? new Date(result.reset_at) : null
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return { allowed: false, remainingQuota: 0, resetTime: null };
    }
  };

  /**
   * Check if user can send message
   * Limit: 100 messages per hour
   */
  const checkMessageLimit = async (): Promise<RateLimitResult> => {
    if (!user) {
      return { allowed: false, remainingQuota: 0, resetTime: null };
    }

    try {
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id,
        p_action_type: 'message_send',
        p_max_attempts: 100,
        p_window_minutes: 60
      });

      if (error) {
        console.error('Rate limit check error:', error);
        return { allowed: false, remainingQuota: 0, resetTime: null };
      }

      const result = data as any;
      return {
        allowed: result?.allowed || false,
        remainingQuota: result?.remaining || 0,
        resetTime: result?.reset_at ? new Date(result.reset_at) : null
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return { allowed: false, remainingQuota: 0, resetTime: null };
    }
  };

  /**
   * Check if user can perform friend request action
   * Limit: 20 friend requests per day
   */
  const checkFriendRequestLimit = async (): Promise<RateLimitResult> => {
    if (!user) {
      return { allowed: false, remainingQuota: 0, resetTime: null };
    }

    try {
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id,
        p_action_type: 'friend_request',
        p_max_attempts: 20,
        p_window_minutes: 1440 // 24 hours
      });

      if (error) {
        console.error('Rate limit check error:', error);
        return { allowed: false, remainingQuota: 0, resetTime: null };
      }

      const result = data as any;
      return {
        allowed: result?.allowed || false,
        remainingQuota: result?.remaining || 0,
        resetTime: result?.reset_at ? new Date(result.reset_at) : null
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return { allowed: false, remainingQuota: 0, resetTime: null };
    }
  };

  /**
   * Record a rate-limited action
   */
  const recordAction = async (actionType: 'profile_view' | 'message_send' | 'friend_request'): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase.rpc('record_rate_limit_action', {
        p_user_id: user.id,
        p_action_type: actionType
      });

      if (error) {
        console.error('Failed to record action:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to record action:', error);
      return false;
    }
  };

  return {
    checkProfileViewLimit,
    checkMessageLimit,
    checkFriendRequestLimit,
    recordAction
  };
};

/**
 * Client-side rate limiting utility
 * For immediate feedback before server check
 */
export class ClientRateLimiter {
  private actionTimestamps: Map<string, number[]> = new Map();

  checkLimit(action: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = this.actionTimestamps.get(action) || [];
    
    // Remove old timestamps outside the window
    const recentTimestamps = timestamps.filter(t => now - t < windowMs);
    
    if (recentTimestamps.length >= maxAttempts) {
      return false;
    }
    
    recentTimestamps.push(now);
    this.actionTimestamps.set(action, recentTimestamps);
    return true;
  }

  getRemainingQuota(action: string, maxAttempts: number, windowMs: number): number {
    const now = Date.now();
    const timestamps = this.actionTimestamps.get(action) || [];
    const recentTimestamps = timestamps.filter(t => now - t < windowMs);
    return Math.max(0, maxAttempts - recentTimestamps.length);
  }
}
