import { useEffect, useRef } from 'react';

interface SwipeGestureOptions {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
  velocityThreshold?: number;
}

export const useSwipeGesture = ({
  onSwipeUp,
  onSwipeDown,
  minDistance = 50,
  velocityThreshold = 0.3
}: SwipeGestureOptions) => {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Calculate velocity
      const velocity = Math.abs(deltaY) / deltaTime;

      // Check if vertical swipe (not horizontal)
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        touchStartRef.current = null;
        return;
      }

      // Check if meets minimum distance and velocity requirements
      if (Math.abs(deltaY) >= minDistance && velocity >= velocityThreshold) {
        if (deltaY < 0 && onSwipeUp) {
          // Swipe up - next stream
          onSwipeUp();
        } else if (deltaY > 0 && onSwipeDown) {
          // Swipe down - previous stream
          onSwipeDown();
        }
      }

      touchStartRef.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeUp, onSwipeDown, minDistance, velocityThreshold]);

  return elementRef;
};
