import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Loader2 } from "lucide-react";
import {
  FOUNDING_CLAIM_PENDING_KEY,
  FOUNDING_CLAIM_TOKEN_KEY,
  redeemFoundingClaim,
} from "@/hooks/useFoundingClaim";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "needs-auth" }
  | { kind: "success"; balance: number; awarded: number; already: boolean }
  | { kind: "error"; message: string };

const ClaimFounding = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "idle" });

  // Persist the claim reference so it survives /auth -> Google -> onboarding -> /app.
  // The marker is set even without a token: the edge function can resolve the
  // pending claim from the authenticated user's verified email.
  useEffect(() => {
    if (token) localStorage.setItem(FOUNDING_CLAIM_TOKEN_KEY, token);
    localStorage.setItem(FOUNDING_CLAIM_PENDING_KEY, "1");
  }, [token]);

  const claim = useCallback(async () => {
    setState({ kind: "loading" });
    const result = await redeemFoundingClaim(token || localStorage.getItem(FOUNDING_CLAIM_TOKEN_KEY));
    if (result.ok) {
      localStorage.removeItem(FOUNDING_CLAIM_TOKEN_KEY);
      localStorage.removeItem(FOUNDING_CLAIM_PENDING_KEY);
      window.dispatchEvent(new Event("oloo:currency-refresh"));
      setState({ kind: "success", balance: result.balance, awarded: result.awarded, already: result.already });
    } else if (result.code === "authentication_required") {
      // Not signed in yet — this is the normal new-user path, not an error.
      setState({ kind: "needs-auth" });
    } else {
      setState({ kind: "error", message: result.message });
    }
  }, [token]);

  // Only attempt redemption once an authenticated Main Òloo session exists.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ kind: "needs-auth" });
      return;
    }
    setState((s) => (s.kind === "idle" || s.kind === "needs-auth" ? { kind: "loading" } : s));
    claim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, token]);

  const continueToSignIn = () => {
    // Persist synchronously before leaving this route. A full navigation is
    // intentional: it guarantees the auth page loads even if React Router is
    // interrupted while the OAuth flow is being initialized.
    const claimToken = token || localStorage.getItem(FOUNDING_CLAIM_TOKEN_KEY) || "";
    if (claimToken) localStorage.setItem(FOUNDING_CLAIM_TOKEN_KEY, claimToken);
    localStorage.setItem(FOUNDING_CLAIM_PENDING_KEY, "1");

    const claimPath = claimToken
      ? `/claim-founding?token=${encodeURIComponent(claimToken)}`
      : "/claim-founding";
    window.location.assign(`/auth?return_to=${encodeURIComponent(claimPath)}`);
  };

  const showAuthCta = !authLoading && !user && (state.kind === "needs-auth" || state.kind === "idle");

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Coins className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="font-afro-heading text-2xl">Welcome to Òloo</CardTitle>
          <CardDescription>
            Claim your 500 Oloo Points — your founding credits are ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {showAuthCta && (
            <>
              <p className="text-sm text-muted-foreground">
                Sign up or sign in to Òloo with the same email you used on the waitlist to receive your
                Oloo Points. Your claim is saved and applied automatically once your account is ready.
              </p>
              <Button className="w-full" onClick={continueToSignIn}>
                Continue to sign up
              </Button>
            </>
          )}

          {(authLoading || state.kind === "loading") && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying your claim…
            </div>
          )}

          {state.kind === "success" && (
            <>
              <p className="text-lg font-semibold">
                {state.already
                  ? "You have already claimed your 500 Oloo Points."
                  : `${state.awarded} Oloo Points added!`}
              </p>
              <p className="text-sm text-muted-foreground">
                Your Òloo balance is {state.balance.toLocaleString()} Oloo Points.
              </p>
              <Button className="w-full" onClick={() => navigate("/app")}>
                Enter Òloo
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/app/shop")}>
                Visit the shop
              </Button>
            </>
          )}

          {state.kind === "error" && (
            <>
              <p className="text-sm text-destructive">{state.message}</p>
              <Button variant="outline" className="w-full" onClick={() => claim()}>
                Try again
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate("/app")}>
                Continue to Òloo
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ClaimFounding;
