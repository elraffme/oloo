/**
 * Parse Supabase auth hash fragments from URL
 * Supabase uses hash fragments for auth tokens: #access_token=...&type=recovery
 */
export const parseAuthHash = (hash: string) => {
  if (!hash || !hash.startsWith('#')) return null;

  const params = new URLSearchParams(hash.substring(1));
  
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    type: params.get('type'),
    error: params.get('error'),
    error_description: params.get('error_description'),
  };
};

/**
 * Clean auth hash from URL without page reload
 */
export const cleanAuthHash = () => {
  if (window.history.replaceState) {
    window.history.replaceState(null, '', window.location.pathname);
  }
};
