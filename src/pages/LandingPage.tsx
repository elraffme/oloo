import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import landingImage from "@/assets/landing-video-frame.jpg";

const LandingPage = () => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(true); // Auto-start the "video"
  const videoRef = useRef<HTMLDivElement>(null);

  // Enhanced video-like animations
  useEffect(() => {
    if (isVideoPlaying && videoRef.current) {
      let frame = 0;
      const interval = setInterval(() => {
        frame += 1;
        if (videoRef.current) {
          // Multiple layered animations for realistic effect
          const breathingScale = 1 + Math.sin(frame * 0.08) * 0.015; // Slow breathing
          const microMovement = Math.sin(frame * 0.12) * 0.3; // Subtle movement
          const brightness = 1 + Math.sin(frame * 0.06) * 0.08; // Gentle brightness variation
          const contrast = 1 + Math.cos(frame * 0.04) * 0.05; // Subtle contrast changes
          const saturation = 1 + Math.sin(frame * 0.1) * 0.1; // Color saturation variation
          
          // Apply combined transformations
          videoRef.current.style.transform = `scale(${breathingScale}) translateX(${microMovement}px)`;
          videoRef.current.style.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
          
          // Subtle opacity pulse for depth
          const opacityPulse = 0.95 + Math.sin(frame * 0.05) * 0.05;
          videoRef.current.style.opacity = opacityPulse.toString();
        }
      }, 80); // Slightly faster for smoother animation
      return () => clearInterval(interval);
    } else if (videoRef.current) {
      // Reset to default state when paused
      videoRef.current.style.transform = 'scale(1) translateX(0px)';
      videoRef.current.style.filter = 'brightness(1) contrast(1) saturate(1)';
      videoRef.current.style.opacity = '1';
    }
  }, [isVideoPlaying]);

  const toggleVideo = () => {
    setIsVideoPlaying(!isVideoPlaying);
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background Video/Image Layer */}
      <div className="absolute inset-0">
        <div 
          ref={videoRef}
          className={`w-full h-full transition-all duration-1000 ${isVideoPlaying ? 'scale-105' : 'scale-100'}`}
          style={{
            backgroundImage: `url(${landingImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/60" />
      </div>

      {/* Video Control */}
      <div className="absolute top-6 right-6 z-20">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleVideo}
          className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30"
        >
          {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col justify-between min-h-screen px-6 py-8">
        
        {/* Top Section */}
        <div className="flex-1 flex flex-col justify-center items-center text-center max-w-sm mx-auto">
          
          {/* Logo/Brand */}
          <div className="mb-8">
            <h1 className="text-6xl md:text-7xl font-bold text-white mb-2 font-afro-heading">
              Òloo
            </h1>
            <p className="text-xl md:text-2xl text-white/90 font-light tracking-wide">
              Cultured in connection
            </p>
          </div>

          {/* Tagline */}
          <div className="mb-12">
            <p className="text-lg text-white/80 leading-relaxed">
              Experience meaningful connections rooted in culture and heritage
            </p>
          </div>

        </div>

        {/* Bottom CTA Section */}
        <div className="space-y-4">
          
          {/* Primary CTA */}
          <Button 
            className="w-full h-14 text-lg font-semibold rounded-full bg-orange-600 hover:bg-orange-700 text-white border-0 shadow-lg"
            style={{ backgroundColor: '#CC5500' }}
          >
            Create account
          </Button>

          {/* Secondary CTA */}
          <Button 
            variant="ghost" 
            className="w-full h-12 text-lg font-medium text-white hover:bg-white/10 rounded-full"
          >
            Sign in
          </Button>

          {/* Legal Text */}
          <div className="pt-4 pb-2">
            <p className="text-xs text-white/60 text-center leading-relaxed">
              By tapping 'Sign in' / 'Create account', you agree to our{' '}
              <span className="underline">Terms of Service</span>. Learn how we process your data in our{' '}
              <span className="underline">Privacy Policy</span> and{' '}
              <span className="underline">Cookies Policy</span>.
            </p>
          </div>

        </div>
      </div>

      {/* Subtle Animation Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Floating particles for subtle movement */}
        <div className="animate-pulse absolute top-1/4 left-8 w-2 h-2 bg-white/20 rounded-full" 
             style={{ animationDelay: '0s', animationDuration: '3s' }} />
        <div className="animate-pulse absolute top-1/3 right-12 w-1 h-1 bg-white/30 rounded-full" 
             style={{ animationDelay: '1s', animationDuration: '4s' }} />
        <div className="animate-pulse absolute bottom-1/3 left-16 w-1.5 h-1.5 bg-white/25 rounded-full" 
             style={{ animationDelay: '2s', animationDuration: '5s' }} />
      </div>
    </div>
  );
};

export default LandingPage;