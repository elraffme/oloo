import { Heart, Video, Crown, Menu, LogOut, Shield, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";


const Navigation = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useLanguage();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Error signing out');
    } else {
      toast.success('Signed out successfully');
      navigate('/auth');
    }
  };

  const scrollToSection = (sectionId: string) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <div className="heart-logo">
            <span className="logo-text">Ò</span>
          </div>
          <span className="text-xl font-afro-display nsibidi-gradient bg-clip-text text-transparent">
            Òloo
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8 font-afro-body">
          <button 
            onClick={() => navigate('/app')}
            className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <span className="nsibidi-symbol">◊</span>
            {t('discover')}
          </button>
          <button 
            onClick={() => navigate('/app/messages')}
            className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="nsibidi-symbol">◊</span>
            {t('messages')}
          </button>
          <button 
            onClick={() => navigate('/app/streaming')}
            className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <Video className="w-4 h-4" />
            <span className="nsibidi-symbol">⬟</span>
            {t('liveStream')}
          </button>
          <button
            onClick={() => navigate('/verification')}
            className="text-foreground hover:text-orange-verified transition-colors flex items-center gap-1"
          >
            <Shield className="w-4 h-4" />
            <span className="nsibidi-symbol">◈</span>
            {t('getVerified')}
          </button>
          <button 
            onClick={() => navigate('/app/premium')}
            className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <Crown className="w-4 h-4" />
            <span className="nsibidi-symbol">◈</span>
            {t('premium')}
          </button>
        </div>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center space-x-3 font-afro-body">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground nsibidi-text">
                <span className="nsibidi-symbol mr-1">⟡</span>
                {t('welcome')}, {user.user_metadata?.display_name || user.email}
              </span>
              <Button variant="ghost" onClick={handleSignOut} className="font-afro-body">
                <LogOut className="w-4 h-4 mr-2" />
                {t('signOut')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate('/auth')} className="font-afro-body">
                {t('signIn')}
              </Button>
              <Button 
                variant="default" 
                className="nsibidi-gradient text-primary-foreground border-0 hover:scale-105 transition-transform font-afro-body"
                onClick={() => navigate('/auth')}
              >
                <span className="nsibidi-symbol mr-1">♦</span>
                {t('joinNow')}
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <nav className="flex flex-col gap-4 mt-8">
              <Button
                variant="ghost"
                className="justify-start text-lg font-afro-body"
                onClick={() => scrollToSection('culture')}
              >
                <span className="nsibidi-symbol mr-2">◊</span>
                {t('culture')}
              </Button>
              <Button
                variant="ghost"
                className="justify-start text-lg font-afro-body"
                onClick={() => scrollToSection('discover')}
              >
                <span className="nsibidi-symbol mr-2">◊</span>
                {t('discover')}
              </Button>
              <Button
                variant="ghost"
                className="justify-start text-lg font-afro-body"
                onClick={() => scrollToSection('collective')}
              >
                <span className="nsibidi-symbol mr-2">◊</span>
                {t('collective')}
              </Button>
              <Button
                variant="ghost"
                className="justify-start text-lg font-afro-body"
                onClick={() => scrollToSection('get-started')}
              >
                <span className="nsibidi-symbol mr-2">◈</span>
                Get Started
              </Button>
              
              <div className="border-t border-border my-4" />
              
              {user ? (
                <Button
                  variant="ghost"
                  className="justify-start text-lg font-afro-body"
                  onClick={() => {
                    handleSignOut();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  {t('signOut')}
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    className="justify-start text-lg font-afro-body"
                    onClick={() => {
                      navigate('/auth');
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {t('signIn')}
                  </Button>
                  <Button
                    variant="default"
                    className="nsibidi-gradient text-primary-foreground border-0 font-afro-body"
                    onClick={() => {
                      navigate('/auth');
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <span className="nsibidi-symbol mr-1">♦</span>
                    {t('joinNow')}
                  </Button>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};

export default Navigation;