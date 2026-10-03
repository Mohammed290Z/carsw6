// Sends a push notification about a new booking to every staff device that turned them on.
//
// Called by the database (trigger on reservations, through pg_net) with { id }. It only acts on a
// booking saved in the last 5 minutes that hasn't been announced yet, so a repeated or forged call
// can at most announce a real new booking once.
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (the public half is also in assets/js/config.js).
import webpush from "npm:web-push@3.6.7";
import { json, PANEL_URL, serviceClient } from "../_shared/http.ts";

const PLACES: Record<string, string> = {
  airport: "aéroport", hotel: "hôtel", private: "adresse privée", rabat: "Rabat", marrakech: "Marrakech",
};
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(req, { error: "method" }, 405);
  let id = "", event = "created";
  try { const b = await req.json(); id = String(b.id ?? ""); event = b.event === "cancelled" ? "cancelled" : "created"; } catch { /* handled below */ }
  if (!/^[0-9a-f-]{36}$/.test(id)) return json(req, { error: "bad_id" }, 400);

  const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return json(req, { ok: true, sent: 0, reason: "push not configured" });

  const db = serviceClient();
  const now = new Date().toISOString(), recent = new Date(Date.now() - 5 * 60_000).toISOString();
  // a new booking, or a customer cancelling one from the app; each announced once
  const { data: r, error } = event === "cancelled"
    ? await db.from("reservations").update({ cancel_push_sent_at: now })
      .eq("id", id).eq("status", "cancelled").is("cancel_push_sent_at", null).gt("updated_at", recent)
      .select("id,ref,name,car,start_date,end_date,place,payment").maybeSingle()
    : await db.from("reservations").update({ push_sent_at: now })
      .eq("id", id).is("push_sent_at", null).gt("created_at", recent)
      .select("id,ref,name,car,start_date,end_date,place,payment").maybeSingle();
  if (error) return json(req, { error: "db", message: error.message }, 500);
  if (!r) return json(req, { ok: true, sent: 0 });

  const { data: subs } = await db.from("push_subscriptions").select("endpoint,p256dh,auth");
  webpush.setVapidDetails(PANEL_URL, pub, priv);
  const payload = JSON.stringify(event === "cancelled"
    ? {
      title: `Annulée par le client ${r.ref}`,
      body: `${r.name} a annulé ${r.car}, du ${day(r.start_date)} au ${day(r.end_date)}, depuis l'application.`,
      url: `./#/r/${r.id}`,
      tag: `${r.ref}-cancel`,
    }
    : {
      title: `Nouvelle demande ${r.ref}`,
      body: `${r.name}, ${r.car}, du ${day(r.start_date)} au ${day(r.end_date)} (${PLACES[r.place] ?? r.place}${r.payment === "crypto" ? ", crypto" : ""})`,
      url: `./#/r/${r.id}`,
      tag: r.ref,
    });

  let sent = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload,
        { TTL: 6 * 3600, urgency: "high" });
      sent++;
    } catch (e) {
      // the device unsubscribed or the app was removed: forget it
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }));
  return json(req, { ok: true, sent });
});
