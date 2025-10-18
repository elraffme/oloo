import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Pause, Menu, Users, Video, Calendar, Music, MessageCircle, Globe, X } from "lucide-react";
import landingImage from "@/assets/hero-background.png";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
const LandingPage = () => {
  const navigate = useNavigate();
  const { t, setLanguage } = useLanguage();
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);

  const languageMap: Record<string, string> = {
    'Swahili': 'sw', 'Yoruba': 'yo', 'Zulu': 'zu', 'Amharic': 'am',
    'Hausa': 'ha', 'Igbo': 'ig', 'Somali': 'so', 'Oromo': 'om',
    'Shona': 'sn', 'Wolof': 'wo', 'Xhosa': 'xh', 'Tigrinya': 'ti',
    'Afrikaans': 'af', 'Akan': 'ak', 'Kinyarwanda': 'rw', 'Lingala': 'ln',
    'Fula': 'ff', 'Bemba': 'bem', 'Tswana': 'tn', 'Twi': 'tw', 'English': 'en'
  };

  const handleLanguageSelect = (langName: string) => {
    const langCode = languageMap[langName];
    if (langCode) {
      setLanguage(langCode as any);
      setIsLanguageOpen(false);
      setIsMenuOpen(false);
    }
  };
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
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
    setIsMenuOpen(false);
  };
  return <div className="min-h-screen flex flex-col overflow-hidden bg-black">
      {/* Top Header - Fixed */}
      <header className="bg-black/95 py-2 sm:py-3 lg:py-5 relative z-50 border-b border-primary/20">
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="absolute left-2 sm:left-4 lg:left-6 top-1/2 -translate-y-1/2 text-white hover:text-primary transition-colors p-2" aria-label="Toggle menu">
          {isMenuOpen ? <X size={18} className="sm:w-5 sm:h-5 lg:w-6 lg:h-6" /> : <Menu size={18} className="sm:w-5 sm:h-5 lg:w-6 lg:h-6" />}
        </button>
        <h1 className="text-primary font-afro-heading text-center font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl px-10 sm:px-12">Òloo</h1>
        <p className="text-center text-white -mt-0.5 sm:text-xs lg:text-base font-normal text-sm">{t('tagline')}</p>
        
        {/* Dropdown Menu */}
        {isMenuOpen && <div className="absolute top-full left-0 right-0 bg-background/95 backdrop-blur-md border-b border-border shadow-lg animate-fade-in z-50">
            <nav className="container mx-auto px-4 py-6 flex flex-col gap-2">
              <Button variant="ghost" className="justify-start text-base font-afro-heading hover:bg-primary/10" onClick={() => scrollToSection('culture')}>
                <span className="nsibidi-symbol mr-2">◊</span>
                {t('culture')}
              </Button>
              <Button variant="ghost" className="justify-start text-base font-afro-heading hover:bg-primary/10" onClick={() => scrollToSection('discover')}>
                <span className="nsibidi-symbol mr-2">◊</span>
                {t('discover')}
              </Button>
              <Button variant="ghost" className="justify-start text-base font-afro-heading hover:bg-primary/10" onClick={() => scrollToSection('collective')}>
                <span className="nsibidi-symbol mr-2">◊</span>
                {t('collective')}
              </Button>
              <div className="relative">
                <Button variant="ghost" className="justify-start text-base font-afro-heading hover:bg-primary/10 w-full" onClick={() => setIsLanguageOpen(!isLanguageOpen)}>
                  <span className="nsibidi-symbol mr-2">◈</span>
                  {t('languages')}
                </Button>
                
                {isLanguageOpen && <div className="ml-4 mt-2 space-y-1 bg-background/50 rounded-md p-2">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('English')}>English</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Swahili')}>Swahili</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Yoruba')}>Yoruba</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Zulu')}>Zulu</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Amharic')}>Amharic</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Hausa')}>Hausa</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Igbo')}>Igbo</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Somali')}>Somali</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Oromo')}>Oromo</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Shona')}>Shona</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Wolof')}>Wolof</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Xhosa')}>Xhosa</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Tigrinya')}>Tigrinya</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Afrikaans')}>Afrikaans</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Akan')}>Akan</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Kinyarwanda')}>Kinyarwanda</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Lingala')}>Lingala</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Fula')}>Fula</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Bemba')}>Bemba</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Tswana')}>Tswana</Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-sm hover:bg-primary/10" onClick={() => handleLanguageSelect('Twi')}>Twi</Button>
                  </div>}
              </div>
              
              <div className="border-t border-border my-2" />
              
              <Button variant="ghost" className="justify-start text-base font-afro-heading hover:bg-primary/10" onClick={() => {
            navigate('/signin');
            setIsMenuOpen(false);
          }}>
                {t('signIn')}
              </Button>
              <Button className="nsibidi-gradient text-primary-foreground border-0 font-afro-heading" onClick={() => {
            navigate('/onboarding');
            setIsMenuOpen(false);
          }}>
                <span className="nsibidi-symbol mr-1">♦</span>
                {t('joinNow')}
              </Button>
            </nav>
          </div>}
      </header>

      {/* Hero Section with Background Image */}
      <div className="relative min-h-[70vh] sm:min-h-[80vh] lg:min-h-screen flex flex-col">
        {/* Background Image Layer */}
        <div className="absolute inset-0">
          <div ref={videoRef} className={`w-full h-full transition-all duration-1000 ${isVideoPlaying ? 'scale-105' : 'scale-100'}`} style={{
          backgroundImage: `url(${landingImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'scroll'
        }} />
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-primary/30 to-transparent" />
        </div>

        {/* Content Overlay - CTAs at Bottom */}
        <div className="relative z-10 flex-1 flex flex-col justify-end px-3 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          {/* Bottom CTA Section */}
          <div className="space-y-2.5 sm:space-y-4 pb-6 sm:pb-8 lg:pb-10 max-w-sm sm:max-w-md mx-auto w-full">
            {/* Primary CTA */}
            <Button className="w-full h-11 sm:h-12 lg:h-14 text-sm sm:text-base lg:text-lg font-semibold rounded-full nsibidi-gradient text-primary-foreground border-0 shadow-lg hover:scale-105 transition-transform" onClick={() => navigate('/onboarding')}>
              {t('createAccount')}
            </Button>

            {/* Secondary CTA */}
            <Button variant="ghost" onClick={() => navigate('/signin')} className="w-full h-11 sm:h-12 lg:h-14 font-medium text-white hover:bg-white/10 rounded-full text-sm sm:text-base lg:text-lg">
              {t('alreadyMember')}
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

      {/* Features Section */}
      <section id="culture" className="py-12 sm:py-16 lg:py-24 px-3 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="sm:text-3xl lg:text-5xl font-afro-heading text-center mb-3 sm:mb-4 text-foreground px-2 text-xl font-medium">{t('whyCultureDifferent')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mt-8 sm:mt-12">
            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border space-y-2 sm:space-y-3">
              <Globe className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
              <h3 className="sm:text-xl font-afro-heading text-foreground font-medium text-base">{t('globalCulture')}</h3>
              <p className="text-sm sm:text-base text-muted-foreground">{t('globalCultureDesc')}</p>
            </div>
            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border space-y-2 sm:space-y-3">
              <Video className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
              <h3 className="sm:text-xl font-afro-heading text-foreground text-base font-normal">{t('virtualDates')}</h3>
              <p className="text-sm sm:text-base text-muted-foreground">{t('virtualDatesDesc')}</p>
            </div>
            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border space-y-2 sm:space-y-3">
              <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
              <h3 className="sm:text-xl font-afro-heading text-foreground text-base font-normal">{t('sharedEvents')}</h3>
              <p className="text-sm sm:text-base text-muted-foreground">{t('sharedEventsDesc')}</p>
            </div>
            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border space-y-2 sm:space-y-3">
              <Music className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
              <h3 className="sm:text-xl font-afro-heading text-foreground text-base font-normal">{t('curatedPlaylists')}</h3>
              <p className="text-sm sm:text-base text-muted-foreground">{t('curatedPlaylistsDesc')}</p>
            </div>
            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border space-y-2 sm:space-y-3">
              <MessageCircle className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
              <h3 className="sm:text-xl font-afro-heading text-foreground text-base font-normal">{t('intellectualDialogue')}</h3>
              <p className="text-sm sm:text-base text-muted-foreground">{t('intellectualDialogueDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="discover" className="py-12 sm:py-16 lg:py-24 px-3 sm:px-6 lg:px-8 bg-secondary/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="sm:text-3xl lg:text-5xl font-afro-heading text-center mb-3 sm:mb-4 text-foreground px-2 text-xl font-medium">
            {t('discoverMeaningful')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 lg:gap-12 mt-8 sm:mt-12">
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full nsibidi-gradient flex items-center justify-center text-primary-foreground text-xl sm:text-2xl font-bold">1</div>
              <h3 className="sm:text-xl lg:text-2xl font-afro-heading text-foreground px-2 text-base font-normal">{t('culturalQuiz')}</h3>
              <p className="text-sm sm:text-base text-muted-foreground px-2">{t('culturalQuizDesc')}</p>
            </div>
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full nsibidi-gradient flex items-center justify-center text-primary-foreground text-xl sm:text-2xl font-bold">2</div>
              <h3 className="sm:text-xl lg:text-2xl font-afro-heading text-foreground px-2 text-base font-normal">{t('personalizedMatch')}</h3>
              <p className="text-sm sm:text-base text-muted-foreground px-2">{t('personalizedMatchDesc')}</p>
            </div>
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-full nsibidi-gradient flex items-center justify-center text-primary-foreground text-xl sm:text-2xl font-bold">3</div>
              <h3 className="sm:text-xl lg:text-2xl font-afro-heading text-foreground px-2 text-base font-normal">{t('shareConnect')}</h3>
              <p className="text-sm sm:text-base text-muted-foreground px-2">{t('shareConnectDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Community Testimonials Section */}
      <section className="py-12 sm:py-16 lg:py-24 px-3 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="sm:text-3xl lg:text-5xl font-afro-heading text-center mb-8 sm:mb-12 text-foreground px-2 text-xl font-medium">
            {t('memberStories')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border space-y-3 sm:space-y-4">
              <p className="text-sm sm:text-base text-muted-foreground italic">"I met someone who shares my passion for classical Indian dance. We're collaborating on a project now, and it's the most inspiring relationship I've ever had."</p>
              <p className="text-sm sm:text-base text-foreground font-semibold">– Priye</p>
            </div>
            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border space-y-3 sm:space-y-4">
              <p className="text-sm sm:text-base text-muted-foreground italic">"We connected over shared knowledge of zulu art, and now we travel to galleries together. I've never felt so understood!"</p>
              <p className="text-sm sm:text-base text-foreground font-semibold">– Vusi</p>
            </div>
            <div className="bg-card p-4 sm:p-6 rounded-lg border border-border space-y-3 sm:space-y-4">
              <p className="text-sm sm:text-base text-muted-foreground italic">"I was looking for a partner who could appreciate my heritage and traditions, and I found that with someone who shares my love for North African poetry."</p>
              <p className="text-sm sm:text-base text-foreground font-semibold">– Ahmed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cultural Exploration Section */}
      <section id="collective" className="py-12 sm:py-16 lg:py-24 px-3 sm:px-6 lg:px-8 bg-secondary/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="sm:text-3xl lg:text-5xl font-afro-heading text-center mb-8 sm:mb-12 text-foreground px-2 text-xl font-medium">
            {t('getInspired')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <div className="bg-card p-5 sm:p-6 lg:p-8 rounded-lg border border-border text-center space-y-2 sm:space-y-3 hover:border-primary transition-colors">
              <h3 className="sm:text-xl font-afro-heading text-foreground text-base font-normal">Discover Cultural Curiosity Quizzes</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Which traditional music genre is your spirit song?</p>
            </div>
            <div className="bg-card p-5 sm:p-6 lg:p-8 rounded-lg border border-border text-center space-y-2 sm:space-y-3 hover:border-primary transition-colors">
              <h3 className="sm:text-xl font-afro-heading text-foreground text-base font-normal">Embark on a Digital Cultural Journey</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Participate in virtual cultural tours, from ancient ruins to contemporary street art scenes.</p>
            </div>
            <div className="bg-card p-5 sm:p-6 lg:p-8 rounded-lg border border-border text-center space-y-2 sm:space-y-3 hover:border-primary transition-colors">
              <h3 className="sm:text-xl font-afro-heading text-foreground text-base font-normal">What's Your Cultural Sign</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Explore connections based on your cultural heritage or ancestral background.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Join the Movement Section */}
      <section id="get-started" className="py-12 sm:py-16 lg:py-24 px-3 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
          <h2 className="sm:text-3xl lg:text-5xl font-afro-heading text-foreground px-2 text-xl font-medium">
            {t('readyExperience')}
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground px-4">
            {t('embraceCulture')}
          </p>
          <Button className="h-11 sm:h-12 lg:h-14 px-6 sm:px-8 lg:px-12 text-sm sm:text-base lg:text-lg font-semibold rounded-full nsibidi-gradient text-primary-foreground border-0 shadow-lg hover:scale-105 transition-transform" onClick={() => navigate('/onboarding')}>
            {t('createProfileNow')}
          </Button>
        </div>
      </section>

      <Footer />
    </div>;
};
export default LandingPage;