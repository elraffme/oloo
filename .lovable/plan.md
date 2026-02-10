

# Fix: Registered Users Incorrectly Redirected to Onboarding

## Root Cause

The `onAuthStateChange` handler in `AuthContext.tsx` has a **catch-all error handler** (line 130-136) that redirects to `/onboarding` whenever *any* error occurs during the post-login flow. This means:

- If the profile query fails due to a network hiccup, users go to onboarding
- If the `log_security_event` RPC fails, users go to onboarding
- If any other error occurs in the try block, users go to onboarding

This happens even for users whose `onboarding_completed` is already `true`.

Additionally, the `log_security_event` call shares the same `try/catch` as the profile check, so a failure in logging incorrectly triggers the onboarding redirect.

## Fix

### Change 1: Separate the profile check from the security logging (AuthContext.tsx)

Move the `log_security_event` call into its own try/catch so it can't interfere with the redirect logic.

### Change 2: Fix the catch block to not blindly redirect to onboarding

Instead of redirecting to `/onboarding` on error, the catch block should:
- Log the error
- Attempt a simple retry of just the profile query
- Only redirect to `/onboarding` if the profile genuinely doesn't exist or has `onboarding_completed: false`
- If the query keeps failing, redirect to `/app` as a safer default (since most users are returning users)

### Change 3: Guard against duplicate event firing

Add a check for `INITIAL_SESSION` event to skip the redirect logic on page load for already-authenticated users who are on protected pages, preventing unnecessary re-checks.

## Technical Details

**File: `src/contexts/AuthContext.tsx`** (lines 60-139)

The `onAuthStateChange` handler will be restructured:

```text
if (event === 'SIGNED_IN' && session?.user) {
  setTimeout(async () => {
    // ... email verification check (unchanged) ...

    let profile = null;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', session.user.id)
        .single();
      profile = data;
    } catch (error) {
      console.error('Failed to check profile:', error);
      // Don't redirect on error - stay on current page
      return;
    }

    // Handle pending onboarding data (unchanged) ...
    // Clear pending states (unchanged) ...

    // Redirect based on profile status
    const currentPath = window.location.pathname;
    const authPages = ['/signin', '/auth', '/', '/auth/verify'];
    if (authPages.includes(currentPath)) {
      if (profile?.onboarding_completed === true) {
        window.location.href = '/app';
      } else {
        window.location.href = '/onboarding';
      }
    }

    // Log security event separately - failure won't affect redirects
    try {
      await supabase.rpc('log_security_event', { ... });
    } catch (e) {
      console.error('Failed to log security event:', e);
    }
  }, 0);
}
```

Key changes:
- Profile query has its own try/catch that returns (stays on page) on failure instead of redirecting to onboarding
- Security event logging is in a separate try/catch
- No more blanket redirect to onboarding on error

