import Phaser from "phaser";

export const PIXEL = {
  outline: 0x5a3c2b,
  cream: 0xffedcf,
  tan: 0xdf9450,
  tanDark: 0xb96d3e,
  pink: 0xef9f91,
  wood: 0xa86f46,
  woodDark: 0x6f4932,
  grass: 0x8db56f,
  grass2: 0xaacb7f,
  bedding: 0xe8ca84,
  bedding2: 0xf3dda2,
  blue: 0x9bcbd5,
  rug: 0x7ca39c,
  white: 0xfff8e8
};

type DrawFn=(g:Phaser.GameObjects.Graphics)=>void;

function tex(scene:Phaser.Scene,key:string,w:number,h:number,draw:DrawFn){
  if(scene.textures.exists(key)) return;
  const g=scene.add.graphics();
  draw(g);
  g.generateTexture(key,w,h);
  g.destroy();
}

function rect(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,color:number){
  g.fillStyle(color,1).fillRect(x,y,w,h);
}
function outlineRect(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,fill:number){
  rect(g,x,y,w,h,PIXEL.outline); rect(g,x+2,y+2,w-4,h-4,fill);
}

export function ensurePixelTextures(scene:Phaser.Scene){
  tex(scene,"px-hamster-down",40,40,g=>{
    rect(g,6,7,8,5,PIXEL.outline);rect(g,8,5,4,4,PIXEL.pink);
    rect(g,26,7,8,5,PIXEL.outline);rect(g,28,5,4,4,PIXEL.pink);
    rect(g,5,10,30,25,PIXEL.outline);
    rect(g,7,12,26,21,PIXEL.tan);
    rect(g,11,23,18,10,PIXEL.cream);
    rect(g,11,17,4,4,0x211712);rect(g,25,17,4,4,0x211712);
    rect(g,12,17,1,1,PIXEL.white);rect(g,26,17,1,1,PIXEL.white);
    rect(g,18,22,4,3,PIXEL.pink);
    rect(g,5,27,4,5,PIXEL.pink);rect(g,31,27,4,5,PIXEL.pink);
    rect(g,9,34,7,3,PIXEL.outline);rect(g,24,34,7,3,PIXEL.outline);
  });

  tex(scene,"px-chair",38,48,g=>{
    outlineRect(g,7,2,24,24,0xd88978);
    outlineRect(g,5,22,28,14,0xe7a28f);
    rect(g,8,36,5,10,PIXEL.outline);rect(g,25,36,5,10,PIXEL.outline);
    rect(g,10,38,3,8,PIXEL.woodDark);rect(g,25,38,3,8,PIXEL.woodDark);
    rect(g,11,8,16,4,0xf2b1a0);
  });

  tex(scene,"px-human-bed",84,62,g=>{
    outlineRect(g,2,14,80,42,0xc7976f);
    outlineRect(g,6,18,72,30,0x84a99a);
    outlineRect(g,8,8,30,18,PIXEL.cream);
    rect(g,12,12,22,10,0xfff6df);
    rect(g,8,50,6,10,PIXEL.woodDark);rect(g,70,50,6,10,PIXEL.woodDark);
  });

  tex(scene,"px-hamster-bed",40,28,g=>{
    outlineRect(g,2,8,36,18,0xb8784d);
    rect(g,6,11,28,11,PIXEL.cream);
    rect(g,9,13,22,7,0xf5c4ad);
  });

  tex(scene,"px-tree",74,94,g=>{
    rect(g,30,58,14,34,PIXEL.outline);rect(g,33,58,8,34,PIXEL.wood);
    for(const [x,y,w,h,c] of [
      [10,18,54,46,PIXEL.outline],[14,14,46,44,0x6f9d5c],[5,29,32,28,0x7faa63],[37,28,32,30,0x9abe74],[20,4,34,30,0x88b469]
    ] as const) rect(g,x,y,w,h,c);
    rect(g,18,23,5,5,0xf2c05e);rect(g,48,19,5,5,0xf0a56e);rect(g,31,39,5,5,0xf4d079);
  });

  tex(scene,"px-rock",36,26,g=>{
    rect(g,5,8,26,16,PIXEL.outline);rect(g,8,5,20,16,0x8a8b83);rect(g,12,8,10,4,0xb5b4a7);
  });

  tex(scene,"px-wheel",70,76,g=>{
    rect(g,30,60,10,14,PIXEL.outline);rect(g,25,70,20,5,PIXEL.outline);
    g.lineStyle(6,PIXEL.outline,1).strokeCircle(35,34,28);
    g.lineStyle(4,0xc28658,1).strokeCircle(35,34,23);
    g.lineStyle(3,PIXEL.woodDark,1);
    g.lineBetween(35,11,35,57);g.lineBetween(12,34,58,34);g.lineBetween(18,17,52,51);g.lineBetween(52,17,18,51);
  });

  tex(scene,"px-house",86,78,g=>{
    rect(g,5,30,76,44,PIXEL.outline);rect(g,8,33,70,38,0xd7a066);
    rect(g,0,28,86,7,PIXEL.outline);
    g.fillStyle(0xb45e4e,1).fillTriangle(4,28,43,2,82,28);
    rect(g,37,50,14,21,PIXEL.outline);rect(g,40,53,8,18,0x7d5038);
    rect(g,16,43,13,13,PIXEL.outline);rect(g,18,45,9,9,0x9fd1d4);
    rect(g,58,43,13,13,PIXEL.outline);rect(g,60,45,9,9,0x9fd1d4);
    rect(g,20,20,5,5,0xf2d174);rect(g,62,19,5,5,0xf3c4a2);
  });

  tex(scene,"px-door",36,62,g=>{
    outlineRect(g,2,2,32,58,0x9e6a4b);rect(g,26,31,4,4,0xe2c46c);
  });

  tex(scene,"px-flower",30,34,g=>{
    rect(g,14,17,3,15,0x5c8a4d);
    rect(g,9,8,8,8,0xf0a15e);rect(g,16,8,8,8,0xf4c65b);rect(g,12,4,8,8,0xf0a7b2);rect(g,13,10,6,6,0x81513e);
  });

  tex(scene,"px-pickup",28,28,g=>{
    rect(g,7,10,14,12,PIXEL.outline);rect(g,9,8,10,12,PIXEL.cream);
    rect(g,6,13,4,5,PIXEL.cream);rect(g,18,13,4,5,PIXEL.cream);
  });

  tex(scene,"px-generic",34,34,g=>{
    outlineRect(g,3,3,28,28,0xd7a066);rect(g,9,9,16,4,0xf2c880);rect(g,9,17,16,4,0xb97c51);
  });
}

