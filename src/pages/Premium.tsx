import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Heart, Zap, Eye, Star, Check, Loader2 } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const plans = [
  {
    key: "silver",
    name: "Silver",
    price: "$9.99",
    period: "/month",
    description: "Enhanced dating experience",
    features: [
      "Unlimited likes",
      "See who liked you",
      "5 Super Likes per day",
      "1 Boost per month",
      "No ads",
    ],
    color: "silver",
    icon: Star,
  },
  {
    key: "gold",
    name: "Gold",
    price: "$19.99",
    period: "/month",
    description: "Premium cultural connections",
    features: [
      "Everything in Silver",
      "Unlimited Super Likes",
      "5 Boosts per month",
      "Priority likes",
      "Read receipts",
      "Cultural match filter",
    ],
    color: "gold",
    icon: Crown,
    popular: true,
  },
  {
    key: "platinum",
    name: "Platinum",
    price: "$34.99",
    period: "/month",
    description: "Elite dating experience",
    features: [
      "Everything in Gold",
      "Unlimited Boosts",
      "Message before matching",
      "Priority customer support",
      "Exclusive events access",
      "Advanced filters",
    ],
    color: "platinum",
    icon: Zap,
  },
];

const Premium = () => {
  const { isPremium, tier, openCheckout, openPortal, refresh } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const returnTo = searchParams.get("return_to");

  // Handle return from Stripe — poll check-subscription until tier appears, then bounce back to return_to
  useEffect(() => {
    const status = searchParams.get("subscription");
    if (status === "success") {
      setVerifying(true);
      let attempts = 0;
      const max = 15;
      let cancelled = false;
      const tick = async () => {
        if (cancelled) return;
        attempts += 1;
        const { data } = await supabase.functions.invoke("check-subscription");
        if (data?.isPremium) {
          setVerifying(false);
          toast.success(`Welcome to ${data.tier ? data.tier.charAt(0).toUpperCase() + data.tier.slice(1) : "Premium"}!`);
          await refresh();
          // If user came from a specific page (e.g. livestream), send them back
          if (returnTo && returnTo.startsWith("/")) {
            window.location.replace(returnTo);
            return;
          }
          searchParams.delete("subscription");
          searchParams.delete("plan");
          searchParams.delete("return_to");
          setSearchParams(searchParams, { replace: true });
          return;
        }
        if (attempts >= max) {
          setVerifying(false);
          toast.message("Payment received — finalizing your membership. Please refresh in a moment.");
          searchParams.delete("subscription");
          searchParams.delete("plan");
          setSearchParams(searchParams, { replace: true });
          return;
        }
        setTimeout(tick, 2000);
      };
      tick();
      return () => { cancelled = true; };
    } else if (status === "canceled") {
      toast.error("Checkout canceled");
      searchParams.delete("subscription");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChoose = async (planKey: string) => {
    if (loadingPlan) return;
    if (isPremium) {
      toast.info("You already have an active subscription. Use Manage to change plans.");
      return;
    }
    setLoadingPlan(planKey);
    try {
      await openCheckout(planKey, returnTo ?? undefined);
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "Could not start checkout. Please try again.";
      if (msg.toLowerCase().includes("already")) {
        toast.info("You're already premium.");
        await refresh();
      } else {
        toast.error(msg);
      }
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="heart-logo mx-auto mb-6 scale-150">
            <span className="logo-text">Ò</span>
          </div>
          <h1 className="text-4xl font-bold font-afro-heading mb-4">Upgrade Your Love Life</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unlock premium features and find meaningful connections with people who share your cultural values
          </p>

          {verifying && (
            <div className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying your membership...
            </div>
          )}

          {isPremium && tier && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-amber-300/40 bg-amber-500/10 px-4 py-2">
              <Crown className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">
                Active plan: <span className="capitalize">{tier}</span>
              </span>
              <Button size="sm" variant="outline" onClick={openPortal}>
                Manage
              </Button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = isPremium && tier === plan.key;
            const isLoading = loadingPlan === plan.key;
            return (
              <Card
                key={plan.key}
                className={`membership-card ${plan.color} relative ${plan.popular ? "scale-105" : ""} ${isCurrent ? "ring-2 ring-amber-400" : ""}`}
              >
                {plan.popular && !isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white">
                    Your Plan
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <Icon className="w-12 h-12 mx-auto mb-4" />
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="opacity-90">{plan.description}</CardDescription>
                  <div className="text-3xl font-bold mt-4">
                    {plan.price}
                    <span className="text-lg font-normal opacity-70">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="w-4 h-4 opacity-70" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full bg-white/20 hover:bg-white/30 text-current border-0"
                    disabled={isLoading || isCurrent}
                    onClick={() => (isCurrent ? openPortal() : handleChoose(plan.key))}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Redirecting...
                      </>
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : (
                      `Choose ${plan.name}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="text-center cultural-card p-6">
            <Heart className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Unlimited Likes</h3>
            <p className="text-sm text-muted-foreground">Never run out of chances to connect</p>
          </div>
          <div className="text-center cultural-card p-6">
            <Eye className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">See Who Likes You</h3>
            <p className="text-sm text-muted-foreground">No more guessing - see your admirers</p>
          </div>
          <div className="text-center cultural-card p-6">
            <Zap className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Super Boosts</h3>
            <p className="text-sm text-muted-foreground">Get 10x more profile views</p>
          </div>
          <div className="text-center cultural-card p-6">
            <Star className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Cultural Filters</h3>
            <p className="text-sm text-muted-foreground">Find matches who share your heritage</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Premium;
