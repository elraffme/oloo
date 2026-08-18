export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-timestamp, x-nonce, x-signature, x-idempotency-key, x-source",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const MAX_SKEW_SECONDS = 300;

export type VerifyResult =
  | { ok: true; timestamp: number; nonce: string; source: string; idempotencyKey: string }
  | { ok: false; status: number; error: string };

export async function verifySignedRequest(
  req: Request,
  rawBody: string,
  secret: string,
  opts: { requireIdempotencyKey: boolean; allowedSources: string[] },
): Promise<VerifyResult> {
  const timestampRaw = req.headers.get("x-timestamp") ?? "";
  const nonce = req.headers.get("x-nonce") ?? "";
  const signature = (req.headers.get("x-signature") ?? "").trim().toLowerCase();
  const source = req.headers.get("x-source") ?? "";
  const idempotencyKey = req.headers.get("x-idempotency-key") ?? "";

  if (!timestampRaw || !nonce || !signature || !source) {
    return { ok: false, status: 400, error: "missing_signature_headers" };
  }
  if (!opts.allowedSources.includes(source)) {
    return { ok: false, status: 403, error: "unknown_source" };
  }
  if (opts.requireIdempotencyKey && idempotencyKey.length < 8) {
    return { ok: false, status: 400, error: "missing_idempotency_key" };
  }
  if (nonce.length < 8 || nonce.length > 128) {
    return { ok: false, status: 400, error: "invalid_nonce" };
  }

  // Accept both seconds and milliseconds epoch values.
  let ts = Number(timestampRaw);
  if (!Number.isFinite(ts)) return { ok: false, status: 400, error: "invalid_timestamp" };
  if (ts > 1e12) ts = Math.floor(ts / 1000);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_SKEW_SECONDS) {
    return { ok: false, status: 401, error: "timestamp_out_of_window" };
  }

  const expected = await hmacHex(secret, `${timestampRaw}.${nonce}.${rawBody}`);
  if (!timingSafeEqual(expected, signature)) {
    return { ok: false, status: 401, error: "invalid_signature" };
  }

  return { ok: true, timestamp: ts, nonce, source, idempotencyKey };
}
