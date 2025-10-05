import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import landingImage from "@/assets/landing-sunset-couple.jpg";
const LandingPage = () => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(true); // Auto-start the "video"
  const videoRef = useRef<HTMLDivElement>(null);

  // Simulate video with animated background image
  useEffect(() => {
    if (isVideoPlaying && videoRef.current) {
      let frame = 0;
      const interval = setInterval(() => {
        frame += 1;
        if (videoRef.current) {
          // Create breathing/pulsing effect
          const scale = 1 + Math.sin(frame * 0.1) * 0.02;
          const brightness = 1 + Math.sin(frame * 0.15) * 0.1;
          videoRef.current.style.transform = `scale(${scale})`;
          videoRef.current.style.filter = `brightness(${brightness})`;
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isVideoPlaying]);
  const toggleVideo = () => {
    setIsVideoPlaying(!isVideoPlaying);
  };
  return <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background Video/Image Layer */}
      <div className="absolute inset-x-0 top-[88px] bottom-0">
      <div ref={videoRef} className={`w-full h-full transition-all duration-1000 ${isVideoPlaying ? 'scale-105' : 'scale-100'}`} style={{
        backgroundImage: `url(${landingImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        objectFit: 'cover'
      }} />
        {/* Dark Juniper Green overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/50 to-primary/70" />
      </div>

      {/* Video Control */}
      <div className="absolute top-6 right-6 z-20">
        <Button variant="outline" size="sm" onClick={toggleVideo} className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30">
          {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="pl-6 pr-8 py-8 flex-1 flex flex-col">

        {/* Main Content - Centered Tagline */}
        <div className="flex-1 flex flex-col justify-center items-center text-center max-w-sm mx-auto">
          <div className="mb-12">
            
          </div>
        </div>

        {/* Bottom CTA Section */}
        <div className="space-y-4">
          
          {/* Primary CTA */}
          <Button className="w-full h-14 text-lg font-semibold rounded-full nsibidi-gradient text-primary-foreground border-0 shadow-lg hover:scale-105 transition-transform" onClick={() => window.location.href = '/onboarding'}>
            Create account
          </Button>

          {/* Secondary CTA */}
          <Button variant="ghost" className="w-full h-12 text-lg font-medium text-white hover:bg-white/10 rounded-full" onClick={() => window.location.href = '/auth'}>
            Already a member? Log in
          </Button>

          {/* Legal Text */}
          <div className="pt-4 pb-2">
            <p className="text-xs text-white/60 text-center leading-relaxed">
              By tapping 'Sign in' / 'Create account', you agree to our{' '}
              <a href="/terms" className="underline hover:text-white/80 transition-colors">Terms of Service</a>. 
              Learn how we process your data in our{' '}
              <a href="/privacy" className="underline hover:text-white/80 transition-colors">Privacy Policy</a> and{' '}
              <a href="/cookies" className="underline hover:text-white/80 transition-colors">Cookies Policy</a>.
            </p>
          </div>

        </div>
        </div>
      </div>

      {/* Subtle Animation Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Floating particles for subtle movement */}
        <div className="animate-pulse absolute top-1/4 left-8 w-2 h-2 bg-white/20 rounded-full" style={{
        animationDelay: '0s',
        animationDuration: '3s'
      }} />
        <div className="animate-pulse absolute top-1/3 right-12 w-1 h-1 bg-white/30 rounded-full" style={{
        animationDelay: '1s',
        animationDuration: '4s'
      }} />
        <div className="animate-pulse absolute bottom-1/3 left-16 w-1.5 h-1.5 bg-white/25 rounded-full" style={{
        animationDelay: '2s',
        animationDuration: '5s'
      }} />
      </div>
    </div>;
};
export default LandingPage;