# Discover Profile Listing

## Goal
Replace the one-at-a-time swipe presentation on Discover with a responsive, paginated directory of real eligible profiles, using the attached compact multi-card layout as the visual reference.

## What will change
- Show a responsive profile grid: one column on narrow phones, two on larger phones/tablets, and more columns as desktop space allows.
- Present each person in a compact card with their main photo and existing Discover details, while preserving profile viewing, messaging, friend requests, verification, interests, and other available information.
- Remove Yes/Skip, pass/like, swipe animation, “Next Profile,” and other single-profile progression controls from this Discover listing.
- Keep search working, but show matching profiles through the same non-swipe card presentation.
- Load a limited page of profiles at a time and add clear previous/next page controls; do not accumulate an unbounded list in the browser.

## Data and correctness
- Use only real records from the existing `profiles` onboarding data; remove the mock/demo fallback from Discover.
- Include only profiles eligible for discovery under the existing visibility/completion fields and access rules.
- Exclude the signed-in user in the database query and defensively in the browser.
- Use a stable ordering and deduplicate by user ID so a profile cannot appear twice or move unpredictably between pages.
- Keep the existing database structure, authentication, and profile records unchanged.

## Technical details
- Add a focused compact Discover card component rather than forcing the existing swipe-oriented card into grid use.
- Rework Discover state around page number, page size, total count, and page loading.
- Fetch only the selected page’s safe profile fields, and load friendship states for that page.
- Keep the existing full-profile viewer for detailed information, but invoke it without swipe actions.
- Verify loading, empty, populated, search, pagination, self-exclusion, deduplication, and responsive layouts on desktop and mobile.
