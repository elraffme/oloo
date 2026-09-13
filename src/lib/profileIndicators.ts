export interface ProfileIndicatorInput {
  bio?: string | null;
  occupation?: string | null;
  education?: string | null;
  interests?: string[] | null;
  languages?: string[] | null;
  profile_photos?: string[] | null;
  relationship_goals?: string | null;
  verified?: boolean | null;
  onboarding_completed?: boolean | null;
}

export type ProfileIndicatorKey = 'smart' | 'attractive' | 'trustworthy';

export interface ProfileIndicatorScore {
  key: ProfileIndicatorKey;
  label: string;
  score: number | null;
  description: string;
}

const PLACEHOLDER_VALUES = new Set([
  '',
  '-',
  'n/a',
  'not specified',
  'new to òloo!',
  'new to oloo!',
]);

const hasMeaningfulText = (value?: string | null, minimumLength = 2) => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.length >= minimumLength && !PLACEHOLDER_VALUES.has(normalized);
};

const meaningfulItems = (values?: string[] | null) =>
  values?.filter((value) => hasMeaningfulText(value)) ?? [];

const boundedScore = (score: number) => Math.min(100, Math.max(0, Math.round(score)));

/**
 * These are profile-strength indicators, not psychological or physical ratings.
 * Each weight is intentionally named and kept here so the product team can audit
 * and adjust the formula without changing the Discover presentation.
 */
export const calculateProfileIndicators = (
  profile: ProfileIndicatorInput,
): ProfileIndicatorScore[] => {
  const hasBio = hasMeaningfulText(profile.bio, 20);
  const hasEducation = hasMeaningfulText(profile.education);
  const hasOccupation = hasMeaningfulText(profile.occupation);
  const interests = meaningfulItems(profile.interests);
  const languages = meaningfulItems(profile.languages);
  const photos = meaningfulItems(profile.profile_photos);
  const hasRelationshipGoal = hasMeaningfulText(profile.relationship_goals);

  // Smart reflects how much meaningful personal context a member has shared.
  const smartEvidence = [hasBio, hasEducation, hasOccupation, interests.length > 0, languages.length > 0]
    .filter(Boolean).length;
  const smartScore = smartEvidence < 2
    ? null
    : boundedScore(
      (hasBio ? 25 : 0)
      + (hasEducation ? 25 : 0)
      + (hasOccupation ? 20 : 0)
      + Math.min(interests.length, 3) * 5
      + Math.min(languages.length, 2) * 7.5,
    );

  // Attractive reflects profile presentation only; no face, body, age, or gender analysis is used.
  const photoStrength = photos.length >= 3 ? 45 : photos.length === 2 ? 35 : photos.length === 1 ? 25 : 0;
  const presentationEvidence = [photos.length > 0, hasBio, interests.length > 0, hasRelationshipGoal]
    .filter(Boolean).length;
  const attractiveScore = photos.length === 0 || presentationEvidence < 2
    ? null
    : boundedScore(
      photoStrength
      + (hasBio ? 20 : 0)
      + Math.min(interests.length, 3) * 5
      + (hasRelationshipGoal ? 20 : 0),
    );

  // Trustworthy prioritizes the real verification flag, then profile completeness signals.
  const trustEvidence = [
    profile.verified === true,
    profile.onboarding_completed === true,
    photos.length > 0,
    hasBio,
    hasRelationshipGoal,
  ].filter(Boolean).length;
  const trustworthyScore = trustEvidence < 2
    ? null
    : boundedScore(
      (profile.verified === true ? 45 : 0)
      + (profile.onboarding_completed === true ? 20 : 0)
      + (photos.length > 0 ? 15 : 0)
      + (hasBio ? 10 : 0)
      + (hasRelationshipGoal ? 10 : 0),
    );

  return [
    {
      key: 'smart',
      label: 'Smart',
      score: smartScore,
      description: 'Based on meaningful bio, education, occupation, interests, and languages shared.',
    },
    {
      key: 'attractive',
      label: 'Attractive',
      score: attractiveScore,
      description: 'Based on profile presentation: photos, bio, interests, and relationship intent.',
    },
    {
      key: 'trustworthy',
      label: 'Trustworthy',
      score: trustworthyScore,
      description: 'Based on verification and profile completeness signals.',
    },
  ];
};