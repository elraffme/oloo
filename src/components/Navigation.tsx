import { Heart, Video, Crown, Menu, LogOut } from "lucide-react";
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
          <div className="w-10 h-10 romantic-gradient rounded-full flex items-center justify-center">
            <Heart className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Òloo
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <a href="#discover" className="text-foreground hover:text-primary transition-colors">
            Discover
          </a>
          <a href="#streaming" className="text-foreground hover:text-primary transition-colors flex items-center gap-1">
            <Video className="w-4 h-4" />
            Live Stream
          </a>
          <a href="#premium" className="text-foreground hover:text-primary transition-colors flex items-center gap-1">
            <Crown className="w-4 h-4" />
            Premium
          </a>
        </div>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center space-x-3">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                Welcome, {user.user_metadata?.display_name || user.email}
              </span>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate('/auth')}>Sign In</Button>
              <Button 
                variant="default" 
                className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 hover:scale-105 transition-transform"
                onClick={() => navigate('/auth')}
              >
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