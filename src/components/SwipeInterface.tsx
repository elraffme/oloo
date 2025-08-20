import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, X, Star, MapPin, Video } from "lucide-react";

const mockProfiles = [
  {
    id: 1,
    name: "Amara",
    age: 28,
    location: "Lagos, Nigeria",
    bio: "Entrepreneur with a passion for African art and sustainable fashion 🌍✨",
    image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=600&fit=crop&crop=face",
    interests: ["Art", "Fashion", "Entrepreneurship", "Afrobeats"],
    isStreaming: true,
    isPremium: true
  },
  {
    id: 2,
    name: "Kemi",
    age: 25,
    location: "Accra, Ghana",
    bio: "Cultural heritage photographer capturing the beauty of our motherland 📸🏺",
    image: "https://images.unsplash.com/photo-1595959183082-7b570b7e08e2?w=400&h=600&fit=crop&crop=face",
    interests: ["Photography", "Travel", "History", "Kente Weaving"],
    isStreaming: false,
    isPremium: true
  },
  {
    id: 3,
    name: "Zara",
    age: 26,
    location: "Cape Town, South Africa",
    bio: "Dancer, storyteller, and keeper of ancestral traditions 💃🏿🥁",
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=400&h=600&fit=crop&crop=face",
    interests: ["Traditional Dance", "Drumming", "Storytelling", "Ubuntu Philosophy"],
    isStreaming: true,
    isPremium: false
  },
  {
    id: 4,
    name: "Nia",
    age: 27,
    location: "Nairobi, Kenya",
    bio: "Wildlife conservationist and Maasai culture enthusiast 🦁🌿",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop&crop=face",
    interests: ["Conservation", "Maasai Culture", "Safari", "Nature"],
    isStreaming: false,
    isPremium: true
  },
  {
    id: 5,
    name: "Adunni",
    age: 24,
    location: "Addis Ababa, Ethiopia",
    bio: "Coffee enthusiast from the birthplace of coffee ☕ Love ancient traditions",
    image: "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=400&h=600&fit=crop&crop=face",
    interests: ["Coffee Culture", "Ancient History", "Orthodox Traditions", "Injera Cooking"],
    isStreaming: true,
    isPremium: false
  },
  {
    id: 6,
    name: "Fatou",
    age: 29,
    location: "Dakar, Senegal",
    bio: "Musician blending traditional mbalax with modern sounds 🎵🇸🇳",
    image: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=600&fit=crop&crop=face",
    interests: ["Music", "Mbalax", "Sabar Dancing", "Teranga Culture"],
    isStreaming: true,
    isPremium: true
  }
];

const SwipeInterface = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const currentProfile = mockProfiles[currentIndex];

  const handleSwipe = (direction: 'left' | 'right') => {
    setSwipeDirection(direction);
    
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % mockProfiles.length);
      setSwipeDirection(null);
    }, 600);
  };

  if (!currentProfile) return null;

  return (
    <section className="py-20 px-4 african-pattern-bg" id="discover">
      <div className="container mx-auto max-w-md">
        <div className="text-center mb-12 nsibidi-decoration">
          <h2 className="text-3xl md:text-4xl font-afro-heading mb-4">
            <span className="nsibidi-gradient bg-clip-text text-transparent">
              <span className="nsibidi-symbol">◊</span> Discover
            </span> Your Match
          </h2>
          <p className="text-muted-foreground font-afro-body">
            <span className="nsibidi-symbol">⟡</span> Swipe right to like, left to pass <span className="nsibidi-symbol">⟡</span>
          </p>
          <div className="font-nsibidi text-primary/60 mt-2">
            ◈ Cultural Connections Await ◈
          </div>
        </div>

        {/* Swipe Card */}
        <div className="relative h-[600px] flex items-center justify-center">
          <Card 
            className={`swipe-card cultural-card w-full h-full relative overflow-hidden ${
              swipeDirection === 'right' ? 'animate-swipe-right' : 
              swipeDirection === 'left' ? 'animate-swipe-left' : ''
            }`}
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              <img 
                src={currentProfile.image} 
                alt={currentProfile.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
              <div className="absolute inset-0 cultural-pattern opacity-20"></div>
            </div>

            {/* Premium Badge */}
            {currentProfile.isPremium && (
              <div className="absolute top-4 right-4 nsibidi-gradient text-primary-foreground px-3 py-1 rounded-full text-xs font-afro-body flex items-center gap-1">
                <Star className="w-3 h-3" />
                <span className="nsibidi-symbol">◈</span>
                Premium
              </div>
            )}

            {/* Streaming Badge */}
            {currentProfile.isStreaming && (
              <div className="absolute top-4 left-4 bg-accent text-accent-foreground px-3 py-1 rounded-full text-xs font-afro-body flex items-center gap-1 animate-pulse-glow">
                <Video className="w-3 h-3" />
                <span className="nsibidi-symbol">⬟</span>
                Live
              </div>
            )}

            {/* Profile Info */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white cultural-card">
              <div className="mb-2">
                <h3 className="text-2xl font-afro-heading mb-1">
                  <span className="nsibidi-symbol mr-2">◊</span>
                  {currentProfile.name}, {currentProfile.age}
                </h3>
                <div className="flex items-center text-white/90 mb-3 font-afro-body">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span className="nsibidi-symbol mr-1">⟡</span>
                  {currentProfile.location}
                </div>
              </div>
              
              <p className="text-white/95 mb-4 font-afro-body">{currentProfile.bio}</p>
              
              <div className="flex flex-wrap gap-2">
                {currentProfile.interests.map((interest, idx) => (
                  <span 
                    key={idx}
                    className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-afro-body border border-white/30"
                  >
                    <span className="nsibidi-symbol mr-1 text-primary-glow">◈</span>
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center items-center gap-6 mt-8">
          <Button 
            size="lg"
            variant="outline"
            className="w-16 h-16 rounded-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-300 hover:scale-110 font-afro-body cultural-card"
            onClick={() => handleSwipe('left')}
          >
            <X className="w-6 h-6" />
          </Button>
          
          <Button 
            size="lg"
            className="w-20 h-20 rounded-full nsibidi-gradient text-primary-foreground border-0 hover:scale-110 transition-all duration-300 shadow-lg font-afro-body"
            onClick={() => handleSwipe('right')}
          >
            <Heart className="w-8 h-8" />
            <span className="absolute -top-1 -right-1 nsibidi-symbol text-xs">♦</span>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default SwipeInterface;