import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';

interface EmotePickerProps {
  onEmoteSelect: (emote: string) => void;
  disabled?: boolean;
}

const EMOTES = [
  { emoji: '😀', label: 'Happy' },
  { emoji: '😂', label: 'Laughing' },
  { emoji: '😍', label: 'Love' },
  { emoji: '🥰', label: 'Heart Eyes' },
  { emoji: '😎', label: 'Cool' },
  { emoji: '🤩', label: 'Star Struck' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '💯', label: '100' },
  { emoji: '👍', label: 'Thumbs Up' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🎉', label: 'Party' },
  { emoji: '🎊', label: 'Confetti' },
  { emoji: '💃', label: 'Dance' },
  { emoji: '🕺', label: 'Dance Man' },
  { emoji: '✨', label: 'Sparkles' },
  { emoji: '⭐', label: 'Star' },
  { emoji: '💫', label: 'Dizzy' },
  { emoji: '🌟', label: 'Glowing Star' },
  { emoji: '💖', label: 'Pink Heart' },
  { emoji: '💕', label: 'Two Hearts' },
  { emoji: '💗', label: 'Growing Heart' },
  { emoji: '😘', label: 'Kiss' },
  { emoji: '😊', label: 'Blush' },
  { emoji: '🤗', label: 'Hug' },
  { emoji: '👋', label: 'Wave' },
  { emoji: '🙌', label: 'Hands Up' },
  { emoji: '💪', label: 'Strong' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '🎶', label: 'Musical Notes' },
];

export const EmotePicker: React.FC<EmotePickerProps> = ({ onEmoteSelect, disabled }) => {
  const [open, setOpen] = React.useState(false);

  const handleEmoteClick = (emote: string) => {
    onEmoteSelect(emote);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          className="h-9 w-9 md:h-10 md:w-10"
        >
          <Smile className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-2" 
        align="end"
        side="top"
      >
        <div className="grid grid-cols-6 gap-1">
          {EMOTES.map((emote) => (
            <button
              key={emote.label}
              type="button"
              onClick={() => handleEmoteClick(emote.emoji)}
              className="text-2xl p-2 hover:bg-accent rounded-md transition-colors"
              title={emote.label}
            >
              {emote.emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
