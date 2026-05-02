// Centralized livestream limits for free vs premium users.
// Source of truth — used by useStream, StreamingInterface, and viewer join flow.

export type StreamTier = 'free' | 'premium';

export interface StreamLimits {
  maxDurationSec: number; // 0 = unlimited
  maxViewers: number;
  videoWidth: number;
  videoHeight: number;
  maxBitrate: number; // bps
  canSaveReplay: boolean;
  hasPremiumBadge: boolean;
  hasPriorityVisibility: boolean;
}

export const FREE_LIMITS: StreamLimits = {
  maxDurationSec: 15 * 60,
  maxViewers: 10,
  videoWidth: 640,
  videoHeight: 480,
  maxBitrate: 600_000,
  canSaveReplay: false,
  hasPremiumBadge: false,
  hasPriorityVisibility: false,
};

export const PREMIUM_LIMITS: StreamLimits = {
  maxDurationSec: 0,
  maxViewers: 100,
  videoWidth: 1920,
  videoHeight: 1080,
  maxBitrate: 2_500_000,
  canSaveReplay: true,
  hasPremiumBadge: true,
  hasPriorityVisibility: true,
};

export const limitsFor = (isPremium: boolean): StreamLimits =>
  isPremium ? PREMIUM_LIMITS : FREE_LIMITS;

export const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return '∞';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};
