import React, { createContext, useContext, ReactNode } from 'react';
import { usePresence } from '@/hooks/usePresence';

interface PresenceContextType {
  onlineUsers: string[];
  isUserOnline: (userId: string) => boolean;
  updateActivity: () => Promise<void>;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const PresenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const presence = usePresence();
  
  return (
    <PresenceContext.Provider value={presence}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresenceContext = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresenceContext must be used within PresenceProvider');
  }
  return context;
};
