import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface HeartEvent {
  id: string;
  x: number;
  senderName: string;
}

export interface GiftEvent {
  id: string;
  giftEmoji: string;
  giftName: string;
  senderName: string;
  timestamp: number;
}

interface GiftLike {
  id: number | string;
  name: string;
  asset_url?: string | null;
}

const HEART_TTL = 1800;
const GIFT_TTL = 4000;

/**
 * Transient realtime reactions for a livestream (hearts + gifts).
 * Uses Supabase broadcast so every viewer and the host receive the same
 * one-shot event. Broadcast is not persisted, so reconnecting or refreshing
 * never replays old reactions.
 */
export function useStreamReactions(streamId?: string | null, displayNameOverride?: string) {
  const { user } = useAuth();
  const [hearts, setHearts] = useState<HeartEvent[]>([]);
  const [gifts, setGifts] = useState<GiftEvent[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const nameRef = useRef<string>(displayNameOverride || 'Someone');
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (displayNameOverride) nameRef.current = displayNameOverride;
  }, [displayNameOverride]);

  // Resolve current user's display name once
  useEffect(() => {
    if (displayNameOverride || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled && data?.display_name) nameRef.current = data.display_name;
    })();
    return () => {
      cancelled = true;
    };
  }, [user, displayNameOverride]);

  const pushHeart = useCallback((heart: HeartEvent) => {
    setHearts(prev => (prev.some(h => h.id === heart.id) ? prev : [...prev, heart]));
    const t = window.setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== heart.id));
    }, HEART_TTL);
    timersRef.current.push(t);
  }, []);

  const pushGift = useCallback((gift: GiftEvent) => {
    setGifts(prev => (prev.some(g => g.id === gift.id) ? prev : [...prev, gift]));
    const t = window.setTimeout(() => {
      setGifts(prev => prev.filter(g => g.id !== gift.id));
    }, GIFT_TTL);
    timersRef.current.push(t);
  }, []);

  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`stream_reactions_${streamId}`, { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'heart' }, ({ payload }) => {
        pushHeart({
          id: String(payload?.id ?? `${Date.now()}-${Math.random()}`),
          x: Number(payload?.x ?? 0),
          senderName: String(payload?.senderName ?? 'Someone'),
        });
      })
      .on('broadcast', { event: 'gift' }, ({ payload }) => {
        pushGift({
          id: String(payload?.id ?? `${Date.now()}-${Math.random()}`),
          giftEmoji: String(payload?.giftEmoji ?? '🎁'),
          giftName: String(payload?.giftName ?? 'Gift'),
          senderName: String(payload?.senderName ?? 'Someone'),
          timestamp: Number(payload?.timestamp ?? Date.now()),
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
      timersRef.current.forEach(t => window.clearTimeout(t));
      timersRef.current = [];
      setHearts([]);
      setGifts([]);
    };
  }, [streamId, pushHeart, pushGift]);

  /** Exactly one heart per call. */
  const sendHeart = useCallback(() => {
    const payload = {
      id: `${user?.id ?? 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: Math.random() * 60 - 30,
      senderName: nameRef.current,
    };
    if (channelRef.current) {
      void channelRef.current.send({ type: 'broadcast', event: 'heart', payload });
    } else {
      pushHeart(payload);
    }
  }, [user, pushHeart]);

  /** Broadcast a sent gift to everyone watching (one event per gift). */
  const sendGift = useCallback(
    (gift: GiftLike) => {
      const payload: GiftEvent = {
        id: `${gift.id}-${user?.id ?? 'anon'}-${Date.now()}`,
        giftEmoji: gift.asset_url || '🎁',
        giftName: gift.name,
        senderName: nameRef.current,
        timestamp: Date.now(),
      };
      if (channelRef.current) {
        void channelRef.current.send({ type: 'broadcast', event: 'gift', payload });
      } else {
        pushGift(payload);
      }
    },
    [user, pushGift]
  );

  return { hearts, gifts, sendHeart, sendGift };
}
