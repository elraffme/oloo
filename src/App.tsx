import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import SecurityHeader from "@/components/SecurityHeader";
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import SignIn from "./pages/SignIn";
import Onboarding from "./pages/Onboarding";
import AppLayout from "./components/AppLayout";
import Discover from "./pages/Discover";
import Streaming from "./pages/Streaming";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import Premium from "./pages/Premium";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiesPolicy from "./pages/CookiesPolicy";

const App = () => (
  <AuthProvider>
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/cookies" element={<CookiesPolicy />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Discover />} />
          <Route path="streaming" element={<Streaming />} />
          <Route path="messages" element={<Messages />} />
          <Route path="profile" element={<Profile />} />
          <Route path="premium" element={<Premium />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  </AuthProvider>
);

export default App;
