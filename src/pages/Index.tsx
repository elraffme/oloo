import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import SwipeInterface from "@/components/SwipeInterface";
import StreamingSection from "@/components/StreamingSection";
import MembershipTiers from "@/components/MembershipTiers";

const Index = () => {
  return (
    <div className="min-h-screen">
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
                <span className="text-primary-foreground font-bold">L</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                LuxeMatch
              </span>
            </div>
            <p className="text-muted-foreground mb-6">
              Premium dating experience for sophisticated connections
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-primary transition-colors">Support</a>
              <a href="#" className="hover:text-primary transition-colors">About</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
