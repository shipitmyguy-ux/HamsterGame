import Phaser from "phaser";

export type ContentBox={x:number;y:number;w:number;h:number};
export type StandardAssetEntry={
  sheet:string;
  frame:number;
  cell:number;
  content:ContentBox;
};
export type StandardSheet={
  file:string;
  cell:number;
  columns:number;
  rows:number;
  width:number;
  height:number;
  hash:string;
};
export type HamsterManifest={
  file:string;
  cell:number;
  columns:number;
  rows:number;
  hash:string;
  content:ContentBox[];
  directions:{
    up:number[];
    left:number[];
    right:number[];
    down:number[];
  };
};
export type StandardAssetManifest={
  schema:number;
  version:string;
  worldScale:number;
  playerScale:number;
  sheets:Record<string,StandardSheet>;
  assets:Record<string,StandardAssetEntry>;
  hamster:HamsterManifest;
};

export async function loadStandardAssets(scene:Phaser.Scene):Promise<StandardAssetManifest>{
  const base=import.meta.env.BASE_URL;
  const build=import.meta.env.VITE_BUILD_ID||"dev";
  const response=await fetch(base+"assets/generated/asset-manifest.json?v="+encodeURIComponent(build),{cache:"no-store"});
  if(!response.ok)throw new Error("Standard asset manifest failed to load ("+response.status+")");
  const manifest=await response.json() as StandardAssetManifest;

  for(const [sheetId,sheet] of Object.entries(manifest.sheets)){
    scene.load.spritesheet("std:"+sheetId,base+"assets/generated/"+sheet.file+"?v="+manifest.version,{
      frameWidth:sheet.cell,
      frameHeight:sheet.cell
    });
  }
  scene.load.spritesheet("hamster-standard",base+"assets/generated/"+manifest.hamster.file+"?v="+manifest.version,{
    frameWidth:manifest.hamster.cell,
    frameHeight:manifest.hamster.cell
  });

  await new Promise<void>((resolve,reject)=>{
    let failed="";
    const onError=(file:Phaser.Loader.File)=>{failed=file.src||file.key};
    scene.load.once(Phaser.Loader.Events.COMPLETE,()=>failed?reject(new Error("Standard asset failed to load: "+failed)):resolve());
    scene.load.start();
  });

  return manifest;
}

export function visibleBoundsFor(
  x:number,
  y:number,
  entry:StandardAssetEntry,
  scale:number
){
  const full=entry.cell*scale;
  const left=x-full/2;
  const top=y-full;
  return {
    x:left+entry.content.x*scale,
    y:top+entry.content.y*scale,
    width:entry.content.w*scale,
    height:entry.content.h*scale
  };
}
