export const membershipDisplayName = (tier: string | null | undefined): string => {
  switch ((tier ?? 'free').toLowerCase()) {
    case 'silver':
      return 'Priest';
    case 'gold':
    case 'platinum':
    case 'premium':
      return 'King';
    default:
      return 'Chief';
  }
};