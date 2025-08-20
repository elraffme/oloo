import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, X, Star, MapPin, Video } from "lucide-react";

const mockProfiles = [
  {
    id: 1,
    name: "Sofia",
    age: 28,
    location: "New York",
    bio: "Adventure seeker, yoga enthusiast, and coffee connoisseur ☕",
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=400&h=600&fit=crop&crop=face",
    interests: ["Yoga", "Travel", "Photography"],
    isStreaming: true,
    isPremium: true
  },
  {
    id: 2,
    name: "Emma",
    age: 25,
    location: "Los Angeles",
    bio: "Artist by day, dreamer by night. Let's create beautiful memories together ✨",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop&crop=face",
    interests: ["Art", "Music", "Hiking"],
    isStreaming: false,
    isPremium: true
  },
  {
    id: 3,
    name: "Isabella",
    age: 26,
    location: "Miami",
    bio: "Passionate about life, love, and late-night conversations 🌙",
    image: "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=400&h=600&fit=crop&crop=face",
    interests: ["Dancing", "Cooking", "Beach"],
    isStreaming: true,
    isPremium: false
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
    <section className="py-20 px-4" id="discover">
      <div className="container mx-auto max-w-md">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Discover
            </span> Your Match
          </h2>
          <p className="text-muted-foreground">Swipe right to like, left to pass</p>
        </div>

        {/* Swipe Card */}
        <div className="relative h-[600px] flex items-center justify-center">
          <Card 
            className={`swipe-card w-full h-full relative overflow-hidden ${
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            </div>

            {/* Premium Badge */}
            {currentProfile.isPremium && (
              <div className="absolute top-4 right-4 bg-gold text-gold-foreground px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                <Star className="w-3 h-3" />
                Premium
              </div>
            )}

            {/* Streaming Badge */}
            {currentProfile.isStreaming && (
              <div className="absolute top-4 left-4 bg-accent text-accent-foreground px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 animate-pulse-glow">
                <Video className="w-3 h-3" />
                Live
              </div>
            )}

            {/* Profile Info */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="mb-2">
                <h3 className="text-2xl font-bold mb-1">
                  {currentProfile.name}, {currentProfile.age}
                </h3>
                <div className="flex items-center text-white/80 mb-3">
                  <MapPin className="w-4 h-4 mr-1" />
                  {currentProfile.location}
                </div>
              </div>
              
              <p className="text-white/90 mb-4">{currentProfile.bio}</p>
              
              <div className="flex flex-wrap gap-2">
                {currentProfile.interests.map((interest, idx) => (
                  <span 
                    key={idx}
                    className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs"
                  >
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
            className="w-16 h-16 rounded-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-300 hover:scale-110"
            onClick={() => handleSwipe('left')}
          >
            <X className="w-6 h-6" />
          </Button>
          
          <Button 
            size="lg"
            className="w-20 h-20 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 hover:scale-110 transition-all duration-300 shadow-lg"
            onClick={() => handleSwipe('right')}
          >
            <Heart className="w-8 h-8" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default SwipeInterface;