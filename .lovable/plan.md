

# Store Newsletter Subscription Emails

## Overview
Create a database table to store newsletter subscription emails and update the Footer component to save emails to Supabase instead of just simulating the subscription.

## Implementation Steps

### 1. Create Database Table
Create a new `newsletter_subscriptions` table with the following structure:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | TEXT | Subscriber's email (unique) |
| subscribed_at | TIMESTAMP | When they subscribed |
| is_active | BOOLEAN | Whether subscription is active (default: true) |
| source | TEXT | Where they signed up from (e.g., "footer") |
| ip_address | INET | For spam prevention (optional) |

### 2. Security Setup
- **RLS Policy**: Allow anyone (including non-logged-in visitors) to insert their email
- **Unique Constraint**: Prevent duplicate email entries
- **No SELECT for public**: Only admins should be able to view the list

### 3. Update Footer Component
Modify `src/components/Footer.tsx` to:
- Import the Supabase client
- Replace the simulated delay with an actual database insert
- Handle duplicate email gracefully (show friendly message if already subscribed)
- Keep the existing validation logic

## Technical Details

**Database Migration:**
```sql
CREATE TABLE newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'footer',
  ip_address INET
);

-- Allow public inserts (for non-logged-in users)
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe to newsletter"
ON newsletter_subscriptions FOR INSERT
WITH CHECK (true);

-- Only admins can view subscribers
CREATE POLICY "Only admins can view subscribers"
ON newsletter_subscriptions FOR SELECT
USING (is_admin());
```

**Code Changes:**
- File: `src/components/Footer.tsx`
- Add Supabase import and replace simulation with actual insert

## Files to Modify
1. **New migration** - Create the newsletter_subscriptions table
2. **src/components/Footer.tsx** - Connect to Supabase for real storage

