import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Video, Eye, Heart, MessageCircle } from "lucide-react";

const liveStreams = [
  {
    id: 1,
    name: "Sophia",
    title: "Evening Chat & Music 🎵",
    viewers: 245,
    likes: 1.2,
    thumbnail: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=300&h=400&fit=crop&crop=face",
    isLive: true
  },
  {
    id: 2,
    name: "Maria",
    title: "Cooking Together 👩‍🍳",
    viewers: 156,
    likes: 890,
    thumbnail: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=400&fit=crop&crop=face",
    isLive: true
  },
  {
    id: 3,
    name: "Elena",
    title: "Art & Wine Night 🎨",
    viewers: 98,
    likes: 654,
    thumbnail: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=400&fit=crop&crop=face",
    isLive: true
  }
];

const StreamingSection = () => {
  return (
    <section className="py-20 px-4 bg-gradient-to-r from-secondary/30 to-primary/5" id="streaming">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-accent to-primary rounded-full flex items-center justify-center animate-pulse-glow">
              <Video className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              Live Streaming
            </span> Experience
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Connect through live video, share moments, and discover authentic personalities in real-time
          </p>

          <Button 
            size="lg" 
            className="bg-gradient-to-r from-accent to-primary text-white border-0 hover:scale-105 transition-all duration-300 px-8 py-4"
          >
            <Play className="w-5 h-5 mr-2" />
            Start Streaming
          </Button>
        </div>

        {/* Live Streams Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {liveStreams.map((stream) => (
            <Card key={stream.id} className="overflow-hidden group cursor-pointer hover:scale-105 transition-all duration-300">
              <div className="relative">
                {/* Thumbnail */}
                <div className="aspect-[3/4] relative overflow-hidden">
                  <img 
                    src={stream.thumbnail} 
                    alt={stream.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  
                  {/* Live Badge */}
                  {stream.isLive && (
                    <div className="absolute top-3 left-3 bg-accent text-accent-foreground px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 animate-pulse">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                      LIVE
                    </div>
                  )}

                  {/* Viewers Count */}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {stream.viewers}
                  </div>

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Play className="w-6 h-6 text-white ml-1" />
                    </div>
                  </div>
                </div>

                {/* Stream Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{stream.name}</h3>
                  <p className="text-muted-foreground text-sm mb-3">{stream.title}</p>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4 text-accent" />
                      {stream.likes}K
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      Chat
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">HD Video Quality</h3>
            <p className="text-muted-foreground">Crystal clear streaming with adaptive quality</p>
          </div>
          
          <div className="space-y-4">
            <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
              <MessageCircle className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold">Interactive Chat</h3>
            <p className="text-muted-foreground">Real-time messaging during live streams</p>
          </div>
          
          <div className="space-y-4">
            <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mx-auto">
              <Heart className="w-6 h-6 text-gold" />
            </div>
            <h3 className="text-xl font-semibold">Premium Features</h3>
            <p className="text-muted-foreground">Exclusive streaming tools for premium members</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StreamingSection;