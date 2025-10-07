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
  return <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background Video/Image Layer */}
      <div className="absolute inset-0">
      <div ref={videoRef} className={`w-full h-full transition-all duration-1000 ${isVideoPlaying ? 'scale-105' : 'scale-100'}`} style={{
        backgroundImage: `url(${landingImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        objectFit: 'cover'
      }} />
        {/* Dark Juniper Green overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/30 to-primary/50" />
      </div>

      {/* Video Control */}
      <div className="absolute top-6 right-6 z-20">
        
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* Top Banner with Logo */}
        <div className="bg-black/90 pt-4 pb-3 lg:pt-6 lg:pb-4 relative">
          <button className="absolute left-3 sm:left-4 lg:left-6 top-1/2 -translate-y-1/2 text-white hover:text-primary transition-colors">
            <Menu size={20} className="sm:w-6 sm:h-6" />
          </button>
          <h1 className="text-primary font-afro-heading text-center font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl px-12">Òloo</h1>
          <p className="text-center text-white mt-0 font-light text-xs sm:text-sm lg:text-base">Cultured in Connection</p>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 flex-1 flex flex-col justify-end">

        {/* Bottom CTA Section */}
        <div className="space-y-3 sm:space-y-4 pb-8 sm:pb-12 lg:pb-16 max-w-md mx-auto w-full">
          
          {/* Primary CTA */}
          <Button className="w-full h-11 sm:h-12 lg:h-14 text-sm sm:text-base lg:text-lg font-semibold rounded-full nsibidi-gradient text-primary-foreground border-0 shadow-lg hover:scale-105 transition-transform" onClick={() => window.location.href = '/onboarding'}>
            Create account
          </Button>

          {/* Secondary CTA */}
          <Button variant="ghost" onClick={() => window.location.href = '/auth'} className="w-full h-11 sm:h-12 lg:h-14 font-medium text-white hover:bg-white/10 rounded-full text-sm sm:text-base lg:text-lg">
            Already a member? Log in
          </Button>


        </div>
        </div>
      </div>

      {/* Subtle Animation Elements */}
      <div className="absolute inset-0 pointer-events-none hidden sm:block">
        {/* Floating particles for subtle movement */}
        <div className="animate-pulse absolute top-1/4 left-8 lg:left-16 w-2 h-2 bg-white/20 rounded-full" style={{
        animationDelay: '0s',
        animationDuration: '3s'
      }} />
        <div className="animate-pulse absolute top-1/3 right-12 lg:right-20 w-1 h-1 bg-white/30 rounded-full" style={{
        animationDelay: '1s',
        animationDuration: '4s'
      }} />
        <div className="animate-pulse absolute bottom-1/3 left-16 lg:left-24 w-1.5 h-1.5 bg-white/25 rounded-full" style={{
        animationDelay: '2s',
        animationDuration: '5s'
      }} />
      </div>
    </div>;
};
export default LandingPage;