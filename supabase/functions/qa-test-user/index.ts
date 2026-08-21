// TEMPORARY QA helper — creates/deletes a throwaway confirmed test user so the
// new-user onboarding flow can be reproduced end to end. Delete after use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const QA_TOKEN = "qa-6f1b0c2e-9d4a-4a77-bd51-onboarding-repro";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.headers.get("x-qa-token") !== QA_TOKEN) {
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = String(body.action ?? "create");

  if (action === "delete") {
    const { error } = await admin.auth.admin.deleteUser(String(body.user_id));
    return Response.json({ ok: !error, error: error?.message ?? null });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: String(body.email),
    password: String(body.password),
    email_confirm: true,
    app_metadata: { provider: "google", providers: ["google"] },
  });
  return Response.json({ ok: !error, user_id: data?.user?.id ?? null, error: error?.message ?? null });
});
