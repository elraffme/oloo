# Chief, Priest, King tiers and dimensional gifts

## Membership tiers
- Replace the three public membership names with:
  - **Chief** — current Free plan
  - **Priest** — current Silver plan
  - **King** — current Gold plan
- Show only these three levels in membership selection and promotional sections; remove Platinum from the public plan list.
- Update user-facing references such as “Everything in Silver/Gold,” active-plan labels, checkout confirmations, upgrade prompts, badges, and translated membership copy.
- Keep the existing internal `free`, `silver`, `gold`, and legacy `platinum` identifiers unchanged so Stripe subscriptions, permissions, stored memberships, and streaming limits continue to work. Existing Platinum subscribers will retain their benefits and be presented with the top-level **King** label.

## Gift catalogue
- Keep free livestream reactions unchanged.
- Replace the paid gift catalogue with these eight gifts, in this order:
  1. Ankara Hand-Fan
  2. Ankara Robe
  3. Silver Flywhisk
  4. Corallium Red Coral Beads
  5. Beaded Crown
  6. Royal Golden Stool
  7. Golden Scepter
  8. Golden Crown
- Preserve the current price ladder and transaction rules. Reuse the existing paid gift prices in ascending order (`10, 25, 25, 50, 50, 100, 250`) and give the added eighth gift an existing top price of `250` Oloo Points.
- Apply the catalogue change through a database migration so selectors, transactions, realtime broadcasts, and gift history all use the same authoritative names without duplicate catalogue entries.

## Animated 3D-style gift artwork
- Create a cohesive image asset for each gift with Afrocentric materials and recognizable silhouettes: Ankara fabric, polished silver, coral beads, beadwork, carved royal wood, and reflective gold.
- Replace emoji-only paid gift presentation with the new artwork in the gift picker, livestream notifications, and received-gift reveal.
- Add lightweight CSS perspective, layered shadows, reflective highlights, tilt/rotation, scale, and sparkle/particle entrance effects to create depth without adding a heavy WebGL renderer.
- Keep animations short, touch-friendly, mobile-safe, and disabled or simplified when reduced motion is requested.

## Verification
- Confirm Chief, Priest, and King appear consistently while checkout still sends the original internal plan keys.
- Confirm all eight paid gifts load in order with preserved prices, can be selected, and retain existing affordability and sending behavior.
- Verify the dimensional gift artwork and animations on desktop and mobile livestream views, with no clipping, overlap, console errors, or broken assets.

## Technical details
- Likely frontend areas: membership cards/page, subscription display helpers, wallet/VIP labels, upgrade prompts, gift selectors, gift animations, global styles, and locale strings.
- Database area: `public.gifts` catalogue rows only; no schema or permission changes are needed.
- Generated artwork will be stored locally in the project and referenced through the existing `asset_url` field.
