import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Users, 
  Heart, 
  Gift,
  Settings,
  Play,
  Eye,
  Crown
} from 'lucide-react';

const Streaming = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);

  const liveStreams = [
    {
      id: '1',
      host: 'Amara',
      title: 'Cultural Cooking Session',
      viewers: 142,
      thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop',
      isLive: true,
      category: 'Lifestyle'
    },
    {
      id: '2',
      host: 'Kwame',
      title: 'Afrobeats Music Discussion',
      viewers: 89,
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=200&fit=crop',
      isLive: true,
      category: 'Music'
    },
    {
      id: '3',
      host: 'Zara',
      title: 'African Literature Review',
      viewers: 67,
      thumbnail: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=200&fit=crop',
      isLive: true,
      category: 'Education'
    }
  ];

  const handleStartStream = () => {
    setIsStreaming(!isStreaming);
    if (!isStreaming) {
      setIsCameraOn(true);
      setIsMicOn(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold font-afro-heading">
          <span className="afro-heading">Live Streaming</span>
        </h1>
        <p className="text-muted-foreground">
          Share your world, connect through culture
        </p>
      </div>

      <Tabs defaultValue="discover" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="discover">Discover Streams</TabsTrigger>
          <TabsTrigger value="create">Go Live</TabsTrigger>
        </TabsList>

        {/* Discover Streams */}
        <TabsContent value="discover" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {liveStreams.map((stream) => (
              <Card key={stream.id} className="swipe-card cursor-pointer hover:scale-105 transition-transform">
                <CardContent className="p-0">
                  <div className="relative">
                    <img 
                      src={stream.thumbnail} 
                      alt={stream.title}
                      className="w-full h-32 object-cover rounded-t-lg"
                    />
                    
                    {/* Live Badge */}
                    <Badge className="absolute top-2 left-2 bg-red-500 hover:bg-red-600 text-white animate-pulse">
                      <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
                      LIVE
                    </Badge>
                    
                    {/* Viewer Count */}
                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
                      <Eye className="w-3 h-3 inline mr-1" />
                      {stream.viewers}
                    </div>

                    {/* Play Button */}
                    <Button
                      size="sm"
                      className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-primary hover:bg-primary/90 p-0"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold truncate">{stream.title}</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{stream.host}</p>
                      <Badge variant="secondary" className="text-xs">
                        {stream.category}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Featured Section */}
          <Card className="cultural-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-gold" />
                Premium Live Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Join exclusive cultural events, masterclasses, and premium streaming content.
              </p>
              <Button className="bg-gradient-to-r from-gold to-accent text-foreground hover:opacity-90">
                Upgrade to Premium
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Stream */}
        <TabsContent value="create" className="space-y-6">
          <Card className="cultural-card">
            <CardHeader>
              <CardTitle>Start Your Live Stream</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stream Preview */}
              <div className="relative bg-black rounded-lg aspect-video flex items-center justify-center">
                {isCameraOn ? (
                  <div className="text-white text-center">
                    <Video className="w-12 h-12 mx-auto mb-2" />
                    <p>Camera Preview</p>
                    <p className="text-sm opacity-70">Your video stream will appear here</p>
                  </div>
                ) : (
                  <div className="text-white/50 text-center">
                    <VideoOff className="w-12 h-12 mx-auto mb-2" />
                    <p>Camera Off</p>
                  </div>
                )}
                
                {/* Status Indicator */}
                {isStreaming && (
                  <Badge className="absolute top-4 left-4 bg-red-500 hover:bg-red-600 text-white animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
                    LIVE
                  </Badge>
                )}
              </div>

              {/* Controls */}
              <div className="flex justify-center gap-4">
                <Button
                  variant={isCameraOn ? "default" : "outline"}
                  size="lg"
                  onClick={() => setIsCameraOn(!isCameraOn)}
                  className="w-12 h-12 rounded-full"
                >
                  {isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </Button>
                
                <Button
                  variant={isMicOn ? "default" : "outline"}
                  size="lg"
                  onClick={() => setIsMicOn(!isMicOn)}
                  className="w-12 h-12 rounded-full"
                >
                  {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </Button>
                
                <Button
                  variant="outline"
                  size="lg"
                  className="w-12 h-12 rounded-full"
                >
                  <Settings className="w-6 h-6" />
                </Button>
              </div>

              {/* Stream Actions */}
              <div className="space-y-4">
                <Button
                  onClick={handleStartStream}
                  className={`w-full h-12 text-lg font-semibold ${
                    isStreaming 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
                  disabled={!isCameraOn}
                >
                  {isStreaming ? 'End Stream' : 'Go Live'}
                </Button>

                {isStreaming && (
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="flex items-center justify-center mb-1">
                        <Users className="w-4 h-4 mr-1" />
                      </div>
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-xs text-muted-foreground">Viewers</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center mb-1">
                        <Heart className="w-4 h-4 mr-1 text-red-500" />
                      </div>
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-xs text-muted-foreground">Likes</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center mb-1">
                        <Gift className="w-4 h-4 mr-1 text-gold" />
                      </div>
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-xs text-muted-foreground">Gifts</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Stream Info */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div>
                  <label className="text-sm font-medium">Stream Title</label>
                  <input 
                    type="text"
                    placeholder="What's your stream about?"
                    className="w-full mt-1 p-2 border border-border rounded-md bg-background"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select className="w-full mt-1 p-2 border border-border rounded-md bg-background">
                    <option>Culture & Heritage</option>
                    <option>Music & Arts</option>
                    <option>Food & Cooking</option>
                    <option>Travel & Places</option>
                    <option>Education</option>
                    <option>Entertainment</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Streaming;