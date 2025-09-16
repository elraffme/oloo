import React, { ReactNode } from 'react';
import { usePresence } from '@/hooks/usePresence';

interface PresenceProviderProps {
  children: ReactNode;
}

export const PresenceProvider: React.FC<PresenceProviderProps> = ({ children }) => {
  // Initialize presence tracking at app level
  usePresence();
  
  return <>{children}</>;
};