export function textureForArchetype(archetype:string){
  if(archetype.includes("chair"))return "px-chair";
  if(archetype.includes("human_bed"))return "px-human-bed";
  if(archetype.includes("hamster_bed"))return "px-hamster-bed";
  if(archetype.includes("tree"))return "px-tree";
  if(archetype.includes("rock"))return "px-rock";
  if(archetype.includes("wheel"))return "px-wheel";
  if(archetype.includes("house"))return "px-house";
  if(archetype.includes("door"))return "px-door";
  if(archetype.includes("flower"))return "px-flower";
  if(archetype.includes("pickup"))return "px-pickup";
  return "px-generic";
}

export function drawRoomBackdrop(scene:Phaser.Scene,theme:string|undefined,w:number,h:number){
  const group:Phaser.GameObjects.GameObject[]=[];
  const outdoor=theme?.includes("garden");
  const bedding=theme?.includes("bedding");
  const bath=theme?.includes("bath");

  const wallColor=outdoor?PIXEL.grass:bedding?PIXEL.blue:bath?0xb9dadd:0xbdd5c9;
  const floorColor=outdoor?PIXEL.grass:bedding?PIXEL.bedding:bath?0xd9ded8:0xbc8154;

  const bg=scene.add.rectangle(w/2,h/2,w,h,wallColor).setDepth(-1000);group.push(bg);

  if(outdoor){
    const ground=scene.add.rectangle(w/2,h*.58,w,h*.84,PIXEL.grass).setDepth(-999);group.push(ground);
    const path=scene.add.rectangle(w*.51,h*.58,w*.18,h*.84,0xc99b6a).setDepth(-998);group.push(path);
    for(let i=0;i<38;i++){
      const x=(i*83)%w,y=90+((i*47)%(h-120));
      group.push(scene.add.rectangle(x,y,4,4,i%2?PIXEL.grass2:0x6f9b5c).setDepth(-997));
    }
  }else{
    const wall=scene.add.rectangle(w/2,h*.22,w,h*.44,wallColor).setDepth(-999);group.push(wall);
    const trim=scene.add.rectangle(w/2,h*.44,w,8,PIXEL.woodDark).setDepth(-998);group.push(trim);
    const floor=scene.add.rectangle(w/2,h*.72,w,h*.56,floorColor).setDepth(-999);group.push(floor);

    if(bedding){
      for(let i=0;i<80;i++){
        const x=(i*73)%w,y=h*.46+((i*31)%(h*.50));
        group.push(scene.add.rectangle(x,y,8,3,i%3?PIXEL.bedding2:0xd7b96f).setAngle((i%4)*20).setDepth(-997));
      }
      for(let x=26;x<w;x+=72) group.push(scene.add.rectangle(x,h*.18,4,h*.36,0x65747b,.38).setDepth(-996));
    }else if(bath){
      for(let x=0;x<w;x+=32) group.push(scene.add.rectangle(x,h*.72,1,h*.56,0xaebbb8,.4).setDepth(-997));
      for(let y=h*.46;y<h;y+=32) group.push(scene.add.rectangle(w/2,y,w,1,0xaebbb8,.4).setDepth(-997));
    }else{
      for(let x=0;x<w;x+=64) group.push(scene.add.rectangle(x,h*.72,3,h*.56,0x9e6743,.45).setDepth(-997));
      for(let x=42;x<w;x+=110) group.push(scene.add.rectangle(x,h*.18,5,5,0xf4dfb5,.8).setDepth(-997));
    }
  }
  return group;
}
