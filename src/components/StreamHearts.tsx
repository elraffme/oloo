import React from 'react';
import { Heart } from 'lucide-react';
import type { HeartEvent } from '@/hooks/useStreamReactions';

interface StreamHeartsProps {
  hearts: HeartEvent[];
}

/** Renders exactly one floating heart per reaction event. */
export const StreamHearts: React.FC<StreamHeartsProps> = ({ hearts }) => {
  if (hearts.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {hearts.map(heart => (
        <Heart
          key={heart.id}
          className="absolute text-red-500 fill-current animate-like-float"
          style={{
            left: `calc(50% + ${heart.x}px)`,
            bottom: '20%',
            width: '3rem',
            height: '3rem',
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
};

export default StreamHearts;
