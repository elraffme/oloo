import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { PresenceProvider } from '@/contexts/PresenceContext';
import SecurityHeader from "@/components/SecurityHeader";
import { IncomingCallModal } from "@/components/IncomingCallModal";
import '@/i18n/config';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import SignIn from "./pages/SignIn";
import Onboarding from "./pages/Onboarding";
import About from "./pages/About";
import AppLayout from "./components/AppLayout";
import Feed from "./pages/Feed";
import Discover from "./pages/Discover";
import Streaming from "./pages/Streaming";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import Premium from "./pages/Premium";
import VideoCallPage from "./pages/VideoCallPage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiesPolicy from "./pages/CookiesPolicy";
import ResetPassword from "./pages/ResetPassword";
import ResetPasswordConfirm from "./pages/ResetPasswordConfirm";
import BrowseByInterest from "./pages/BrowseByInterest";
import MeetMe from "./pages/MeetMe";
import Trivia from "./pages/Trivia";
import TriviaLeaderboard from "./pages/TriviaLeaderboard";
import Shop from "./pages/Shop";
import Admin from "./pages/Admin";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PresenceProvider>
        <Router>
          <IncomingCallModal />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset-password/confirm" element={<ResetPasswordConfirm />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/cookies" element={<CookiesPolicy />} />
            <Route path="/video-call" element={<VideoCallPage />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Feed />} />
              <Route path="feed" element={<Feed />} />
              <Route path="discover" element={<Discover />} />
              <Route path="browse-interest" element={<BrowseByInterest />} />
              <Route path="meet-me" element={<MeetMe />} />
              <Route path="trivia" element={<Trivia />} />
              <Route path="trivia/leaderboard" element={<TriviaLeaderboard />} />
              <Route path="shop" element={<Shop />} />
              <Route path="streaming" element={<Streaming />} />
              <Route path="streaming/discover" element={<Streaming />} />
              <Route path="streaming/go-live" element={<Streaming />} />
              <Route path="messages" element={<Messages />} />
              <Route path="profile" element={<Profile />} />
              <Route path="premium" element={<Premium />} />
              <Route path="admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </PresenceProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
