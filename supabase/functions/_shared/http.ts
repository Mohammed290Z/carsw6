// Shared helpers for the Edge Functions: CORS for the site's origins, JSON replies, and a
// service-role client (the key only ever exists inside Supabase's runtime, never in a browser).
import { createClient } from "npm:@supabase/supabase-js@2";

const allowed = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://mohammed290z.github.io,http://localhost:4175,http://localhost:4174").split(",").map((s) => s.trim());

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

export function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const PANEL_URL = Deno.env.get("PANEL_URL") ?? "https://mohammed290z.github.io/carsw6/admin/";
