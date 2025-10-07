import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { Play, Pause, Menu } from "lucide-react";
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
  return <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background Video/Image Layer */}
      <div className="absolute inset-0">
      <div ref={videoRef} className={`w-full h-full transition-all duration-1000 ${isVideoPlaying ? 'scale-105' : 'scale-100'}`} style={{
        backgroundImage: `url(${landingImage})`,
        backgroundSize: 'cover',
        backgroundPosition: '55% center',
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
        <div className="bg-black/90 pt-4 pb-2 relative">
          <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-primary transition-colors">
            <Menu size={24} />
          </button>
          <h1 className="text-primary font-afro-heading text-center font-bold md:text-7xl text-3xl">Òloo</h1>
          <p className="text-center text-white mt-0 font-light text-sm">Cultured in Connection</p>
        </div>

        <div className="px-6 py-6 flex-1 flex flex-col justify-end">

        {/* Bottom CTA Section */}
        <div className="space-y-3 pb-12">
          
          {/* Primary CTA */}
          <Button className="w-full h-10 text-sm font-semibold rounded-full nsibidi-gradient text-primary-foreground border-0 shadow-lg hover:scale-105 transition-transform" onClick={() => window.location.href = '/onboarding'}>
            Create account
          </Button>

          {/* Secondary CTA */}
          <Button variant="ghost" onClick={() => window.location.href = '/auth'} className="w-full h-10 font-medium text-white hover:bg-white/10 rounded-full text-sm">
            Already a member? Log in
          </Button>


        </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="relative z-10 bg-background">
        
        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-afro-heading font-bold text-center mb-4 text-foreground">
              Discover Meaningful Connections
            </h2>
            <div className="grid md:grid-cols-3 gap-8 mt-12">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">Cultural Compatibility Quiz</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Find out which cultural experiences resonate with your soul through a simple yet thoughtful quiz that reflects your values, interests, and artistic tastes.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">Personalized Matchmaking</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Using your cultural preferences, passions, and personality traits, we match you with others who share similar lifestyles, traditions, and ideology.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">Share and Connect</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Participate in engaging conversations, exchange creative works, explore unique cultural events, or enjoy a virtual dinner date with someone who speaks your cultural language.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 px-6 bg-secondary/5">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-afro-heading font-bold text-center mb-4 text-foreground">
              Why "Culturally Yours" Is Different
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-foreground">Global Networks</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Connect with people from all corners of the globe. Whether you're into classical art, traditional dance, ancient literature, or contemporary global movements—find your tribe.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-foreground">Virtual Dates</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Explore new ways to connect, like cooking a dish together over video call, sharing your favorite poetry, or showing each other local art galleries.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-foreground">Shared Events</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Attend exclusive online and offline cultural events: film festivals, music festivals, poetry slams, or even regional festivals. Meet your match while immersing yourself in art, culture, and history.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-foreground">Curated Playlists</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Each week, enjoy curated playlists designed around different cultural genres. Find someone to vibe with over an Afrobeat playlist or discover classical Eastern music together.
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-foreground">Intellectual & Artistic Dialogue</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Engage in meaningful conversations, whether it's about philosophy, literature, or film. Our platform's focus is on building deeper emotional and intellectual connections.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-afro-heading font-bold text-center mb-4 text-foreground">
              Our Members' Stories
            </h2>
            <div className="grid md:grid-cols-3 gap-8 mt-12">
              <div className="bg-card p-6 rounded-lg border border-border">
                <p className="text-muted-foreground italic leading-relaxed mb-4">
                  "I met someone who shares my passion for classical Indian dance. We're collaborating on a project now, and it's the most inspiring relationship I've ever had."
                </p>
                <p className="font-semibold text-foreground">– Priye</p>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <p className="text-muted-foreground italic leading-relaxed mb-4">
                  "We connected over shared knowledge of zulu art, and now we travel to galleries together. I've never felt so understood!"
                </p>
                <p className="font-semibold text-foreground">– Vusi</p>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <p className="text-muted-foreground italic leading-relaxed mb-4">
                  "I was looking for a partner who could appreciate my heritage and traditions, and I found that with someone who shares my love for North African poetry."
                </p>
                <p className="font-semibold text-foreground">– Ahmed</p>
              </div>
            </div>
          </div>
        </section>

        {/* Cultural Exploration Section */}
        <section id="explore" className="py-16 px-6 bg-secondary/5">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-afro-heading font-bold text-center mb-4 text-foreground">
              Get Inspired, Explore Together
            </h2>
            <div className="grid md:grid-cols-3 gap-8 mt-12">
              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold text-foreground">Discover Cultural Curiosity Quizzes</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Which traditional music genre is your spirit song?
                </p>
              </div>
              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold text-foreground">Embark on a Digital Cultural Journey</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Participate in virtual cultural tours, from ancient ruins to contemporary street art scenes.
                </p>
              </div>
              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold text-foreground">What's Your Cultural Sign</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Explore connections based on your cultural heritage or spiritual background.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Join the Movement Section */}
        <section id="join" className="py-16 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-afro-heading font-bold mb-4 text-foreground">
              Ready to Experience a Connection Like No Other?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Embrace culture, art, and soul—find someone who truly gets you.
            </p>
            <Button 
              className="h-12 px-8 text-base font-semibold rounded-full nsibidi-gradient text-primary-foreground border-0 shadow-lg hover:scale-105 transition-transform"
              onClick={() => window.location.href = '/onboarding'}
            >
              Create Your Profile Now
            </Button>
          </div>
        </section>

        <Footer />
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