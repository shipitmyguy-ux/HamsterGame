import fs from "node:fs/promises";
import path from "node:path";

const input = process.argv[2];
const roomId = process.argv[3];
if(!input || !roomId){
  console.error("Usage: npm run map:import -- maps/bedroom.json bedroom");
  process.exit(1);
}

const map=JSON.parse(await fs.readFile(input,"utf8"));
const widthPx=Number(map.width||1)*Number(map.tilewidth||32);
const heightPx=Number(map.height||1)*Number(map.tileheight||32);
const properties=o=>Object.fromEntries((o.properties||[]).map(p=>[p.name,p.value]));
const entities=[];

for(const layer of map.layers||[]){
  if(layer.type!=="objectgroup") continue;
  for(const obj of layer.objects||[]){
    const p=properties(obj);
    if((p.kind||obj.type)!=="entity") continue;
    const archetype=String(p.archetype||"decoration.generic");
    entities.push({
      id:String(p.id||obj.name||`entity_${obj.id}`),
      name:String(p.name||obj.name||archetype),
      archetype,
      asset:p.asset?String(p.asset):undefined,
      position:{
        x:Math.max(0,Math.min(1,(Number(obj.x||0)+(Number(obj.width||0)/2))/widthPx)),
        y:Math.max(0,Math.min(1,(Number(obj.y||0)+Number(obj.height||0))/heightPx))
      },
      properties:p
    });
  }
}

const room={
  id:roomId,
  name:String(properties(map).name||roomId.replaceAll("_"," ")),
  theme:String(properties(map).theme||"warm_house"),
  tiled_source:path.basename(input),
  entities,
  links:[]
};

const outDir=path.resolve("content/imported");
await fs.mkdir(outDir,{recursive:true});
const out=path.join(outDir,`${roomId}.json`);
await fs.writeFile(out,JSON.stringify(room,null,2)+"\n");
console.log(`Imported ${entities.length} entities -> ${path.relative(process.cwd(),out)}`);
