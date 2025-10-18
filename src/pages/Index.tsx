import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import SwipeInterface from "@/components/SwipeInterface";
import StreamingSection from "@/components/StreamingSection";
import MembershipTiers from "@/components/MembershipTiers";

const Index = () => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 romantic-gradient rounded-full flex items-center justify-center mb-4 mx-auto animate-pulse">
            <span className="text-primary-foreground font-bold text-xl">Ò</span>
          </div>
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="min-h-screen dark bg-background">
      <Navigation />
      <HeroSection />
      <SwipeInterface />
      <StreamingSection />
      <MembershipTiers />
      
      {/* Footer */}
      <footer className="bg-secondary/30 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-8 h-8 romantic-gradient rounded-full flex items-center justify-center">
                <span className="text-primary-foreground font-bold">Ò</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Òloo
              </span>
            </div>
            <p className="text-muted-foreground mb-6">
              {t('premiumDatingExperience')}
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-primary transition-colors">{t('privacyPolicy')}</Link>
              <Link to="/terms" className="hover:text-primary transition-colors">{t('termsOfService')}</Link>
              <Link to="/cookies" className="hover:text-primary transition-colors">{t('cookiesPolicy')}</Link>
              <Link to="/about" className="hover:text-primary transition-colors">{t('about')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
