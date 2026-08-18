import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Loader2 } from "lucide-react";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; balance: number; awarded: number; already: boolean }
  | { kind: "error"; message: string };

const ERROR_COPY: Record<string, string> = {
  invalid_token: "This claim link is not valid.",
  claim_not_found_or_used: "This claim link has already been used or is no longer valid.",
  claim_token_expired: "This claim link has expired. Please request a new one from join.oloo.media.",
  claim_not_pending: "These founding credits have already been claimed.",
  email_mismatch:
    "Your Òloo account email does not match the email on your waitlist signup. Sign in with the same email to claim.",
  email_not_verified: "Please verify your Òloo account email before claiming.",
  account_already_claimed: "This Òloo account has already received founding credits.",
  authentication_required: "Please sign in to claim your founding credits.",
};

const ClaimFounding = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "idle" });

  const claim = async () => {
    setState({ kind: "loading" });
    const { data, error } = await supabase.functions.invoke("claim-founding-credits", {
      body: { token },
    });
    if (error && !data) {
      setState({ kind: "error", message: "Something went wrong. Please try again." });
      return;
    }
    const result = data as Record<string, unknown>;
    if (result?.success) {
      setState({
        kind: "success",
        balance: Number(result.balance ?? 0),
        awarded: Number(result.credits_awarded ?? 0),
        already: result.status === "already_claimed",
      });
    } else {
      const code = String(result?.error ?? "");
      setState({ kind: "error", message: ERROR_COPY[code] ?? "We could not complete your claim." });
    }
  };

  useEffect(() => {
    if (!authLoading && user && token && state.kind === "idle") claim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token]);

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
          {!token && <p className="text-sm text-destructive">This claim link is missing its token.</p>}

          {token && !authLoading && !user && (
            <>
              <p className="text-sm text-muted-foreground">
                Sign in to Òloo with the same email you used on the waitlist to receive your Oloo Points.
              </p>
              <Button
                className="w-full"
                onClick={() =>
                  navigate(`/auth?return_to=${encodeURIComponent(`/claim-founding?token=${token}`)}`)
                }
              >
                Continue to sign in
              </Button>
            </>
          )}

          {(authLoading || state.kind === "loading") && token && (
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
              <Button variant="outline" className="w-full" onClick={() => navigate("/app")}>
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
