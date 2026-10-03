// Tells a customer, on the phones where they use the app, that staff changed their booking:
// confirmed, paid, delivered, returned or cancelled. In the customer's language.
//
// Called by the database (trigger on reservations, through pg_net) with { id }. It re-reads the row
// and only sends when the status it would announce differs from the last one announced
// (customer_notified_status), so a repeated or forged call sends nothing new.
//
// Delivery goes through Expo's push service. Optional secret: EXPO_ACCESS_TOKEN (only needed if
// "enhanced push security" is turned on for the project in Expo).
import { json, serviceClient } from "../_shared/http.ts";

type Lang = "fr" | "en" | "ar";
type Msg = { title: string; body: string };

const day = (d: string, lang: Lang) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long" });

// what to say for each change; null = nothing worth a notification
function message(status: string, paid: boolean, car: string, ref: string, d1: string, d2: string, lang: Lang): Msg | null {
  const t: Record<string, Record<Lang, Msg>> = {
    confirmed: {
      fr: { title: "Réservation confirmée", body: `${car} est à vous du ${d1} au ${d2}. Réf. ${ref}.` },
      en: { title: "Booking confirmed", body: `The ${car} is yours from ${d1} to ${d2}. Ref. ${ref}.` },
      ar: { title: "تم تأكيد الحجز", body: `${car} محجوزة لك من ${d1} إلى ${d2}. المرجع ${ref}.` },
    },
    paid: {
      fr: { title: "Paiement reçu", body: `Merci, votre paiement pour ${car} est bien reçu. Réf. ${ref}.` },
      en: { title: "Payment received", body: `Thank you, your payment for the ${car} has arrived. Ref. ${ref}.` },
      ar: { title: "تم استلام الدفع", body: `شكراً، وصلنا دفعك لـ${car}. المرجع ${ref}.` },
    },
    delivered: {
      fr: { title: "Bonne route", body: `${car} vous a été remise. Votre concierge reste joignable jour et nuit.` },
      en: { title: "Enjoy the drive", body: `The ${car} has been handed over. Your concierge is on call day and night.` },
      ar: { title: "رحلة سعيدة", body: `تم تسليمك ${car}. الكونسيرج متاح ليلاً ونهاراً.` },
    },
    returned: {
      fr: { title: "Merci d'avoir roulé avec CARSW6", body: `Retour de ${car} enregistré. L'empreinte de caution sera libérée.` },
      en: { title: "Thank you for driving with CARSW6", body: `The ${car} is back. Your deposit hold will be released.` },
      ar: { title: "شكراً لقيادتك مع CARSW6", body: `تم تسجيل إرجاع ${car}. سيتم تحرير مبلغ الضمان.` },
    },
    cancelled: {
      fr: { title: "Réservation annulée", body: `Votre réservation ${ref} (${car}) a été annulée. Écrivez-nous pour toute question.` },
      en: { title: "Booking cancelled", body: `Your booking ${ref} (${car}) has been cancelled. Message us with any questions.` },
      ar: { title: "تم إلغاء الحجز", body: `تم إلغاء حجزك ${ref} (${car}). راسلنا لأي استفسار.` },
    },
  };
  const key = paid && status === "confirmed" ? "paid" : status;
  return t[key]?.[lang] ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(req, { error: "method" }, 405);
  let id = "";
  try { id = String((await req.json()).id ?? ""); } catch { /* handled below */ }
  if (!/^[0-9a-f-]{36}$/.test(id)) return json(req, { error: "bad_id" }, 400);

  const db = serviceClient();
  const { data: cur } = await db.from("reservations")
    .select("id,ref,car,status,payment_status,start_date,end_date,lang,customer_id,customer_notified_status")
    .eq("id", id).maybeSingle();
  if (!cur?.customer_id) return json(req, { ok: true, sent: 0 });

  const key = `${cur.status}/${cur.payment_status}`;
  if (cur.customer_notified_status === key) return json(req, { ok: true, sent: 0 });
  // claim this announcement atomically: only one call wins
  const { data: won } = await db.from("reservations").update({ customer_notified_status: key })
    .eq("id", id).eq("status", cur.status).eq("payment_status", cur.payment_status)
    .or(`customer_notified_status.is.null,customer_notified_status.neq.${key}`)
    .select("id").maybeSingle();
  if (!won) return json(req, { ok: true, sent: 0 });

  const lang: Lang = ["fr", "en", "ar"].includes(cur.lang) ? cur.lang : "fr";
  const msg = message(cur.status, cur.payment_status === "paid", cur.car, cur.ref,
    day(cur.start_date, lang), day(cur.end_date, lang), lang);
  if (!msg) return json(req, { ok: true, sent: 0 });

  const { data: devices } = await db.from("customer_devices").select("token").eq("user_id", cur.customer_id);
  if (!devices?.length) return json(req, { ok: true, sent: 0 });

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const token = Deno.env.get("EXPO_ACCESS_TOKEN");
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST", headers,
    body: JSON.stringify(devices.map((d) => ({
      to: d.token, title: msg.title, body: msg.body, sound: "default", priority: "high",
      data: { ref: cur.ref }, channelId: "bookings",
    }))),
  });
  const out = await res.json().catch(() => null);
  // forget phones where the app was removed
  const tickets: { status: string; details?: { error?: string } }[] = out?.data ?? [];
  await Promise.all(tickets.map((t, i) => t.details?.error === "DeviceNotRegistered"
    ? db.from("customer_devices").delete().eq("token", devices[i].token) : null));
  return json(req, { ok: res.ok, sent: tickets.filter((t) => t.status === "ok").length });
});
