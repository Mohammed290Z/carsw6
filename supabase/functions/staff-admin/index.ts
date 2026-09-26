// Team management for admins: invite, change role, remove.
//
// The caller's own session proves who they are; they must be an admin in public.staff. Inviting
// sends Supabase's invitation email, whose link opens the panel to choose a password.
import { cors, json, PANEL_URL, serviceClient } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "method" }, 405);

  const db = serviceClient();
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(token);
  const me = auth?.user;
  if (!me) return json(req, { error: "not_signed_in" }, 401);
  const { data: mine } = await db.from("staff").select("role").eq("user_id", me.id).maybeSingle();
  if (mine?.role !== "admin") return json(req, { error: "admin_only" }, 403);

  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { return json(req, { error: "bad_body" }, 400); }

  if (body.action === "invite") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = body.role === "admin" ? "admin" : "staff";
    const name = String(body.name ?? "").trim().slice(0, 80) || null;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(req, { error: "bad_email" }, 400);
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: PANEL_URL, data: { name } });
    if (error) return json(req, { error: "invite_failed", message: error.message }, 400);
    const { error: e2 } = await db.from("staff").upsert({ user_id: data.user.id, email, name, role });
    if (e2) return json(req, { error: "db", message: e2.message }, 500);
    return json(req, { ok: true });
  }

  const target = String(body.user_id ?? "");
  if (!/^[0-9a-f-]{36}$/.test(target)) return json(req, { error: "bad_user" }, 400);
  if (target === me.id) return json(req, { error: "not_on_yourself" }, 400);

  if (body.action === "set_role") {
    const role = body.role === "admin" ? "admin" : "staff";
    if (role === "staff") {
      const { count } = await db.from("staff").select("*", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) <= 1) return json(req, { error: "last_admin" }, 400);
    }
    const { error } = await db.from("staff").update({ role }).eq("user_id", target);
    return error ? json(req, { error: "db", message: error.message }, 500) : json(req, { ok: true });
  }

  if (body.action === "remove") {
    // deleting the account removes their staff row too (on delete cascade)
    const { error } = await db.auth.admin.deleteUser(target);
    return error ? json(req, { error: "remove_failed", message: error.message }, 400) : json(req, { ok: true });
  }

  return json(req, { error: "unknown_action" }, 400);
});
