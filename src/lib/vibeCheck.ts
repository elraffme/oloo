import { supabase } from '@/integrations/supabase/client';

/**
 * Oloo Vibe Check.
 *
 * The positive action ("ignite") and the opposite action ("pass") are stored as
 * neutral keys in the database. All wording / iconography lives in VIBE_CONFIG
 * below so the opposite action can be renamed or re-skinned later without any
 * data migration or business-logic change.
 */
export type VibeKey = 'ignite' | 'pass';

export interface VibeDefinition {
  key: VibeKey;
  /** Emoji used as the visual concept. Safe to change. */
  emoji: string;
  /** Short button label. Safe to change. */
  label: string;
  /** Longer description used in tooltips / toasts. Safe to change. */
  description: string;
  /** Toast headline on success. Safe to change. */
  successTitle: string;
}

export const VIBE_CONFIG: Record<VibeKey, VibeDefinition> = {
  ignite: {
    key: 'ignite',
    emoji: '🔥',
    label: 'Vibe',
    description: 'Ignition & Vibration — you feel a connection',
    successTitle: 'Vibe ignited',
  },
  pass: {
    // TEMPORARY concept until the final opposite symbol / name is chosen.
    key: 'pass',
    emoji: '✋',
    label: 'Not a Vibe',
    description: 'Not a Vibe — this one is not for you',
    successTitle: 'Noted',
  },
};

export interface VibeResult {
  success: boolean;
  vibe?: VibeKey;
  mutual?: boolean;
  message?: string;
}

export const setVibeCheck = async (targetUserId: string, vibe: VibeKey): Promise<VibeResult> => {
  try {
    const { data, error } = await supabase.rpc('set_vibe_check', {
      _target_user_id: targetUserId,
      _vibe: vibe,
    });

    if (error) throw error;
    return (data ?? { success: false, message: 'Unexpected response' }) as unknown as VibeResult;
  } catch (error) {
    console.error('Error saving vibe check:', error);
    return { success: false, message: 'Could not save your Vibe Check. Please try again.' };
  }
};

export const getVibeChecksFor = async (targetUserIds: string[]): Promise<Record<string, VibeKey>> => {
  if (targetUserIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from('vibe_checks')
      .select('target_user_id, vibe')
      .in('target_user_id', targetUserIds);

    if (error) throw error;

    return Object.fromEntries(
      (data ?? []).map((row) => [row.target_user_id as string, row.vibe as VibeKey]),
    );
  } catch (error) {
    console.error('Error loading vibe checks:', error);
    return {};
  }
};
