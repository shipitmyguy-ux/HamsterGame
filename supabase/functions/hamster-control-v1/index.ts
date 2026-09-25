import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED = new Set([
  "https://shipitmyguy-ux.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);
const ACTIONS = new Set([
  "add_entity","remove_entity","update_entity","move_entity",
  "add_room","update_room","link_rooms",
  "add_item","add_recipe","add_quest","set_player","set_style"
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://shipitmyguy-ux.github.io",
    "Access-Control-Allow-Headers": "content-type,authorization,apikey,x-hamster-creator",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}
function serverHeaders() {
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
async function rest(path: string, init: RequestInit = {}) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const headers = { ...serverHeaders(), ...(init.headers || {}) };
  const r = await fetch(url + "/rest/v1/" + path, { ...init, headers });
  const text = await r.text();
  if (!r.ok) throw new Error("database request failed " + r.status + ": " + text.slice(0,240));
  return text ? JSON.parse(text) : null;
}
function claims(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const part = token.split(".")[1] || "";
  if (!part) return {};
  try {
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - part.length % 4) % 4);
    return JSON.parse(atob(normalized));
  } catch { return {}; }
}
async function sha256(value:string){
  const bytes=new TextEncoder().encode(value);
  const hash=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function isCreator(req: Request) {
  const c:any=claims(req);
  if(c?.app_metadata?.hamster_creator===true)return true;
  const email=String(c?.email||"").trim().toLowerCase();
  if(email){
    const rows=await rest("hamster_creators?email=eq."+encodeURIComponent(email)+"&enabled=eq.true&select=email&limit=1");
    if(rows?.length)return true;
  }
  const token=String(req.headers.get("x-hamster-creator")||"").trim();
  if(!token)return false;
  const hash=await sha256(token);
  const rows=await rest("hamster_creator_tokens?token_hash=eq."+hash+"&enabled=eq.true&select=token_hash&limit=1");
  return Boolean(rows?.length);
}
function clone<T>(v: T): T { return structuredClone(v); }
function uid(prefix: string) { return prefix + "_" + crypto.randomUUID().slice(0, 8); }

function findEntity(world: any, entityId: string, roomHint?: string) {
  const rooms = world.rooms || {};
  const ids = roomHint && rooms[roomHint] ? [roomHint] : Object.keys(rooms);
  for (const roomId of ids) {
    const entities = Array.isArray(rooms[roomId].entities) ? rooms[roomId].entities : [];
    const index = entities.findIndex((e: any) => e?.id === entityId);
    if (index >= 0) return { roomId, entities, index, entity: entities[index] };
  }
  return null;
}
function archetypeMap(rows: any[]) {
  return Object.fromEntries(rows.map(r => [r.archetype_id, r]));
}
function hydrateEntity(entity: any, arches: Record<string, any>) {
  const out = clone(entity || {});
  out.id = String(out.id || uid("entity"));
  out.archetype = String(out.archetype || "decoration.generic");
  const a = arches[out.archetype];
  if (!a) throw new Error("unknown archetype: " + out.archetype);
  out.physics = { ...(a.defaults || {}), ...(out.physics || {}), collision: out.physics?.collision || a.collision };
  out.placement = { ...(a.placement || {}), ...(out.placement || {}) };
  out.interaction = { ...(a.interaction || {}), ...(out.interaction || {}) };
  out.sorting = { ...(a.sorting || {}), ...(out.sorting || {}) };
  if (!out.position) out.position = { x: 0.5, y: 0.5 };
  out.position.x = Math.max(0, Math.min(1, Number(out.position.x ?? 0.5)));
  out.position.y = Math.max(0, Math.min(1, Number(out.position.y ?? 0.5)));
  return out;
}
function applyOps(inputWorld: any, ops: any[], arches: Record<string, any>) {
  const world = clone(inputWorld);
  world.rooms ||= {};
  world.items ||= {};
  world.recipes ||= {};
  world.quests ||= {};
  for (const raw of ops) {
    const op = raw && typeof raw === "object" ? raw : {};
    if (!ACTIONS.has(String(op.action))) throw new Error("unsupported action: " + String(op.action));
    if (op.action === "add_entity") {
      const roomId = String(op.room_id || "");
      if (!world.rooms[roomId]) throw new Error("room not found: " + roomId);
      world.rooms[roomId].entities ||= [];
      world.rooms[roomId].entities.push(hydrateEntity(op.entity, arches));
    } else if (op.action === "remove_entity") {
      const f = findEntity(world, String(op.entity_id || ""), op.room_id);
      if (!f) throw new Error("entity not found: " + String(op.entity_id || ""));
      f.entities.splice(f.index, 1);
    } else if (op.action === "update_entity") {
      const f = findEntity(world, String(op.entity_id || ""), op.room_id);
      if (!f) throw new Error("entity not found: " + String(op.entity_id || ""));
      const patch = op.patch && typeof op.patch === "object" ? op.patch : {};
      f.entities[f.index] = hydrateEntity({ ...f.entity, ...patch, id: f.entity.id }, arches);
    } else if (op.action === "move_entity") {
      const f = findEntity(world, String(op.entity_id || ""), op.room_id);
      if (!f) throw new Error("entity not found: " + String(op.entity_id || ""));
      f.entity.position = {
        x: Math.max(0, Math.min(1, Number(op.x ?? f.entity.position?.x ?? 0.5))),
        y: Math.max(0, Math.min(1, Number(op.y ?? f.entity.position?.y ?? 0.5)))
      };
    } else if (op.action === "add_room") {
      const room = op.room && typeof op.room === "object" ? clone(op.room) : {};
      const id = String(room.id || uid("room"));
      if (world.rooms[id]) throw new Error("room already exists: " + id);
      world.rooms[id] = { id, name: String(room.name || id), theme: String(room.theme || "warm_house"), entities: [], links: [], ...room, id };
      world.rooms[id].entities = Array.isArray(world.rooms[id].entities) ? world.rooms[id].entities.map((e:any)=>hydrateEntity(e, arches)) : [];
      world.rooms[id].links = Array.isArray(world.rooms[id].links) ? world.rooms[id].links : [];
    } else if (op.action === "update_room") {
      const id = String(op.room_id || "");
      if (!world.rooms[id]) throw new Error("room not found: " + id);
      const patch = op.patch && typeof op.patch === "object" ? op.patch : {};
      world.rooms[id] = { ...world.rooms[id], ...patch, id };
    } else if (op.action === "link_rooms") {
      const a = String(op.from || ""), b = String(op.to || "");
      if (!world.rooms[a] || !world.rooms[b]) throw new Error("room link references missing room");
      world.rooms[a].links ||= []; world.rooms[b].links ||= [];
      if (!world.rooms[a].links.includes(b)) world.rooms[a].links.push(b);
      if (op.bidirectional !== false && !world.rooms[b].links.includes(a)) world.rooms[b].links.push(a);
    } else if (op.action === "add_item") {
      const item = op.item && typeof op.item === "object" ? clone(op.item) : {};
      const id = String(item.id || uid("item")); world.items[id] = { ...item, id };
    } else if (op.action === "add_recipe") {
      const recipe = op.recipe && typeof op.recipe === "object" ? clone(op.recipe) : {};
      const id = String(recipe.id || uid("recipe")); world.recipes[id] = { ...recipe, id };
    } else if (op.action === "add_quest") {
      const quest = op.quest && typeof op.quest === "object" ? clone(op.quest) : {};
      const id = String(quest.id || uid("quest")); world.quests[id] = { ...quest, id };
    } else if (op.action === "set_player") {
      world.player = { ...(world.player || {}), ...(op.patch || {}) };
    } else if (op.action === "set_style") {
      world.meta = { ...(world.meta || {}), ...(op.patch || {}) };
    }
  }
  return world;
}
async function promptToOps(prompt: string, world: any, archetypes: any[]) {
  const apiKey = Deno.env.get("RAVEN_GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY") || "";
  if (!apiKey) throw new Error("Gemini is not configured");
  const model = Deno.env.get("RAVEN_GEMINI_FALLBACK_MODEL") || Deno.env.get("RAVEN_GEMINI_MODEL") || "gemini-3.5-flash-lite";
  const roomSummary = Object.values(world.rooms || {}).map((r:any)=>({
    id:r.id,name:r.name,theme:r.theme,links:r.links,
    entities:(r.entities||[]).map((e:any)=>({id:e.id,archetype:e.archetype,asset:e.asset,name:e.name,position:e.position}))
  }));
  const archIds = archetypes.map(a=>a.archetype_id);
  const instruction = [
    "You translate a child's natural-language HamsterGame edit into safe structured operations.",
    "Never emit code. Never invent an operation outside the allowed list.",
    "Prefer data edits over engine changes. Choose the most semantically appropriate archetype.",
    "For a new ordinary object use one of the supplied archetypes; generic archetypes exist for unknown furniture, structures, obstacles, decorations, and interactive objects.",
    "Positions are normalized 0..1. Keep additions visually separated from existing entities.",
    "If the request needs new art, include asset and asset_prompt on the entity; the asset pipeline will handle generation later.",
    "Return JSON only: {\"operations\":[...]}."
  ].join("\n");
  const input = {
    prompt,
    allowed_actions:[...ACTIONS],
    archetypes:archIds,
    rooms:roomSummary,
    examples:[
      {request:"add a pink chair to the bedroom",output:{action:"add_entity",room_id:"bedroom",entity:{name:"Pink chair",archetype:"furniture.chair",asset:"chair_pink_01",asset_prompt:"cute pink chibi pixel chair",position:{x:0.68,y:0.62}}}},
      {request:"put flowers by the pond",output:{action:"add_entity",room_id:"backyard",entity:{name:"Flowers",archetype:"decoration.flower",asset:"flowers_01",position:{x:0.72,y:0.7}}}}
    ]
  };
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method:"POST",
    signal:AbortSignal.timeout(12000),
    headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
    body:JSON.stringify({
      systemInstruction:{parts:[{text:instruction}]},
      contents:[{role:"user",parts:[{text:JSON.stringify(input)}]}],
      generationConfig:{responseMimeType:"application/json",maxOutputTokens:2200,thinkingConfig:{thinkingLevel:"low"}}
    })
  });
  const raw = await response.json().catch(()=>null);
  if (!response.ok) throw new Error("Gemini command parse failed: " + response.status);
  const text = (raw?.candidates?.[0]?.content?.parts || []).filter((p:any)=>!p.thought).map((p:any)=>p.text||"").join("");
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed?.operations)) throw new Error("Gemini returned no operations");
  return parsed.operations;
}
async function queueAssets(ops: any[]) {
  const rows:any[] = [];
  for (const op of ops) {
    if (op?.action !== "add_entity" || !op?.entity?.asset) continue;
    rows.push({
      asset_id:String(op.entity.asset),
      kind:String(op.entity.archetype || "unknown"),
      source:"generated",
      status:"planned",
      prompt:String(op.entity.asset_prompt || op.entity.name || op.entity.asset),
      metadata:{ requested_by:"hamster-control-v1" }
    });
  }
  if (!rows.length) return;
  await rest("hamster_assets?on_conflict=asset_id",{
    method:"POST",
    headers:{"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates,return=minimal"},
    body:JSON.stringify(rows)
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req,{error:"POST required"},405);
  const origin = req.headers.get("origin") || "";
  if (origin && !ALLOWED.has(origin)) return json(req,{error:"origin not allowed"},403);
  if (!(await isCreator(req))) return json(req,{error:"creator access required"},403);

  try {
    const body = await req.json();
    const prompt = String(body?.prompt || "").trim();
    const rows = await rest("hamster_world_state?id=eq.main&select=draft,draft_version&limit=1");
    const world = rows?.[0]?.draft;
    if (!world) return json(req,{error:"world missing"},404);
    const archetypes = await rest("hamster_archetypes?select=archetype_id,kind,collision,placement,interaction,sorting,defaults&order=archetype_id");
    let ops = Array.isArray(body?.operations) ? body.operations : null;
    if (!ops) {
      if (!prompt) return json(req,{error:"prompt or operations required"},400);
      ops = await promptToOps(prompt,world,archetypes);
    }
    if (!Array.isArray(ops) || ops.length < 1 || ops.length > 20) return json(req,{error:"invalid operation count"},400);
    for (const op of ops) if (!ACTIONS.has(String(op?.action))) return json(req,{error:"unsupported operation"},400);
    const next = applyOps(world,ops,archetypeMap(archetypes));
    await queueAssets(ops);
    const result = await rest("rpc/hamster_commit_draft",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({p_snapshot:next,p_prompt:prompt || "structured operations",p_actor:"creator",p_ops:ops})
    });
    return json(req,{ok:true,operations:ops,result,world:next});
  } catch (e) {
    return json(req,{error:e instanceof Error?e.message:String(e)},500);
  }
});