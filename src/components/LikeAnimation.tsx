import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

interface LikeAnimationProps {
  show: boolean;
  onComplete?: () => void;
}

export const LikeAnimation: React.FC<LikeAnimationProps> = ({ show, onComplete }) => {
  const [hearts, setHearts] = useState<{ id: number; x: number; delay: number }[]>([]);

  useEffect(() => {
    if (show) {
      const newHearts = Array.from({ length: 5 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 60 - 30, // Random horizontal offset between -30 and 30
        delay: i * 100 // Stagger the animations
      }));
      setHearts(newHearts);

      const timer = setTimeout(() => {
        setHearts([]);
        onComplete?.();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show || hearts.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      {hearts.map((heart) => (
        <Heart
          key={heart.id}
          className="absolute text-red-500 fill-current animate-like-float"
          style={{
            left: `calc(50% + ${heart.x}px)`,
            bottom: '40%',
            animationDelay: `${heart.delay}ms`,
            width: '3rem',
            height: '3rem',
            opacity: 0.9
          }}
        />
      ))}
    </div>
  );
};
