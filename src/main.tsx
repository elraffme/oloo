import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { PresenceProvider } from '@/components/PresenceProvider'

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="dark">
      <AuthProvider>
        <PresenceProvider>
          <App />
        </PresenceProvider>
      </AuthProvider>
    </div>
  </React.StrictMode>
);
