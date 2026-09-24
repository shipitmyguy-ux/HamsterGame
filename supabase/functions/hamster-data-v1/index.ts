import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED = new Set([
  "https://shipitmyguy-ux.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://shipitmyguy-ux.github.io",
    "Access-Control-Allow-Headers": "content-type,authorization,apikey",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}
function keyHeaders() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const key = JSON.parse(modern)?.default;
      if (key) return { apikey: key };
    } catch {}
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!legacy) throw new Error("server key unavailable");
  return { apikey: legacy, Authorization: "Bearer " + legacy };
}
async function rest(path: string) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const r = await fetch(url + "/rest/v1/" + path, { headers: keyHeaders() });
  if (!r.ok) throw new Error("database read failed: " + r.status);
  return await r.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "GET") return json(req, { error: "GET required" }, 405);
  const origin = req.headers.get("origin") || "";
  if (origin && !ALLOWED.has(origin)) return json(req, { error: "origin not allowed" }, 403);
  try {
    const u = new URL(req.url);
    const channel = u.searchParams.get("channel") === "published" ? "published" : "draft";
    const include = new Set((u.searchParams.get("include") || "archetypes").split(",").map(v => v.trim()).filter(Boolean));
    const rows = await rest("hamster_world_state?id=eq.main&select=draft,published,draft_version,published_version,updated_at&limit=1");
    if (!rows?.[0]) return json(req, { error: "world missing" }, 404);
    const row = rows[0];
    const out: any = {
      ok: true,
      service: "hamster-data-v1",
      channel,
      version: channel === "published" ? row.published_version : row.draft_version,
      world: channel === "published" ? row.published : row.draft,
      updated_at: row.updated_at
    };
    if (include.has("archetypes")) {
      out.archetypes = await rest("hamster_archetypes?select=archetype_id,kind,collision,placement,interaction,sorting,defaults&order=archetype_id");
    }
    if (include.has("assets")) {
      out.assets = await rest("hamster_assets?select=asset_id,kind,source,status,file_path,metadata,physics&status=eq.ready&order=asset_id");
    }
    return json(req, out);
  } catch (e) {
    return json(req, { error: e instanceof Error ? e.message : String(e) }, 500);
  }
});