import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const INACTIVITY_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
export const LAST_ACTIVITY_KEY = 'oloo:last-activity';

/** Reads the persisted last-activity timestamp (shared across tabs). */
export const readLastActivity = (): number | null => {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
};

export const writeLastActivity = (ts: number = Date.now()) => {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(ts));
  } catch {
    /* storage unavailable — timer falls back to in-memory value */
  }
};

export const clearLastActivity = () => {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    /* noop */
  }
};

/** True when the persisted activity stamp is older than the inactivity limit. */
export const isSessionInactive = (now = Date.now()): boolean => {
  const last = readLastActivity();
  if (last === null) return false; // no stamp yet (fresh sign-in) — not expired
  return now - last >= INACTIVITY_LIMIT_MS;
};

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'wheel',
  'scroll',
  'touchstart',
  'touchmove',
  'click',
  'pointerdown',
] as const;

const THROTTLE_MS = 5000;
const POLL_MS = 10000;

interface Options {
  /** Only track while a user is signed in. */
  enabled: boolean;
  /** Current route — navigation itself counts as activity. */
  pathKey?: string;
}

/**
 * Wall-clock based inactivity logout. Never relies on a single setTimeout:
 * the deadline is a persisted timestamp that is re-evaluated on every poll,
 * on visibilitychange/focus/pageshow (device wake, tab restore) and on
 * cross-tab storage events.
 */
export function useInactivityLogout({ enabled, pathKey }: Options) {
  const loggingOutRef = useRef(false);

  const forceLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    clearLastActivity();
    try {
      // scope: 'global' revokes the refresh token server-side so the expired
      // session cannot be resumed from any device or after a refresh.
      await supabase.auth.signOut({ scope: 'global' });
    } catch (e) {
      console.error('[inactivity] signOut failed, forcing local sign-out:', e);
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* noop */
      }
    }
    if (typeof window !== 'undefined') {
      window.location.replace('/signin?reason=timeout');
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let lastWrite = 0;

    const markActive = () => {
      const now = Date.now();
      // Wake-up race: if we were already past the deadline, expire instead of
      // resetting (the wake event itself must not extend the session).
      if (isSessionInactive(now)) {
        void forceLogout();
        return;
      }
      if (now - lastWrite < THROTTLE_MS) return;
      lastWrite = now;
      writeLastActivity(now);
    };

    const check = () => {
      if (isSessionInactive()) void forceLogout();
    };

    // Seed the stamp on mount / sign-in.
    if (readLastActivity() === null) writeLastActivity();
    check();

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, markActive, { passive: true }),
    );

    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_KEY) check();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    window.addEventListener('online', check);
    window.addEventListener('storage', onStorage);

    const interval = window.setInterval(check, POLL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
      window.removeEventListener('online', check);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, [enabled, forceLogout]);

  // Route changes count as activity.
  useEffect(() => {
    if (!enabled) return;
    if (isSessionInactive()) {
      void forceLogout();
      return;
    }
    writeLastActivity();
  }, [enabled, pathKey, forceLogout]);
}
