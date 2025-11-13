import { useEffect } from 'react';
import { useSocialInteractions } from '@/hooks/useSocialInteractions';

/**
 * Background component that handles social interaction notifications
 * Add this to your main App or AppLayout to enable notifications
 */
export function SocialInteractionsNotifier() {
  const { unreadCount } = useSocialInteractions();

  useEffect(() => {
    // Request notification permission when component mounts
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // This component doesn't render anything, it just handles notifications in the background
  return null;
}
