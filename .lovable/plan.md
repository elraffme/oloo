# Discover Profile Indicators

## Goal
Add three compact profile-strength lines to every Discover card, calculated only from each person’s existing profile and trust data.

## What will change
- Add responsive horizontal indicators for **Smart**, **Attractive**, and **Trustworthy**, each with a clearly visible percentage.
- Keep the indicators compact so cards remain easy to scan on phones, tablets, and desktop.
- Use the existing Oloo color tokens and card styling; no new profile questions or stored scores.
- Apply the same calculations to normal Discover results and searched profiles.

## Scoring approach
- **Smart:** measure the amount of meaningful self-described context available across biography, education, occupation, interests, and languages. This is a profile-information signal, not a judgment of intelligence.
- **Attractive:** measure profile presentation strength using real photos, biography, interests, and relationship intent. It will not analyze faces, bodies, age, gender, or other sensitive traits, and will not claim objective physical attractiveness.
- **Trustworthy:** use actual trust and completeness signals, led by verified status, completed onboarding, usable photos, and meaningful profile details.
- Ignore placeholders such as “Not specified,” empty arrays, and “New to Òloo!” so they cannot inflate scores.
- Show **Not enough data** instead of a percentage when the minimum evidence for an indicator is absent.

## Technical details
- Put the scoring rules in a small documented utility with named inputs and weights so they can be adjusted later.
- Calculate scores in the browser from fields already returned by the safe Discover profile query; do not alter the database or persist inferred scores.
- Extend the Discover and search selections only with the existing `onboarding_completed` field needed for the trust calculation.
- Add an accessible indicator component using semantic progress elements and concise explanatory tooltips.
- Verify formula edge cases, card rendering, search consistency, and mobile/desktop layouts.
