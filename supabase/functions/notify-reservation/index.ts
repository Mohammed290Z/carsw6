// Emails the team about a new reservation request.
//
// The website calls this right after submit_reservation() returns a reference. It only ever sends
// once per reservation (notified_at), and only for requests made in the last 15 minutes, so calling
// it with guessed or old references does nothing.
//
// Secrets (supabase secrets set …): RESEND_API_KEY, NOTIFY_TO (comma-separated addresses),
// optional NOTIFY_FROM (defaults to Resend's test sender, which only delivers to the Resend
// account's own address until you verify a domain).
import { cors, json, PANEL_URL, serviceClient } from "../_shared/http.ts";

const PLACES: Record<string, string> = {
  airport: "Aéroport Mohammed V", hotel: "Hôtel à Casablanca", private: "Adresse privée à Casablanca",
  rabat: "Rabat", marrakech: "Marrakech",
};
const PAY: Record<string, string> = { bank: "Virement bancaire", crypto: "Crypto (USDT, BTC, ETH)" };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const date = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
const mad = (n: number) => `${n.toLocaleString("fr-FR")} MAD`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "method" }, 405);

  let ref = "";
  try { ref = String((await req.json()).ref ?? "").toUpperCase(); } catch { /* handled below */ }
  if (!/^[0-9A-F]{7}$/.test(ref)) return json(req, { error: "bad_ref" }, 400);

  const db = serviceClient();
  // claim the notification atomically so two calls can't both send
  const { data: r, error } = await db.from("reservations")
    .update({ notified_at: new Date().toISOString() })
    .eq("ref", ref).is("notified_at", null)
    .gt("created_at", new Date(Date.now() - 15 * 60_000).toISOString())
    .select("*").maybeSingle();
  if (error) return json(req, { error: "db" }, 500);
  if (!r) return json(req, { ok: true, sent: false });   // unknown, too old, or already notified

  const key = Deno.env.get("RESEND_API_KEY"), to = Deno.env.get("NOTIFY_TO");
  if (!key || !to) return json(req, { ok: true, sent: false, reason: "email not configured" });

  const wa = `https://wa.me/${r.phone.replace(/\D/g, "")}`;
  const rows: [string, string][] = [
    ["Voiture", r.car],
    ["Prise en charge", `${date(r.start_date)} à ${r.start_time.slice(0, 5)}`],
    ["Retour", `${date(r.end_date)} à ${r.end_time.slice(0, 5)}`],
    ["Durée", `${r.days} jour${r.days > 1 ? "s" : ""}`],
    ["Livraison", PLACES[r.place] + (r.flight ? ` (vol ${r.flight})` : "")],
    ["Paiement", PAY[r.payment]],
    ["Total estimé", mad(r.estimate)],
    ["Client", r.name],
    ["WhatsApp", r.phone],
    ["Langue", r.lang.toUpperCase()],
  ];
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;color:#0B1026">
      <p style="font-size:13px;color:#6b7394;margin:0 0 4px">Nouvelle demande de réservation</p>
      <h1 style="font-size:22px;margin:0 0 16px">${esc(r.car)} — réf. ${esc(r.ref)}</h1>
      <table style="border-collapse:collapse;width:100%;font-size:15px">
        ${rows.map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;color:#6b7394;white-space:nowrap">${k}</td><td style="padding:7px 0"><b>${esc(v)}</b></td></tr>`).join("")}
      </table>
      <p style="margin:22px 0 0">
        <a href="${esc(PANEL_URL)}#/r/${esc(r.id)}" style="display:inline-block;background:#0B1026;color:#EFE8DC;padding:12px 18px;border-radius:24px;text-decoration:none">Ouvrir dans le panneau</a>
        &nbsp; <a href="${esc(wa)}" style="color:#0B1026">Écrire au client sur WhatsApp</a>
      </p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("NOTIFY_FROM") ?? "CARSW6 <onboarding@resend.dev>",
      to: to.split(",").map((s) => s.trim()).filter(Boolean),
      subject: `Nouvelle demande ${r.ref} — ${r.car}, ${date(r.start_date)}`,
      html,
    }),
  });
  if (!res.ok) {
    // let a later call retry
    await db.from("reservations").update({ notified_at: null }).eq("id", r.id);
    return json(req, { error: "email_failed", status: res.status }, 502);
  }
  return json(req, { ok: true, sent: true });
});
