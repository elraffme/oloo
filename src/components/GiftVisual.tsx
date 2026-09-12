import { cn } from '@/lib/utils';
import ankaraHandFan from '@/assets/gifts/ankara-hand-fan.png';
import regalia from '@/assets/gifts/regalia.png';
import silverFlywhisk from '@/assets/gifts/silver-flywhisk.png';
import coralBeads from '@/assets/gifts/coral-beads.png';
import beadedCrown from '@/assets/gifts/beaded-crown.png';
import royalGoldenStool from '@/assets/gifts/royal-golden-stool.png';
import goldenScepter from '@/assets/gifts/golden-scepter.png';
import goldenCrown from '@/assets/gifts/golden-crown.png';

const giftArtwork: Record<string, string> = {
  'gift:ankara-hand-fan': ankaraHandFan,
  'gift:regalia': regalia,
  'gift:silver-flywhisk': silverFlywhisk,
  'gift:coral-beads': coralBeads,
  'gift:beaded-crown': beadedCrown,
  'gift:royal-golden-stool': royalGoldenStool,
  'gift:golden-scepter': goldenScepter,
  'gift:golden-crown': goldenCrown,
};

export const resolveGiftArtwork = (asset?: string | null) =>
  asset ? giftArtwork[asset] ?? asset : null;

interface GiftVisualProps {
  asset?: string | null;
  name: string;
  className?: string;
  imageClassName?: string;
  animated?: boolean;
  eager?: boolean;
}

export function GiftVisual({
  asset,
  name,
  className,
  imageClassName,
  animated = false,
  eager = false,
}: GiftVisualProps) {
  const source = resolveGiftArtwork(asset);
  const isImage = !!source && (source.startsWith('/') || source.startsWith('http') || source.startsWith('data:'));

  return (
    <span className={cn('gift-visual', animated && 'gift-visual--animated', className)} aria-label={name} role="img">
      {isImage ? (
        <img
          src={source}
          alt={name}
          width={768}
          height={768}
          loading={eager ? 'eager' : 'lazy'}
          className={cn('gift-visual__image', imageClassName)}
        />
      ) : (
        <span className="gift-visual__emoji">{source || '🎁'}</span>
      )}
      {animated && <span className="gift-visual__shine" aria-hidden="true" />}
    </span>
  );
}