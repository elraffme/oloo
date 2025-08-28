import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, MessageCircle, X } from 'lucide-react';

interface MatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchedProfile: {
    id: string;
    display_name: string;
    profile_photos?: string[];
  } | null;
  onSendMessage: (profileId: string, message: string) => void;
}

export const MatchModal = ({ isOpen, onClose, matchedProfile, onSendMessage }: MatchModalProps) => {
  const [message, setMessage] = useState('');

  if (!matchedProfile) return null;

  const handleSendMessage = () => {
    if (message.trim()) {
      onSendMessage(matchedProfile.id, message);
      setMessage('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="relative">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-6 text-white text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <Heart className="w-8 h-8 fill-current" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">It's a Match! 🎉</h2>
            <p className="text-white/90">
              You and {matchedProfile.display_name} liked each other
            </p>
          </div>

          {/* Profile photos */}
          <div className="flex justify-center gap-4 p-6 bg-gradient-to-b from-purple-50 to-white">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg">
              <img 
                src={matchedProfile.profile_photos?.[0]} 
                alt="Your photo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center justify-center">
              <Heart className="w-8 h-8 text-pink-500 fill-current animate-pulse" />
            </div>
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg">
              <img 
                src={matchedProfile.profile_photos?.[0]} 
                alt={`${matchedProfile.display_name}'s photo`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Message input */}
          <div className="p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Send a message to {matchedProfile.display_name}</h3>
              <Input
                placeholder="Say something nice..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {message.length}/200 characters
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                <X className="w-4 h-4 mr-2" />
                Keep Swiping
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                onClick={handleSendMessage}
                disabled={!message.trim()}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Send Message
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};