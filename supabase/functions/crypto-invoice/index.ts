// Creates a NOWPayments payment link (invoice) for a reservation. Staff only.
//
//   { action: "create", reservation_id, amount? }   amount in MAD, defaults to the estimate
//   { action: "health" }                            no login needed; says whether payments are set up
import { cors, json, serviceClient } from "../_shared/http.ts";
import { np, npConfig } from "../_shared/nowpayments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "method" }, 405);
  const cfg = npConfig();
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json(req, { error: "bad_body" }, 400); }

  if (body.action === "health") {
    // reveals no secrets: only whether things are configured and reachable
    const configured = Boolean(cfg.key && cfg.ipnSecret);
    let api = false, currency = false;
    if (cfg.key) {
      api = (await np("/status")).ok;
      const est = await np(`/estimate?amount=1000&currency_from=${cfg.currency}&currency_to=usdttrc20`);
      currency = est.ok;
    }
    return json(req, { configured, sandbox: cfg.sandbox, api, price_currency: cfg.currency, currency_supported: currency });
  }

  if (body.action !== "create") return json(req, { error: "unknown_action" }, 400);
  if (!cfg.key || !cfg.ipnSecret) return json(req, { error: "not_configured" }, 503);

  const db = serviceClient();
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(token);
  if (!auth?.user) return json(req, { error: "not_signed_in" }, 401);
  const { data: staff } = await db.from("staff").select("role").eq("user_id", auth.user.id).maybeSingle();
  if (!staff) return json(req, { error: "staff_only" }, 403);

  const { data: r } = await db.from("reservations").select("*").eq("id", String(body.reservation_id ?? "")).maybeSingle();
  if (!r) return json(req, { error: "not_found" }, 404);
  if (["cancelled", "returned"].includes(r.status)) return json(req, { error: "closed" }, 400);
  if (r.payment_status === "paid") return json(req, { error: "already_paid" }, 400);
  const amount = Math.round(Number(body.amount ?? r.estimate));
  if (!(amount >= 1 && amount <= 10_000_000)) return json(req, { error: "bad_amount" }, 400);

  const back = (outcome: string) => `${cfg.site}?paiement=${outcome}&ref=${r.ref}&lang=${r.lang}#reserver`;
  const inv = await np("/invoice", {
    method: "POST",
    body: JSON.stringify({
      price_amount: amount,
      price_currency: cfg.currency,
      order_id: r.ref,
      order_description: `CARSW6 ${r.car}, ${r.start_date} → ${r.end_date} (${r.ref})`,
      ipn_callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/nowpayments-ipn`,
      success_url: back("ok"),
      cancel_url: back("annule"),
      is_fixed_rate: true,
      is_fee_paid_by_user: false,
    }),
  });
  if (!inv.ok || !inv.body?.invoice_url) {
    return json(req, { error: "nowpayments", message: inv.body?.message ?? `HTTP ${inv.status}` }, 502);
  }

  const { error } = await db.from("reservations").update({
    payment: "crypto",
    payment_url: inv.body.invoice_url,
    payment_invoice_id: String(inv.body.id),
    payment_amount: amount,
    payment_link_at: new Date().toISOString(),
    payment_status: r.payment_status === "unpaid" ? "awaiting" : r.payment_status,
  }).eq("id", r.id);
  if (error) return json(req, { error: "db", message: error.message }, 500);
  return json(req, { ok: true, url: inv.body.invoice_url, amount, currency: cfg.currency });
});
