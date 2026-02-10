

# Debug & Fix: Registration, Login, and OAuth Issues

## Issues Found

### Issue 1: signIn() sets global loading state, blocking the UI
In `AuthContext.tsx`, the `signIn` function sets `setLoading(true)` at line 155. This causes the `SignIn` page (and `Auth` page) to render a loading spinner instead of the form. While loading is true, the redirect logic in `useEffect` on the SignIn page won't fire because it checks `!loading`. This creates a timing issue where:
- User submits login
- `loading` becomes `true` -> spinner shows
- `onAuthStateChange` fires with `SIGNED_IN` -> tries to redirect
- But the SignIn page's own redirect logic also fires, causing conflicts

**Fix:** Remove `setLoading(true)` from `signIn()` (same pattern already used in `signUp()`). Use only the local `isSubmitting` state for button feedback.

### Issue 2: OAuth redirect URL lands on `/` (Landing Page) causing race condition
All OAuth providers redirect to `${window.location.origin}/` which loads the `LandingPage` component. The `onAuthStateChange` listener then tries to redirect, but there's a race where the landing page renders first. The landing page has no auth-aware redirect logic.

**Fix:** Change OAuth `redirectTo` to `${window.location.origin}/auth` for all 4 providers (Google, Twitter, Facebook, LinkedIn). The `/auth` page already has proper redirect logic that checks profile completion.

### Issue 3: Duplicate/conflicting redirect logic in SignIn page
The `SignIn` page has THREE layers of redirect logic:
1. `useEffect` checking `hasProfile` state
2. `handleSignIn` manually checking profile after login
3. `AuthContext.onAuthStateChange` also redirecting

These can conflict and cause loops or stuck states.

**Fix:** Remove the manual redirect from `handleSignIn` in SignIn page - let `AuthContext.onAuthStateChange` handle all post-login routing consistently.

### Issue 4: SignIn page has a `hasProfile` null-check that blocks rendering
The SignIn page checks `hasProfile !== null` before redirecting (line 56-61). While `hasProfile` is `null` (loading), the page continues rendering. But if `signIn` sets `loading=true`, the page shows a spinner. When `loading` becomes `false`, the `useEffect` fires again, queries the profile, and may race with `onAuthStateChange`.

**Fix:** Simplify the SignIn page to not duplicate profile-check logic.

### Issue 5: Twitter OAuth user has null email
User `f630cf56` signed in via Twitter but has `email: null`. If any code assumes email exists, it will fail. The profile was created with defaults.

**Fix:** Add null-safety for `user.email` throughout the auth flow.

### Issue 6: Two recent Google users stuck with incomplete onboarding
Users `97671e92` and `22933e49` signed in via Google but never completed onboarding (`onboarding_completed: false`). This suggests the redirect to `/onboarding` after OAuth may not be working reliably.

**Fix:** Already addressed by fixing Issue 2 (OAuth redirect URL).

---

## Implementation Plan

### Step 1: Fix signIn() loading state (AuthContext.tsx)
- Remove `setLoading(true)` and `setLoading(false)` from the `signIn` function
- The `onAuthStateChange` listener already handles setting loading to false after auth events
- This matches the pattern already used in `signUp()`

### Step 2: Fix OAuth redirect URLs (AuthContext.tsx)
- Change `redirectTo` from `${window.location.origin}/` to `${window.location.origin}/auth` in all 4 OAuth functions (Google, Twitter, Facebook, LinkedIn)
- The `/auth` page has proper auth-aware redirect logic that checks onboarding status

### Step 3: Simplify SignIn page redirect logic (SignIn.tsx)
- Remove the `hasProfile` state and its `useEffect` that queries the profile
- Remove the early return that redirects based on `hasProfile`
- Remove the manual profile check and redirect inside `handleSignIn`
- Add a simple redirect: if user exists and not loading, let `AuthContext.onAuthStateChange` handle it
- Keep only a basic check: if user is logged in, show a "Redirecting..." state

### Step 4: Simplify Auth page redirect logic (Auth.tsx)
- The existing redirect logic in `useEffect` is mostly correct but conflicts with `AuthContext`
- Simplify to just check if user is logged in and redirect (let AuthContext handle the destination)

### Step 5: Add null-safety for email (AuthContext.tsx, AuthVerify.tsx)
- Add optional chaining and fallbacks where `user.email` is used
- Ensure the verification resend flow handles missing emails gracefully

### Step 6: Fix email signup redirect URL (AuthContext.tsx)
- Change the `signUp` `emailRedirectTo` from `${window.location.origin}/` to `${window.location.origin}/auth` for consistency
- This ensures verified email users land on a page with proper redirect logic

---

## Technical Details

### Files to modify:

| File | Changes |
|------|---------|
| `src/contexts/AuthContext.tsx` | Remove loading state from signIn(), fix OAuth redirect URLs, fix signup redirect URL |
| `src/pages/SignIn.tsx` | Remove duplicate redirect logic, simplify to single auth check |
| `src/pages/Auth.tsx` | Minor cleanup of redirect logic to avoid conflicts |

### Expected behavior after fixes:
1. **Email Registration:** User registers -> sees verification email screen -> clicks link -> lands on `/auth` -> `onAuthStateChange` fires -> redirects to `/onboarding`
2. **Email Login:** User enters credentials -> `signIn()` called (no global loading) -> `onAuthStateChange` fires -> checks profile -> redirects to `/app` or `/onboarding`
3. **OAuth Login:** User clicks provider button -> completes OAuth -> redirected to `/auth` -> `onAuthStateChange` fires -> checks profile -> redirects appropriately
4. **Returning user:** Already logged in -> `onAuthStateChange` on page load -> redirects based on onboarding status
