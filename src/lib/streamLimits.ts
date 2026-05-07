// Centralized livestream limits per membership tier.
// Source of truth — used by useStream, StreamingInterface, and viewer join flow.

export type StreamTier = 'free' | 'silver' | 'gold' | 'platinum' | 'premium';

export interface StreamLimits {
  tier: StreamTier;
  maxDurationSec: number; // 0 = unlimited
  maxViewers: number; // 0 = unlimited (use very high cap in practice)
  videoWidth: number;
  videoHeight: number;
  maxBitrate: number; // bps
  frameRate: number;
  canSaveReplay: boolean;
  hasPremiumBadge: boolean;
  hasPriorityVisibility: boolean;
}

export const FREE_LIMITS: StreamLimits = {
  tier: 'free',
  maxDurationSec: 15 * 60,
  maxViewers: 10,
  videoWidth: 854,
  videoHeight: 480,
  maxBitrate: 600_000,
  frameRate: 24,
  canSaveReplay: false,
  hasPremiumBadge: false,
  hasPriorityVisibility: false,
};

export const SILVER_LIMITS: StreamLimits = {
  tier: 'silver',
  maxDurationSec: 30 * 60,
  maxViewers: 25,
  videoWidth: 1280,
  videoHeight: 720,
  maxBitrate: 1_200_000,
  frameRate: 30,
  canSaveReplay: false,
  hasPremiumBadge: true,
  hasPriorityVisibility: false,
};

export const GOLD_LIMITS: StreamLimits = {
  tier: 'gold',
  maxDurationSec: 4 * 60 * 60,
  maxViewers: 100,
  videoWidth: 1920,
  videoHeight: 1080,
  maxBitrate: 2_500_000,
  frameRate: 30,
  canSaveReplay: true,
  hasPremiumBadge: true,
  hasPriorityVisibility: false,
};

export const PLATINUM_LIMITS: StreamLimits = {
  tier: 'platinum',
  maxDurationSec: 0,
  maxViewers: 1000,
  videoWidth: 1920,
  videoHeight: 1080,
  maxBitrate: 4_000_000,
  frameRate: 30,
  canSaveReplay: true,
  hasPremiumBadge: true,
  hasPriorityVisibility: true,
};

// Generic premium fallback (legacy callers passing just isPremium=true)
export const PREMIUM_LIMITS: StreamLimits = GOLD_LIMITS;

export const limitsForTier = (tier: string | null | undefined): StreamLimits => {
  switch ((tier || 'free').toLowerCase()) {
    case 'platinum':
      return PLATINUM_LIMITS;
    case 'gold':
      return GOLD_LIMITS;
    case 'silver':
      return SILVER_LIMITS;
    case 'premium':
      return PREMIUM_LIMITS;
    default:
      return FREE_LIMITS;
  }
};

// Legacy helper kept for backwards compatibility.
export const limitsFor = (isPremium: boolean): StreamLimits =>
  isPremium ? PREMIUM_LIMITS : FREE_LIMITS;

export const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return '∞';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};
