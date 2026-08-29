import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';

/**
 * Mounts the 5-minute inactivity watchdog for signed-in users.
 * Renders nothing and does not touch any feature logic.
 */
const InactivityGuard = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  useInactivityLogout({
    enabled: !!user && !loading,
    pathKey: location.pathname,
  });

  return null;
};

export default InactivityGuard;
