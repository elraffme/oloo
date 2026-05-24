import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Sparkles,
  Check,
  Copy,
  Share2,
  Users,
  Crown,
  Radio,
  Lock,
  Loader2,
} from "lucide-react";
import heroImage from "@/assets/waitlist-hero.jpg";

// Launch date — 30 days from project creation reference
const LAUNCH_DATE = new Date("2026-07-01T12:00:00Z");

const waitlistSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  username: z
    .string()
    .trim()
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]*$/, "Letters, numbers, _ . - only")
    .optional()
    .or(z.literal("")),
});

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff / 3_600_000) % 24);
  const minutes = Math.floor((diff / 60_000) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

function CountdownCell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[68px] sm:min-w-[88px]">
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md px-3 sm:px-5 py-3 sm:py-4 shadow-xl">
        <span className="font-afro-heading text-3xl sm:text-5xl tabular-nums text-white">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="mt-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/60">
        {label}
      </span>
    </div>
  );
}

export default function Waitlist() {
  const [params] = useSearchParams();
  const refFromUrl = params.get("ref") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedUp, setSignedUp] = useState<{
    referralCode: string;
  } | null>(null);
  const [count, setCount] = useState<number | null>(null);

  const { days, hours, minutes, seconds } = useCountdown(LAUNCH_DATE);

  useEffect(() => {
    supabase
      .rpc("get_waitlist_count")
      .then(({ data }) => typeof data === "number" && setCount(data));
  }, [signedUp]);

  const inviteUrl = useMemo(() => {
    if (!signedUp) return "";
    return `${window.location.origin}/waitlist?ref=${signedUp.referralCode}`;
  }, [signedUp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = waitlistSchema.safeParse({ name, email, username });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("waitlist")
        .insert({
          name: parsed.data.name,
          email: parsed.data.email.toLowerCase(),
          username: parsed.data.username || null,
          referred_by_code: refFromUrl || null,
          source: "landing",
        })
        .select("referral_code")
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("You are already on the waitlist.");
        } else {
          toast.error(error.message || "Something went wrong. Please try again.");
        }
        return;
      }

      toast.success("Welcome to the waitlist! We'll notify you before launch.");
      setSignedUp({ referralCode: data.referral_code });
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
  };

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join the Òloo waitlist",
          text: "I just joined Òloo — the premium livestream dating community. Join me before launch:",
          url: inviteUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copyInvite();
    }
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground relative overflow-hidden scroll-smooth">
      {/* Background image + overlays */}
      <div className="absolute inset-0 -z-10">
        <img
          src={heroImage}
          alt="People connecting through livestream"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-accent/20 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full romantic-gradient flex items-center justify-center">
            <span className="text-primary-foreground font-bold">Ò</span>
          </div>
          <span className="font-afro-heading text-xl">Òloo</span>
        </Link>
        <span className="hidden sm:inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/60">
          <Sparkles className="w-3.5 h-3.5" /> Pre-launch
        </span>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 sm:px-10 pt-6 pb-24">
        <section className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur px-3 py-1 text-xs text-white/70">
              <Lock className="w-3.5 h-3.5" /> Limited Early Access
            </span>
            <h1 className="mt-5 font-afro-heading text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
              The livestream dating <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-primary via-accent to-primary-glow bg-clip-text text-transparent">
                community is coming.
              </span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/70 max-w-xl">
              Meet, stream, and connect with real people in real time. Be among
              the first to experience Òloo — an exclusive community built for
              meaningful connection.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {[
                { icon: Crown, label: "Founding member perks" },
                { icon: Radio, label: "Exclusive livestream rooms" },
                { icon: Users, label: "Invite-only at launch" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 backdrop-blur"
                >
                  <Icon className="w-3.5 h-3.5 text-primary" /> {label}
                </span>
              ))}
            </div>

            {count !== null && (
              <p className="mt-6 text-sm text-white/60">
                <span className="text-white font-semibold">
                  {count.toLocaleString()}
                </span>{" "}
                people already on the waitlist
              </p>
            )}
          </div>

          {/* Form / Success */}
          <Card className="relative p-6 sm:p-8 bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl rounded-3xl animate-scale-in">
            {!signedUp ? (
              <>
                <h2 className="font-afro-heading text-2xl">Join the waitlist</h2>
                <p className="text-sm text-white/60 mt-1">
                  Get early access + founding member perks.
                </p>
                {refFromUrl && (
                  <p className="mt-3 text-xs text-primary">
                    🎉 You were invited by code{" "}
                    <span className="font-mono">{refFromUrl}</span>
                  </p>
                )}
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      required
                      maxLength={100}
                      className="mt-1.5 bg-background/40 border-white/10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      maxLength={255}
                      className="mt-1.5 bg-background/40 border-white/10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="username">
                      Username{" "}
                      <span className="text-white/40 text-xs">(optional)</span>
                    </Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@yourhandle"
                      maxLength={50}
                      className="mt-1.5 bg-background/40 border-white/10"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    size="lg"
                    className="w-full romantic-gradient text-primary-foreground border-0 hover:scale-[1.02] transition-transform rounded-xl"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                        Joining…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" /> Join Waitlist
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-white/40 text-center">
                    No spam. Unsubscribe anytime.
                  </p>
                </form>
              </>
            ) : (
              <div className="text-center py-4 animate-fade-in">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="w-7 h-7 text-primary" />
                </div>
                <h2 className="mt-4 font-afro-heading text-2xl">
                  You're officially on the waitlist!
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  Invite friends to move up the waitlist.
                </p>

                <div className="mt-5 flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-white/10">
                  <span className="flex-1 truncate text-xs sm:text-sm text-white/80 px-2 text-left">
                    {inviteUrl}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={copyInvite}
                    className="hover:bg-white/10"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  onClick={shareInvite}
                  size="lg"
                  className="mt-4 w-full romantic-gradient text-primary-foreground border-0 rounded-xl hover:scale-[1.02] transition-transform"
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share your invite
                </Button>

                <p className="mt-4 text-xs text-white/50">
                  Your referral code:{" "}
                  <span className="font-mono text-white/80">
                    {signedUp.referralCode}
                  </span>
                </p>
              </div>
            )}
          </Card>
        </section>

        {/* Countdown */}
        <section className="mt-24 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Launching in
          </p>
          <div className="mt-5 flex justify-center gap-3 sm:gap-5">
            <CountdownCell value={days} label="Days" />
            <CountdownCell value={hours} label="Hours" />
            <CountdownCell value={minutes} label="Minutes" />
            <CountdownCell value={seconds} label="Seconds" />
          </div>
          <p className="mt-6 text-sm text-white/60 max-w-md mx-auto">
            Founding members get early access, exclusive badges, and lifetime
            perks reserved for the first community.
          </p>
        </section>

        {/* Perks grid */}
        <section className="mt-24 grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: Crown,
              title: "Founding badge",
              desc: "Permanent founder badge on your profile.",
            },
            {
              icon: Radio,
              title: "First livestreams",
              desc: "Access exclusive launch streams before anyone else.",
            },
            {
              icon: Users,
              title: "Private community",
              desc: "Invite-only spaces with the first members.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <Card
              key={title}
              className="p-6 bg-white/5 backdrop-blur-md border-white/10 rounded-2xl hover:bg-white/[0.08] transition-colors"
            >
              <Icon className="w-6 h-6 text-primary" />
              <h3 className="mt-4 font-afro-heading text-lg">{title}</h3>
              <p className="mt-1 text-sm text-white/60">{desc}</p>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
