import { Heart, Video, Crown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 romantic-gradient rounded-full flex items-center justify-center">
            <Heart className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            LuxeMatch
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
          <Button variant="ghost">Sign In</Button>
          <Button variant="default" className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 hover:scale-105 transition-transform">
            Join Now
          </Button>
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