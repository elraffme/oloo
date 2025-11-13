import { Heart, Video, Crown, Menu, LogOut, Shield, MessageCircle, Gift, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import { CurrencyWallet } from "./CurrencyWallet";
import { CoinShop } from "./CoinShop";
import { GiftInbox } from "./GiftInbox";


const Navigation = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCoinShop, setShowCoinShop] = useState(false);
  const [showGiftInbox, setShowGiftInbox] = useState(false);

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
            <Sparkles className="w-4 h-4" />
            <span className="nsibidi-symbol">◊</span>
            Feed
          </button>
          <button 
            onClick={() => navigate('/app/discover')}
            className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <Heart className="w-4 h-4" />
            <span className="nsibidi-symbol">◊</span>
            Discover
          </button>
          <button 
            onClick={() => navigate('/app/messages')}
            className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="nsibidi-symbol">◊</span>
            Messages
          </button>
          <button 
            onClick={() => navigate('/app/streaming')}
            className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <Video className="w-4 h-4" />
            <span className="nsibidi-symbol">⬟</span>
            Streaming
          </button>
          <button 
            onClick={() => navigate('/app/premium')}
            className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <Crown className="w-4 h-4" />
            <span className="nsibidi-symbol">◈</span>
            Premium
          </button>
        </div>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center space-x-3 font-afro-body">
          {user ? (
            <>
              <CurrencyWallet onBuyCoins={() => setShowCoinShop(true)} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGiftInbox(true)}
              >
                <Gift className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={handleSignOut} className="font-afro-body">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate('/auth')} className="font-afro-body">
                Sign In
              </Button>
              <Button 
                variant="default" 
                className="nsibidi-gradient text-primary-foreground border-0 hover:scale-105 transition-transform font-afro-body"
                onClick={() => navigate('/auth')}
              >
                <span className="nsibidi-symbol mr-1">♦</span>
                Join Now
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
                Culture
              </Button>
              <Button
                variant="ghost"
                className="justify-start text-lg font-afro-body"
                onClick={() => scrollToSection('discover')}
              >
                <span className="nsibidi-symbol mr-2">◊</span>
                Discover
              </Button>
              <Button
                variant="ghost"
                className="justify-start text-lg font-afro-body"
                onClick={() => scrollToSection('collective')}
              >
                <span className="nsibidi-symbol mr-2">◊</span>
                Collective
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
                  Sign Out
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
                    Sign In
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
                    Join Now
                  </Button>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <CoinShop open={showCoinShop} onOpenChange={setShowCoinShop} />
      <GiftInbox open={showGiftInbox} onOpenChange={setShowGiftInbox} />
    </nav>
  );
};

export default Navigation;