export type AtlasFrame={x:number;y:number;w:number;h:number};

export const ENV_FRAMES:Record<string,AtlasFrame>={
  wheel_home:{x:2,y:2,w:93,h:96},
  wood_hideout:{x:97,y:2,w:64,h:53},
  strawberry_hideout:{x:163,y:2,w:64,h:60},
  purple_hideout:{x:2,y:100,w:55,h:56},
  tunnel_short:{x:59,y:100,w:48,h:39},
  tunnel_long:{x:109,y:100,w:64,h:43},
  water_bottle:{x:175,y:100,w:32,h:48},
  food_bowl:{x:2,y:158,w:56,h:43},
  bedding_box:{x:60,y:158,w:56,h:54},
  stairs:{x:118,y:158,w:43,h:48},
  ladder:{x:163,y:158,w:20,h:40},
  drawer:{x:184,y:158,w:40,h:39},
  plant:{x:2,y:214,w:40,h:38},
  rug:{x:44,y:214,w:48,h:32},
  sticks:{x:94,y:214,w:48,h:23},
  fluff:{x:144,y:214,w:48,h:39},
  seeds:{x:194,y:214,w:32,h:22},
  bolt:{x:2,y:255,w:32,h:32},
  nut:{x:36,y:255,w:26,h:32},
  clover:{x:64,y:255,w:32,h:29}
};

export const ENV_SCALE:Record<string,number>={
  wheel_home:1.75,
  wood_hideout:1.75,
  strawberry_hideout:1.65,
  purple_hideout:1.6,
  tunnel_short:1.55,
  tunnel_long:1.55,
  water_bottle:1.55,
  food_bowl:1.45,
  bedding_box:1.35,
  stairs:1.45,
  ladder:1.4,
  drawer:1.35,
  plant:1.35,
  rug:1.45,
  sticks:1.25,
  fluff:1.2,
  seeds:1.15,
  bolt:1.15,
  nut:1.15,
  clover:1.15
};

const ALIAS:Record<string,string>={
  hamster_house_01:"wood_hideout",
  outdoor_wheel_01:"wheel_home",
  cage_wheel_01:"wheel_home",
  bedding_pickup_01:"fluff",
  chair_pink_01:"",
  human_bed_01:"",
  door_01:"",
  flower_01:"clover"
};

export function localFrameFor(assetId:string|undefined){
  if(!assetId)return null;
  const candidate=ALIAS[assetId]??assetId;
  return candidate&&ENV_FRAMES[candidate]?candidate:null;
}

export const HAMSTER_FRAMES={
  up:[0,1,2,3],
  left:[4,5,6,7],
  right:[8,9,10,11],
  down:[12,13,14,15]
} as const;

export type HamsterFacing=keyof typeof HAMSTER_FRAMES;
