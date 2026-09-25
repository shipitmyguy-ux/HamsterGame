import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ALLOWED = new Set([
  "https://shipitmyguy-ux.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  return {
    "Access-Control-Allow-Origin":ALLOWED.has(origin)?origin:"https://shipitmyguy-ux.github.io",
    "Access-Control-Allow-Headers":"content-type,authorization,apikey,x-hamster-creator",
    "Access-Control-Allow-Methods":"POST,OPTIONS",
    "Content-Type":"application/json",
    "Cache-Control":"no-store",
    "Vary":"Origin"
  };
}
function json(req:Request,data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:cors(req)});
}
function claims(req:Request){
  const auth=req.headers.get("authorization")||"";
  const token=auth.replace(/^Bearer\s+/i,"");
  const part=token.split(".")[1]||"";
  if(!part)return {};
  try{
    const n=part.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-part.length%4)%4);
    return JSON.parse(atob(n));
  }catch{return {}}
}
async function sha256(value:string){
  const bytes=new TextEncoder().encode(value);
  const hash=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function isCreator(req:Request){
  const c:any=claims(req);
  if(c?.app_metadata?.hamster_creator===true)return true;
  const token=String(req.headers.get("x-hamster-creator")||"").trim();
  if(!token)return false;
  const url=Deno.env.get("SUPABASE_URL")||"";
  const key=secretKey();
  if(!url||!key)return false;
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const hash=await sha256(token);
  const {data,error}=await supabase.from("hamster_creator_tokens").select("token_hash").eq("token_hash",hash).eq("enabled",true).limit(1);
  return !error&&Boolean(data?.length);
}
function secretKey(){
  const modern=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(modern){
    try{const k=JSON.parse(modern)?.default;if(k)return k}catch{}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  if(req.method!=="POST")return json(req,{error:"POST required"},405);
  const origin=req.headers.get("origin")||"";
  if(origin&&!ALLOWED.has(origin))return json(req,{error:"origin not allowed"},403);
  if(!(await isCreator(req)))return json(req,{error:"creator access required"},403);

  try{
    const body=await req.json();
    const assetId=String(body?.asset_id||"").trim();
    if(!assetId)return json(req,{error:"asset_id required"},400);

    const url=Deno.env.get("SUPABASE_URL")||"";
    const key=secretKey();
    if(!url||!key)throw new Error("Supabase server configuration unavailable");
    const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

    const {data:asset,error:readError}=await supabase
      .from("hamster_assets")
      .select("asset_id,kind,status,prompt,metadata")
      .eq("asset_id",assetId)
      .single();
    if(readError||!asset)throw new Error("asset not found");

    if(asset.status==="ready"&&!body?.force){
      const {data:pub}=supabase.storage.from("hamster-assets").getPublicUrl(assetId+".png");
      return json(req,{ok:true,cached:true,asset_id:assetId,url:pub.publicUrl});
    }

    await supabase.from("hamster_assets").update({status:"generating",updated_at:new Date().toISOString()}).eq("asset_id",assetId);

    const apiKey=Deno.env.get("RAVEN_GEMINI_API_KEY")||Deno.env.get("GEMINI_API_KEY")||"";
    if(!apiKey)throw new Error("Gemini API key is not configured");
    const model=String(body?.model||Deno.env.get("HAMSTER_IMAGE_MODEL")||"gemini-3.1-flash-image");
    const prompt=[
      String(asset.prompt||""),
      "",
      "HamsterGame house style:",
      "- cute chibi pixel art",
      "- original cozy indie game art",
      "- top-down slight three-quarter view",
      "- warm pastel palette",
      "- readable chunky silhouette for a small touch screen",
      "- crisp intentional pixel clusters; avoid blurry anti-aliased painterly edges",
      "- transparent or plain uniform background suitable for clean game-sprite extraction",
      "- no letters, labels, logos, UI or text",
      "- single isolated asset centered with generous transparent margin"
    ].join("\n");

    const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
      method:"POST",
      signal:AbortSignal.timeout(90000),
      headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({
        contents:[{role:"user",parts:[{text:prompt}]}],
        generationConfig:{
          responseModalities:["IMAGE"],
          imageConfig:{aspectRatio:"1:1",imageSize:"1K"}
        }
      })
    });
    const raw=await response.json().catch(()=>null);
    if(!response.ok)throw new Error("Gemini image generation failed: "+response.status);

    const parts=raw?.candidates?.[0]?.content?.parts||[];
    const imagePart=parts.find((p:any)=>!p.thought&&p.inlineData?.data&&String(p.inlineData?.mimeType||"").startsWith("image/"));
    if(!imagePart)throw new Error("Gemini returned no image");

    const bytes=Uint8Array.from(atob(imagePart.inlineData.data),(c)=>c.charCodeAt(0));
    const mime=String(imagePart.inlineData.mimeType||"image/png");
    const ext=mime.includes("jpeg")?"jpg":"png";
    const objectPath=assetId+"."+ext;

    const {error:uploadError}=await supabase.storage.from("hamster-assets").upload(objectPath,bytes,{
      contentType:mime,
      cacheControl:"31536000",
      upsert:true
    });
    if(uploadError)throw uploadError;

    const {data:pub}=supabase.storage.from("hamster-assets").getPublicUrl(objectPath);
    await supabase.from("hamster_assets").update({
      status:"ready",
      file_path:objectPath,
      metadata:{...(asset.metadata||{}),generator:model,mime_type:mime,generated_at:new Date().toISOString()},
      updated_at:new Date().toISOString()
    }).eq("asset_id",assetId);

    return json(req,{ok:true,asset_id:assetId,url:pub.publicUrl,model});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    try{
      const body=await req.clone().json().catch(()=>null);
      const assetId=String(body?.asset_id||"");
      if(assetId){
        const url=Deno.env.get("SUPABASE_URL")||"",key=secretKey();
        if(url&&key){
          const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
          await supabase.from("hamster_assets").update({status:"planned",updated_at:new Date().toISOString()}).eq("asset_id",assetId);
        }
      }
    }catch{}
    return json(req,{error:message},500);
  }
});