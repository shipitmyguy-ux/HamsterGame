import { ArrayTilemap, GridEngineHeadless } from "grid-engine";
import type { Archetype, Entity, Room } from "../types";

export type NavigationGrid = {
  width:number;
  height:number;
  data:number[][];
};

function footprint(entity:Entity, archetypes:Map<string,Archetype>){
  const placement=(entity as Entity & {placement?:{footprint?:number[]}}).placement;
  const inherited=archetypes.get(entity.archetype)?.placement as {footprint?:number[]} | undefined;
  const pair=placement?.footprint ?? inherited?.footprint ?? [1,1];
  return {
    w:Math.max(1,Math.round(Number(pair[0]||1))),
    h:Math.max(1,Math.round(Number(pair[1]||1)))
  };
}

function isSolid(entity:Entity, archetypes:Map<string,Archetype>){
  const collision=entity.physics?.collision ?? archetypes.get(entity.archetype)?.collision;
  return Boolean(collision?.mode && collision.mode!=="none");
}

export function buildNavigationGrid(
  room:Room,
  archetypes:Map<string,Archetype>,
  width=30,
  height=19
):NavigationGrid{
  const data=Array.from({length:height},()=>Array(width).fill(0));
  for(const entity of room.entities||[]){
    if(!isSolid(entity,archetypes)) continue;
    const {w,h}=footprint(entity,archetypes);
    const cx=Math.max(0,Math.min(width-1,Math.round((entity.position?.x??.5)*(width-1))));
    const cy=Math.max(0,Math.min(height-1,Math.round((entity.position?.y??.5)*(height-1))));
    const startX=Math.max(0,cx-Math.floor(w/2));
    const startY=Math.max(0,cy-h+1);
    for(let y=startY;y<Math.min(height,startY+h);y++){
      for(let x=startX;x<Math.min(width,startX+w);x++) data[y][x]=1;
    }
  }
  return {width,height,data};
}

export function createHeadlessNavigator(grid:NavigationGrid){
  const engine=new GridEngineHeadless();
  const tilemap=new ArrayTilemap({
    collision:{data:grid.data}
  });
  engine.create(tilemap,{characters:[{id:"probe",startPosition:{x:0,y:0}}]});
  return engine;
}
