import type { Entity, Room } from "../types";

type TiledProperty={name:string;value:unknown};
type TiledObject={
  id:number;
  name?:string;
  type?:string;
  x?:number;
  y?:number;
  width?:number;
  height?:number;
  properties?:TiledProperty[];
};
type TiledLayer={type:string;objects?:TiledObject[]};
export type TiledMap={
  width:number;
  height:number;
  tilewidth:number;
  tileheight:number;
  layers?:TiledLayer[];
  properties?:TiledProperty[];
};

function props(input?:TiledProperty[]){
  return Object.fromEntries((input||[]).map(p=>[p.name,p.value]));
}

export function tiledToRoom(map:TiledMap,roomId:string):Room{
  const widthPx=Math.max(1,map.width*map.tilewidth);
  const heightPx=Math.max(1,map.height*map.tileheight);
  const mapProps=props(map.properties);
  const entities:Entity[]=[];

  for(const layer of map.layers||[]){
    if(layer.type!=="objectgroup") continue;
    for(const object of layer.objects||[]){
      const p=props(object.properties);
      if((p.kind||object.type)!=="entity") continue;
      const archetype=String(p.archetype||"decoration.generic");
      entities.push({
        id:String(p.id||object.name||`entity_${object.id}`),
        name:String(p.name||object.name||archetype),
        archetype,
        asset:p.asset?String(p.asset):undefined,
        position:{
          x:Math.max(0,Math.min(1,((object.x||0)+(object.width||0)/2)/widthPx)),
          y:Math.max(0,Math.min(1,((object.y||0)+(object.height||0))/heightPx))
        }
      });
    }
  }

  return {
    id:roomId,
    name:String(mapProps.name||roomId.replaceAll("_"," ")),
    theme:String(mapProps.theme||"warm_house"),
    entities,
    links:[]
  };
}
