import { Button } from "@/components/ui/button";
import { Heart, Play, Sparkles } from "lucide-react";
import heroImage from "@/assets/afrocentric-hero.jpg";
import africanWoman from "@/assets/african-woman-1.jpg";
import africanMan from "@/assets/african-man-1.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden african-pattern-bg">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img 
          src={heroImage} 
          alt="Romantic couple silhouette" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 hero-gradient opacity-70"></div>
        <div className="absolute inset-0 bg-background/10"></div>
      </div>

      {/* Floating African Models */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute right-10 top-20 w-32 h-48 rounded-xl opacity-20 bg-cover bg-center animate-float-hearts"
          style={{
            backgroundImage: `url(${africanWoman})`,
            animationDelay: '0s'
          }}
        />
        <div 
          className="absolute left-16 bottom-32 w-28 h-42 rounded-xl opacity-15 bg-cover bg-center animate-float-hearts"
          style={{
            backgroundImage: `url(${africanMan})`,
            animationDelay: '2s'
          }}
        />
      </div>

      {/* Enhanced Nsibidi Floating Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {['𝔐', '𝔞', '𝔦', '⬟', '◈', '◊', '⟡', '⬢', '◉'].map((symbol, i) => (
          <div 
            key={i}
            className={`absolute text-primary/40 animate-float-hearts font-nsibidi text-2xl`}
            style={{
              left: `${15 + (i * 12)}%`,
              top: `${25 + (i * 8)}%`,
              animationDelay: `${i * 0.7}s`,
              fontSize: `${1.8 + (i * 0.2)}rem`
            }}
          >
            {symbol}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <div className="mb-6 nsibidi-decoration">
          <Sparkles className="w-16 h-16 mx-auto text-primary animate-pulse-glow mb-4" />
        </div>
        
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-afro-heading mb-6 leading-tight">
          <span className="nsibidi-gradient bg-clip-text text-transparent">
            <span className="nsibidi-symbol text-4xl md:text-5xl">𝔐 </span>
            Àṣẹ Dating
            <span className="nsibidi-symbol text-4xl md:text-5xl"> 𝔐</span>
          </span>
          <br />
          <span className="text-foreground font-afro-display">Redefined</span>
          <div className="text-2xl md:text-3xl font-nsibidi text-primary/80 mt-4 leading-relaxed">
            ⬢ ◉ ⬟ Àfọ̀lúwá Connections ⬟ ◉ ⬢
          </div>
          <div className="text-lg md:text-xl font-nsibidi text-accent/60 mt-2">
            ∴ ◈ 𝔞 Heritage • Love • Unity 𝔞 ◈ ∴
          </div>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed font-afro-body">
          <span className="nsibidi-symbol text-primary">◊</span> Experience authentic Àfọ̀lúwá luxury dating with vibrant cultural connections, 
          exclusive streaming features, and meaningful relationships rooted in our rich heritage <span className="nsibidi-symbol text-primary">◊</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Button 
            size="lg" 
            className="nsibidi-gradient text-primary-foreground border-0 hover:scale-105 transition-all duration-300 px-8 py-6 text-lg font-afro-body shadow-lg hover:shadow-xl"
          >
            <Heart className="w-5 h-5 mr-2" />
            <span className="nsibidi-symbol mr-2">𝔐</span>
            Bàṣẹ́ Matching
          </Button>
          
          <Button 
            size="lg" 
            variant="outline" 
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 px-8 py-6 text-lg font-afro-body cultural-card"
          >
            <Play className="w-5 h-5 mr-2" />
            <span className="nsibidi-symbol mr-2">◉</span>
            Wò Àpẹẹrẹ
          </Button>
        </div>

        {/* Enhanced Afrocentric Stats */}
        <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto">
          <div className="text-center cultural-card p-4 rounded-2xl border border-primary/20 backdrop-blur-sm">
            <div className="text-3xl md:text-4xl font-afro-heading text-primary mb-1">50K+</div>
            <div className="text-sm text-muted-foreground font-afro-body">
              <span className="nsibidi-symbol text-primary">𝔞</span> Àfọ̀lúwá Members
            </div>
          </div>
          <div className="text-center cultural-card p-4 rounded-2xl border border-accent/20 backdrop-blur-sm">
            <div className="text-3xl md:text-4xl font-afro-heading text-accent mb-1">95%</div>
            <div className="text-sm text-muted-foreground font-afro-body">
              <span className="nsibidi-symbol text-accent">◉</span> Ìfẹ́ Success
            </div>
          </div>
          <div className="text-center cultural-card p-4 rounded-2xl border border-primary-glow/20 backdrop-blur-sm">
            <div className="text-3xl md:text-4xl font-afro-heading text-primary-glow mb-1">24/7</div>
            <div className="text-sm text-muted-foreground font-afro-body">
              <span className="nsibidi-symbol text-primary-glow">⬢</span> Live Àfisé
            </div>
          </div>
        </div>

        {/* Additional Nsibidi Decorative Elements */}
        <div className="mt-12 flex justify-center items-center space-x-8 opacity-60">
          <div className="font-nsibidi text-2xl text-primary animate-pulse-glow">∴</div>
          <div className="font-nsibidi text-3xl text-accent">◈</div>
          <div className="font-nsibidi text-2xl text-primary-glow animate-pulse-glow">𝔦</div>
          <div className="font-nsibidi text-3xl text-primary">⬢</div>
          <div className="font-nsibidi text-2xl text-accent animate-pulse-glow">∴</div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;