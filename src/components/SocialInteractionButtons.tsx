import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SocialInteractionButtonsProps {
  toUserId: string;
  toUserName: string;
}

const icebreakers = [
  "What's your favorite way to spend a weekend?",
  "If you could travel anywhere right now, where would you go?",
  "What's something you're passionate about?",
  "What's the best concert or show you've ever been to?",
  "What's your go-to comfort food?",
  "What's something on your bucket list?",
];

export function SocialInteractionButtons({ toUserId, toUserName }: SocialInteractionButtonsProps) {
  const [showIcebreakerDialog, setShowIcebreakerDialog] = useState(false);
  const [selectedIcebreaker, setSelectedIcebreaker] = useState("");
  const [sending, setSending] = useState(false);

  const sendInteraction = async (type: 'wave' | 'wink' | 'icebreaker', message?: string) => {
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to interact");
        return;
      }

      const { error } = await supabase
        .from('social_interactions')
        .insert({
          from_user_id: user.id,
          to_user_id: toUserId,
          interaction_type: type,
          message: message || null,
        });

      if (error) throw error;

      const actionText = type === 'wave' ? 'Wave sent!' : type === 'wink' ? 'Wink sent!' : 'Icebreaker sent!';
      toast.success(`${actionText} ${toUserName} will be notified 💫`);
      
      if (type === 'icebreaker') {
        setShowIcebreakerDialog(false);
        setSelectedIcebreaker("");
      }
    } catch (error: any) {
      console.error('Error sending interaction:', error);
      toast.error(error.message || "Failed to send interaction");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 w-full">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => sendInteraction('wave')}
          disabled={sending}
        >
          <span className="text-xl">👋</span>
          <span>Wave</span>
        </Button>
        
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => sendInteraction('wink')}
          disabled={sending}
        >
          <span className="text-xl">😉</span>
          <span>Wink</span>
        </Button>
        
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => setShowIcebreakerDialog(true)}
          disabled={sending}
        >
          <span className="text-xl">❄️</span>
          <span>Icebreaker</span>
        </Button>
      </div>

      <Dialog open={showIcebreakerDialog} onOpenChange={setShowIcebreakerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send an Icebreaker to {toUserName}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choose a fun question to break the ice:
            </p>
            
            <div className="space-y-2">
              {icebreakers.map((question, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedIcebreaker(question)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedIcebreaker === question
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-sm">{question}</p>
                </button>
              ))}
            </div>

            <div className="pt-2">
              <label className="text-sm font-medium mb-2 block">
                Or write your own:
              </label>
              <Textarea
                placeholder="Type your custom icebreaker question..."
                value={selectedIcebreaker}
                onChange={(e) => setSelectedIcebreaker(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowIcebreakerDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => sendInteraction('icebreaker', selectedIcebreaker)}
              disabled={!selectedIcebreaker.trim() || sending}
            >
              Send Icebreaker ❄️
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
