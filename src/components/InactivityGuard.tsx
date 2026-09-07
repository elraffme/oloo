import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInactivityLogout, clearLastActivity } from '@/hooks/useInactivityLogout';

/** Routes where the idle watchdog applies (livestream/streaming only). */
const isStreamingPath = (pathname: string) =>
  pathname.startsWith('/app/streaming') || pathname.startsWith('/app/video-call');

/**
 * Mounts the 5-minute inactivity watchdog ONLY while the user is inside a
 * streaming session. Browsing the rest of the app never auto-logs-out.
 */
const InactivityGuard = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const streaming = isStreamingPath(location.pathname);

  // Leaving the streaming experience clears the stamp so a stale deadline can
  // never expire a session later on.
  useEffect(() => {
    if (!streaming) clearLastActivity();
  }, [streaming]);

  useInactivityLogout({
    enabled: !!user && !loading && streaming,
    pathKey: location.pathname,
  });

  return null;
};

export default InactivityGuard;

