import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionState {
  isPremium: boolean;
  tier: string | null;
  loading: boolean;
  subscriptionEnd: string | null;
  refresh: () => Promise<void>;
  openCheckout: (plan?: string, returnTo?: string) => Promise<void>;
  openPortal: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState | null>(null);

export const SubscriptionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [tier, setTier] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setIsPremium(false);
      setTier(null);
      setSubscriptionEnd(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setIsPremium(!!data?.isPremium);
      setTier(data?.tier ?? null);
      setSubscriptionEnd(data?.subscription_end ?? null);
    } catch (err) {
      console.warn('[subscription] check failed', err);
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (user) {
      intervalRef.current = setInterval(refresh, 60_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, refresh]);

  // Global post-Stripe handler: works on ANY page the user lands on after checkout.
  // Polls check-subscription until isPremium=true, then strips the query params.
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") !== "success") return;

    let cancelled = false;
    let attempts = 0;
    const max = 20;
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const { data } = await supabase.functions.invoke("check-subscription");
        if (data?.isPremium) {
          setIsPremium(true);
          setTier(data.tier ?? null);
          setSubscriptionEnd(data.subscription_end ?? null);
          // Strip success params from URL so the prompt never reappears on refresh.
          const url = new URL(window.location.href);
          url.searchParams.delete("subscription");
          url.searchParams.delete("plan");
          url.searchParams.delete("return_to");
          window.history.replaceState({}, "", url.toString());
          return;
        }
      } catch (e) {
        console.warn("[subscription] post-checkout poll failed", e);
      }
      if (attempts < max) setTimeout(tick, 2000);
    };
    tick();
    return () => { cancelled = true; };
  }, [user]);

  const openCheckout = useCallback(async (plan: string = 'premium', returnTo?: string) => {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { plan, return_to: returnTo },
    });
    if (error) throw error;
    if (data?.url) window.location.href = data.url;
  }, []);

  const openPortal = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('customer-portal');
    if (error) throw error;
    if (data?.url) window.open(data.url, '_blank');
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{ isPremium, tier, loading, subscriptionEnd, refresh, openCheckout, openPortal }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return ctx;
};
