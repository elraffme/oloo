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

type PresenceMeta = { presence_key: string; role: 'host' | 'viewer' };

/**
 * Transient realtime reactions for a livestream (hearts + gifts) plus a
 * presence-based live viewer count.
 * Uses Supabase broadcast so every viewer and the host receive the same
 * one-shot event. Broadcast is not persisted, so reconnecting or refreshing
 * never replays old reactions.
 */
export function useStreamReactions(
  streamId?: string | null,
  displayNameOverride?: string,
  role: 'host' | 'viewer' = 'viewer'
) {
  const { user } = useAuth();
  const [hearts, setHearts] = useState<HeartEvent[]>([]);
  const [gifts, setGifts] = useState<GiftEvent[]>([]);
  const [heartCount, setHeartCount] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const queueRef = useRef<{ event: string; payload: any }[]>([]);
  const nameRef = useRef<string>(displayNameOverride || 'Someone');
  const timersRef = useRef<number[]>([]);
  const presenceKeyRef = useRef<string>(
    `${Math.random().toString(36).slice(2)}${Date.now()}`
  );

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
    if (!streamId) {
      setViewerCount(0);
      return;
    }

    const presenceKey = presenceKeyRef.current;
    const seenHearts = new Set<string>();
    const seenGifts = new Set<string>();

    const channel = supabase.channel(`stream_reactions_${streamId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: presenceKey },
      },
    });

    channel
      .on('broadcast', { event: 'heart' }, ({ payload }) => {
        const id = String(payload?.id ?? `${Date.now()}-${Math.random()}`);
        if (seenHearts.has(id)) return;
        seenHearts.add(id);
        setHeartCount(c => c + 1);
        pushHeart({
          id,
          x: Number(payload?.x ?? 0),
          senderName: String(payload?.senderName ?? 'Someone'),
        });
      })
      .on('broadcast', { event: 'gift' }, ({ payload }) => {
        const id = String(payload?.id ?? `${Date.now()}-${Math.random()}`);
        if (seenGifts.has(id)) return;
        seenGifts.add(id);
        pushGift({
          id,
          giftEmoji: String(payload?.giftEmoji ?? '🎁'),
          giftName: String(payload?.giftName ?? 'Gift'),
          senderName: String(payload?.senderName ?? 'Someone'),
          timestamp: Number(payload?.timestamp ?? Date.now()),
        });
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const viewerKeys = new Set<string>();
        Object.entries(state).forEach(([key, metas]) => {
          const isViewer = (metas as unknown as PresenceMeta[]).some(m => m?.role !== 'host');
          if (isViewer) viewerKeys.add(key);
        });
        setViewerCount(viewerKeys.size);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true;
          await channel.track({ presence_key: presenceKey, role });
          // Flush anything queued while the channel was still joining
          const queued = queueRef.current;
          queueRef.current = [];
          for (const item of queued) {
            void channel.send({ type: 'broadcast', event: item.event, payload: item.payload });
          }
        } else {
          subscribedRef.current = false;
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      subscribedRef.current = false;
      queueRef.current = [];
      supabase.removeChannel(channel);
      timersRef.current.forEach(t => window.clearTimeout(t));
      timersRef.current = [];
      setHearts([]);
      setGifts([]);
      setViewerCount(0);
    };
  }, [streamId, role, pushHeart, pushGift]);

  const emit = useCallback((event: string, payload: any) => {
    const channel = channelRef.current;
    if (channel && subscribedRef.current) {
      void channel.send({ type: 'broadcast', event, payload });
    } else {
      queueRef.current.push({ event, payload });
    }
  }, []);

  /** Exactly one heart per call. */
  const sendHeart = useCallback(() => {
    const payload = {
      id: `${user?.id ?? 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: Math.random() * 60 - 30,
      senderName: nameRef.current,
    };
    emit('heart', payload);
    // Local echo when we could not reach the channel yet (self:true handles the rest)
    if (!subscribedRef.current) {
      setHeartCount(c => c + 1);
      pushHeart(payload);
    }
  }, [user, emit, pushHeart]);

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
      emit('gift', payload);
      if (!subscribedRef.current) pushGift(payload);
    },
    [user, emit, pushGift]
  );

  return { hearts, gifts, heartCount, viewerCount, sendHeart, sendGift };
}
