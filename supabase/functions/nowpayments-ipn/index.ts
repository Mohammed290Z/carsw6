// Receives NOWPayments' payment notifications (IPN). Public endpoint, so nothing here is trusted
// until proven: the signature must match the IPN secret, and the status is then re-read from
// NOWPayments' own API before anything is recorded.
import { serviceClient } from "../_shared/http.ts";
import { np, npConfig, sameHex, signature } from "../_shared/nowpayments.ts";

const reply = (status: number, body: string) => new Response(body, { status });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, "method");
  const cfg = npConfig();
  if (!cfg.ipnSecret || !cfg.key) return reply(503, "not configured");

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, "bad json"); }
  const sent = (req.headers.get("x-nowpayments-sig") ?? "").toLowerCase();
  if (!sent || !sameHex(sent, await signature(body, cfg.ipnSecret))) return reply(401, "bad signature");

  // the notification is authentic; still take the status from the API, not from the message
  const paymentId = String(body.payment_id ?? "");
  if (!/^\d+$/.test(paymentId)) return reply(400, "no payment id");
  const check = await np(`/payment/${paymentId}`);
  if (!check.ok) return reply(502, "could not verify with NOWPayments");
  const p = check.body as Record<string, unknown>;
  const status = String(p.payment_status ?? body.payment_status ?? "");
  const ref = String(p.order_id ?? body.order_id ?? "");

  const db = serviceClient();
  const { data: r } = await db.from("reservations").select("id,status,payment_status").eq("ref", ref).maybeSingle();
  if (!r) return reply(200, "unknown order");   // not ours; acknowledge so NOWPayments stops retrying

  const { error: e1 } = await db.from("payments").insert({
    reservation_id: r.id, invoice_id: p.invoice_id ? String(p.invoice_id) : null, payment_id: paymentId, status,
    price_amount: p.price_amount, price_currency: p.price_currency, pay_amount: p.pay_amount,
    actually_paid: p.actually_paid, pay_currency: p.pay_currency, raw: body,
  });
  if (e1 && e1.code !== "23505") return reply(500, "db");   // 23505: this exact notification was already recorded

  const patch: Record<string, unknown> = {};
  if (status === "finished") {
    patch.payment_status = "paid";
    patch.paid_at = new Date().toISOString();
    if (["new", "confirmed"].includes(r.status)) patch.status = "paid";
  } else if (status === "partially_paid" && r.payment_status !== "paid") {
    patch.payment_status = "partial";
  } else if (status === "refunded") {
    patch.payment_status = "refunded";
  }
  if (Object.keys(patch).length) {
    const { error } = await db.from("reservations").update(patch).eq("id", r.id);
    if (error) return reply(500, "db");
  }
  return reply(200, "ok");
});
