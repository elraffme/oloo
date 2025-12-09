import React, { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';

interface CoinRewardAnimationProps {
  coinsEarned: number;
  onComplete: () => void;
}

// Play coin chime sound using Web Audio API
const playCoinChime = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a pleasant coin chime sound
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    const now = audioContext.currentTime;
    // Play ascending coin chime notes
    playTone(880, now, 0.15);        // A5
    playTone(1108.73, now + 0.1, 0.15); // C#6
    playTone(1318.51, now + 0.2, 0.2);  // E6
  } catch (e) {
    console.log('Audio not supported');
  }
};

const CoinRewardAnimation: React.FC<CoinRewardAnimationProps> = ({ coinsEarned, onComplete }) => {
  const [stage, setStage] = useState<'appear' | 'show' | 'fade'>('appear');
  
  useEffect(() => {
    // Play chime on mount
    playCoinChime();
    
    // Transition stages
    const appearTimer = setTimeout(() => setStage('show'), 100);
    const fadeTimer = setTimeout(() => setStage('fade'), 2000);
    const completeTimer = setTimeout(onComplete, 2500);
    
    return () => {
      clearTimeout(appearTimer);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);
  
  // Generate floating coins
  const floatingCoins = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: 40 + Math.random() * 20,
    delay: Math.random() * 0.3,
    duration: 1.5 + Math.random() * 0.5,
  }));
  
  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${
        stage === 'fade' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Floating coins background */}
      {floatingCoins.map((coin) => (
        <div
          key={coin.id}
          className="absolute text-3xl animate-coin-float"
          style={{
            left: `${coin.left}%`,
            bottom: '30%',
            animationDelay: `${coin.delay}s`,
            animationDuration: `${coin.duration}s`,
          }}
        >
          🪙
        </div>
      ))}
      
      {/* Main coin display */}
      <div 
        className={`relative flex flex-col items-center transform transition-all duration-300 ${
          stage === 'appear' ? 'scale-0' : 'scale-100'
        }`}
      >
        {/* Sparkle effects */}
        <div className="absolute -inset-16 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-gold rounded-full animate-ping"
              style={{
                top: `${20 + Math.random() * 60}%`,
                left: `${20 + Math.random() * 60}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '1s',
              }}
            />
          ))}
        </div>
        
        {/* Glowing coin icon */}
        <div className="relative animate-coin-burst">
          <div className="absolute inset-0 bg-gold/30 rounded-full blur-xl animate-pulse" />
          <div className="relative bg-gradient-to-br from-gold to-yellow-600 rounded-full p-6 shadow-2xl">
            <Coins className="w-16 h-16 text-gold-foreground" />
          </div>
        </div>
        
        {/* Coins earned text */}
        <div className="mt-6 text-center animate-coin-shine">
          <p className="text-5xl font-bold text-gold drop-shadow-lg">
            +{coinsEarned}
          </p>
          <p className="text-2xl font-semibold text-foreground mt-2 tracking-wider">
            COINS!
          </p>
        </div>
      </div>
    </div>
  );
};

export default CoinRewardAnimation;
