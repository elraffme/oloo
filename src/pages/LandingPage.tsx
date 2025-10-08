import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { Play, Pause, Menu, Users, Video, Calendar, Music, MessageCircle, Globe } from "lucide-react";
import landingImage from "@/assets/landing-sunset-couple.jpg";
import Footer from "@/components/Footer";
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
      <div className="relative min-h-screen flex flex-col">
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

      {/* How It Works Section */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-afro-heading font-bold text-center mb-4 text-foreground">
            Discover Meaningful Connections
          </h2>
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12 mt-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full nsibidi-gradient flex items-center justify-center text-primary-foreground text-2xl font-bold">1</div>
              <h3 className="text-xl sm:text-2xl font-afro-heading font-semibold text-foreground">Cultural Compatibility Quiz</h3>
              <p className="text-muted-foreground">Find out which cultural experiences resonate with your soul through a simple yet thoughtful quiz that reflects your values, interests, and artistic tastes.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full nsibidi-gradient flex items-center justify-center text-primary-foreground text-2xl font-bold">2</div>
              <h3 className="text-xl sm:text-2xl font-afro-heading font-semibold text-foreground">Personalized Matchmaking</h3>
              <p className="text-muted-foreground">Using your cultural preferences, passions, and personality traits, we match you with others who share similar lifestyles, traditions, and ideology.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full nsibidi-gradient flex items-center justify-center text-primary-foreground text-2xl font-bold">3</div>
              <h3 className="text-xl sm:text-2xl font-afro-heading font-semibold text-foreground">Share and Connect</h3>
              <p className="text-muted-foreground">Participate in engaging conversations, exchange creative works, explore unique cultural events, or enjoy a virtual dinner date with someone who speaks your cultural language.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-secondary/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-afro-heading font-bold text-center mb-4 text-foreground">
            Why "Culturally Yours" Is Different
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mt-12">
            <div className="bg-card p-6 rounded-lg border border-border space-y-3">
              <Globe className="w-12 h-12 text-primary" />
              <h3 className="text-xl font-afro-heading font-semibold text-foreground">Global Networks</h3>
              <p className="text-muted-foreground">Connect with people from all corners of the globe. Whether you're into classical art, traditional dance, ancient literature, or contemporary global movements—find your tribe.</p>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border space-y-3">
              <Video className="w-12 h-12 text-primary" />
              <h3 className="text-xl font-afro-heading font-semibold text-foreground">Virtual Dates</h3>
              <p className="text-muted-foreground">Explore new ways to connect, like cooking a dish together over video call, sharing your favorite poetry, or showing each other local art galleries.</p>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border space-y-3">
              <Calendar className="w-12 h-12 text-primary" />
              <h3 className="text-xl font-afro-heading font-semibold text-foreground">Shared Events</h3>
              <p className="text-muted-foreground">Attend exclusive online and offline cultural events: film festivals, music festivals, poetry slams, or even regional festivals. Meet your match while immersing yourself in art, culture, and history.</p>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border space-y-3">
              <Music className="w-12 h-12 text-primary" />
              <h3 className="text-xl font-afro-heading font-semibold text-foreground">Curated Playlists</h3>
              <p className="text-muted-foreground">Each week, enjoy curated playlists designed around different cultural genres. Find someone to vibe with over an Afrobeat playlist or discover classical Eastern music together.</p>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border space-y-3">
              <MessageCircle className="w-12 h-12 text-primary" />
              <h3 className="text-xl font-afro-heading font-semibold text-foreground">Intellectual & Artistic Dialogue</h3>
              <p className="text-muted-foreground">Engage in meaningful conversations, whether it's about philosophy, literature, or film. Our platform's focus is on building deeper emotional and intellectual connections.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Community Testimonials Section */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-afro-heading font-bold text-center mb-12 text-foreground">
            Our Members' Stories
          </h2>
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <p className="text-muted-foreground italic">"I met someone who shares my passion for classical Indian dance. We're collaborating on a project now, and it's the most inspiring relationship I've ever had."</p>
              <p className="text-foreground font-semibold">– Priye</p>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <p className="text-muted-foreground italic">"We connected over shared knowledge of zulu art, and now we travel to galleries together. I've never felt so understood!"</p>
              <p className="text-foreground font-semibold">– Vusi</p>
            </div>
            <div className="bg-card p-6 rounded-lg border border-border space-y-4">
              <p className="text-muted-foreground italic">"I was looking for a partner who could appreciate my heritage and traditions, and I found that with someone who shares my love for North African poetry."</p>
              <p className="text-foreground font-semibold">– Ahmed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cultural Exploration Section */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-secondary/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-afro-heading font-bold text-center mb-12 text-foreground">
            Get Inspired, Explore Together
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="bg-card p-8 rounded-lg border border-border text-center space-y-3 hover:border-primary transition-colors">
              <h3 className="text-xl font-afro-heading font-semibold text-foreground">Discover Cultural Curiosity Quizzes</h3>
              <p className="text-muted-foreground">Which traditional music genre is your spirit song?</p>
            </div>
            <div className="bg-card p-8 rounded-lg border border-border text-center space-y-3 hover:border-primary transition-colors">
              <h3 className="text-xl font-afro-heading font-semibold text-foreground">Embark on a Digital Cultural Journey</h3>
              <p className="text-muted-foreground">Participate in virtual cultural tours, from ancient ruins to contemporary street art scenes.</p>
            </div>
            <div className="bg-card p-8 rounded-lg border border-border text-center space-y-3 hover:border-primary transition-colors">
              <h3 className="text-xl font-afro-heading font-semibold text-foreground">What's Your Cultural Sign</h3>
              <p className="text-muted-foreground">Explore connections based on your cultural heritage or spiritual background.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Join the Movement Section */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-afro-heading font-bold text-foreground">
            Ready to Experience a Connection Like No Other?
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground">
            Embrace culture, art, and soul—find someone who truly gets you.
          </p>
          <Button 
            className="h-12 sm:h-14 px-8 sm:px-12 text-base sm:text-lg font-semibold rounded-full nsibidi-gradient text-primary-foreground border-0 shadow-lg hover:scale-105 transition-transform"
            onClick={() => window.location.href = '/onboarding'}
          >
            Create Your Profile Now
          </Button>
        </div>
      </section>

      <Footer />
    </div>;
};
export default LandingPage;