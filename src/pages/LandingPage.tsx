import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { Play, Pause, Menu } from "lucide-react";
import landingImage from "@/assets/landing-sunset-couple.jpg";
const LandingPage = () => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const videoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isVideoPlaying && videoRef.current) {
      let frame = 0;
      const interval = setInterval(() => {
        frame += 1;
        if (videoRef.current) {
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
  return <div className="min-h-screen flex flex-col overflow-hidden bg-black">
      {/* Top Header - Fixed */}
      <header className="bg-black/95 py-3 sm:py-4 lg:py-5 relative z-20 border-b border-primary/20">
        <button className="absolute left-3 sm:left-4 lg:left-6 top-1/2 -translate-y-1/2 text-white hover:text-primary transition-colors">
          <Menu size={20} className="sm:w-6 sm:h-6" />
        </button>
        <h1 className="text-primary font-afro-heading text-center font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl px-12">Òloo</h1>
        <p className="text-center text-white mt-1 font-light text-[10px] sm:text-xs lg:text-sm">Cultured in Connection</p>
      </header>

      {/* Hero Section with Background Image */}
      <div className="relative flex-1 flex flex-col">
        {/* Background Image Layer */}
        <div className="absolute inset-0">
          <div 
            ref={videoRef} 
            className={`w-full h-full transition-all duration-1000 ${isVideoPlaying ? 'scale-105' : 'scale-100'}`} 
            style={{
              backgroundImage: `url(${landingImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center center',
              backgroundRepeat: 'no-repeat',
            }} 
          />
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-primary/40 to-transparent" />
        </div>

        {/* Content Overlay - CTAs at Bottom */}
        <div className="relative z-10 flex-1 flex flex-col justify-end px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          {/* Bottom CTA Section */}
          <div className="space-y-3 sm:space-y-4 pb-4 sm:pb-6 lg:pb-8 max-w-md mx-auto w-full">
            {/* Primary CTA */}
            <Button 
              className="w-full h-12 sm:h-13 lg:h-14 text-base sm:text-lg font-semibold rounded-full nsibidi-gradient text-primary-foreground border-0 shadow-lg hover:scale-105 transition-transform" 
              onClick={() => window.location.href = '/onboarding'}
            >
              Create account
            </Button>

            {/* Secondary CTA */}
            <Button 
              variant="ghost" 
              onClick={() => window.location.href = '/auth'} 
              className="w-full h-12 sm:h-13 lg:h-14 font-medium text-white hover:bg-white/10 rounded-full text-base sm:text-lg"
            >
              Already a member? Log in
            </Button>
          </div>
        </div>

        {/* Subtle Animation Elements */}
        <div className="absolute inset-0 pointer-events-none hidden lg:block">
          <div className="animate-pulse absolute top-1/4 left-16 w-2 h-2 bg-white/20 rounded-full" style={{
            animationDelay: '0s',
            animationDuration: '3s'
          }} />
          <div className="animate-pulse absolute top-1/3 right-20 w-1 h-1 bg-white/30 rounded-full" style={{
            animationDelay: '1s',
            animationDuration: '4s'
          }} />
          <div className="animate-pulse absolute bottom-1/3 left-24 w-1.5 h-1.5 bg-white/25 rounded-full" style={{
            animationDelay: '2s',
            animationDuration: '5s'
          }} />
        </div>
      </div>
    </div>;
};
export default LandingPage;