// NOWPayments API helpers shared by crypto-invoice and nowpayments-ipn.
//
// Secrets (set with `npx supabase secrets set …`):
//   NOWPAYMENTS_API_KEY      API key from the NOWPayments dashboard
//   NOWPAYMENTS_IPN_SECRET   IPN secret key (Settings → Payments → Instant payment notifications)
//   NOWPAYMENTS_SANDBOX      "true" to use the sandbox (separate sandbox account and keys)
// Optional:
//   NOWPAYMENTS_PRICE_CURRENCY  fiat the amount is expressed in, default "mad"
//   SITE_URL                    where the client lands after paying, default the GitHub Pages site

export const npConfig = () => {
  const sandbox = Deno.env.get("NOWPAYMENTS_SANDBOX") === "true";
  return {
    key: Deno.env.get("NOWPAYMENTS_API_KEY") ?? "",
    ipnSecret: Deno.env.get("NOWPAYMENTS_IPN_SECRET") ?? "",
    sandbox,
    base: sandbox ? "https://api-sandbox.nowpayments.io/v1" : "https://api.nowpayments.io/v1",
    currency: (Deno.env.get("NOWPAYMENTS_PRICE_CURRENCY") ?? "mad").toLowerCase(),
    site: Deno.env.get("SITE_URL") ?? "https://mohammed290z.github.io/carsw6/",
  };
};

export async function np(path: string, init: RequestInit = {}) {
  const { base, key } = npConfig();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "x-api-key": key, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// NOWPayments signs each notification: HMAC-SHA512 of the JSON body with its keys sorted
// alphabetically (recursively), hex-encoded, in the x-nowpayments-sig header.
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]));
  }
  return v;
}

export async function signature(body: unknown, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(JSON.stringify(sortDeep(body))));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
