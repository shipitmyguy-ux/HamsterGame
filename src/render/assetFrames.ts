export type AtlasFrame={x:number;y:number;w:number;h:number};

export const ENV_FRAMES:Record<string,AtlasFrame>={
  wheel_home:{x:2,y:2,w:92,h:96},
  wood_hideout:{x:97,y:2,w:64,h:48},
  strawberry_hideout:{x:163,y:2,w:64,h:59},
  purple_hideout:{x:8,y:100,w:49,h:53},
  tunnel_short:{x:59,y:100,w:48,h:38},
  tunnel_long:{x:112,y:100,w:61,h:39},
  water_bottle:{x:181,y:104,w:22,h:43},
  food_bowl:{x:2,y:158,w:55,h:42},
  bedding_box:{x:60,y:162,w:56,h:49},
  stairs:{x:118,y:164,w:42,h:41},
  ladder:{x:163,y:158,w:18,h:35},
  drawer:{x:184,y:158,w:34,h:34},
  plant:{x:7,y:221,w:29,h:30},
  rug:{x:49,y:222,w:37,h:19},
  sticks:{x:100,y:214,w:37,h:23},
  fluff:{x:151,y:221,w:41,h:30},
  seeds:{x:198,y:219,w:25,h:16},
  bolt:{x:8,y:260,w:26,h:26},
  nut:{x:36,y:263,w:25,h:23},
  clover:{x:64,y:260,w:25,h:22}
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
