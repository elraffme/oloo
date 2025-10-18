import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { LanguageProvider } from './contexts/LanguageContext'

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <div className="dark">
        <App />
      </div>
    </LanguageProvider>
  </React.StrictMode>
);
