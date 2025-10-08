import { Heart, Video, Crown, Menu, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";


const Navigation = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Error signing out');
    } else {
      toast.success('Signed out successfully');
      navigate('/auth');
    }
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
            Discover
          </button>
          <button 
            onClick={() => navigate('/app/streaming')}
            className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <Video className="w-4 h-4" />
            <span className="nsibidi-symbol">⬟</span>
            Live Stream
          </button>
          <button
            onClick={() => navigate('/verification')}
            className="text-foreground hover:text-orange-verified transition-colors flex items-center gap-1"
          >
            <Shield className="w-4 h-4" />
            <span className="nsibidi-symbol">◈</span>
            Get Verified
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
              <span className="text-sm text-muted-foreground nsibidi-text">
                <span className="nsibidi-symbol mr-1">⟡</span>
                Welcome, {user.user_metadata?.display_name || user.email}
              </span>
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
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
      </div>
    </nav>
  );
};

export default Navigation;