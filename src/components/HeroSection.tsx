import { Button } from "@/components/ui/button";
import { Heart, Play, Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-dating.jpg";

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

      {/* Floating Logo Animation */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div 
            key={i}
            className="absolute animate-float-hearts"
            style={{
              left: `${20 + (i * 15)}%`,
              top: `${30 + (i * 10)}%`,
              animationDelay: `${i * 0.5}s`,
              fontSize: `${1.5 + (i * 0.3)}rem`
            }}
          >
            <div className="romantic-gradient rounded-full p-2 opacity-30">
              <span className="text-primary-foreground font-bold">Ò</span>
            </div>
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
            <span className="nsibidi-symbol text-3xl md:text-4xl">◊ </span>
            Premium Dating
            <span className="nsibidi-symbol text-3xl md:text-4xl"> ◊</span>
          </span>
          <br />
          <span className="text-foreground font-afro-display">Redefined</span>
          <div className="text-2xl md:text-3xl font-nsibidi text-primary/70 mt-2">
            ⟡ ◈ ⬟ Cultural Connections ⬟ ◈ ⟡
          </div>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed font-afro-body">
          Experience Afrocentric luxury dating with vibrant cultural connections, 
          exclusive streaming features, and meaningful relationships rooted in heritage.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Button 
            size="lg" 
            className="nsibidi-gradient text-primary-foreground border-0 hover:scale-105 transition-all duration-300 px-8 py-6 text-lg font-afro-body shadow-lg hover:shadow-xl"
          >
            <div className="w-5 h-5 mr-2 romantic-gradient rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">Ò</span>
            </div>
            <span className="nsibidi-symbol mr-2">♦</span>
            Start Matching
          </Button>
          
          <Button 
            size="lg" 
            variant="outline" 
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 px-8 py-6 text-lg font-afro-body cultural-card"
          >
            <Play className="w-5 h-5 mr-2" />
            <span className="nsibidi-symbol mr-2">⬟</span>
            Watch Demo
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
          <div className="text-center cultural-card p-3 rounded-xl">
            <div className="text-2xl md:text-3xl font-afro-heading text-primary">50K+</div>
            <div className="text-sm text-muted-foreground font-afro-body">
              <span className="nsibidi-symbol">◊</span> Cultural Members
            </div>
          </div>
          <div className="text-center cultural-card p-3 rounded-xl">
            <div className="text-2xl md:text-3xl font-afro-heading text-accent">95%</div>
            <div className="text-sm text-muted-foreground font-afro-body">
              <span className="nsibidi-symbol">◈</span> Match Success
            </div>
          </div>
          <div className="text-center cultural-card p-3 rounded-xl">
            <div className="text-2xl md:text-3xl font-afro-heading text-primary-glow">24/7</div>
            <div className="text-sm text-muted-foreground font-afro-body">
              <span className="nsibidi-symbol">⟡</span> Live Streaming
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;