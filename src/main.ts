import Phaser from "phaser";
import { GridEngine } from "grid-engine";
import VirtualJoystickPlugin from "phaser3-rex-plugins/plugins/virtualjoystick-plugin.js";
import "./styles.css";
import { loadWorld, publicAssetUrl } from "./world";
import { buildNavigationGrid } from "./pipeline/navigation";
import { drawRoomBackdrop, ensurePixelTextures, textureForArchetype } from "./render/pixelArt";
import { ENV_FRAMES, ENV_SCALE, HAMSTER_FRAMES, localFrameFor, type HamsterFacing } from "./render/assetFrames";
import type { Archetype, Entity, Room, WorldPayload } from "./types";

const W=960,H=600;
const status=document.querySelector<HTMLDivElement>("#status")!;
const roomBar=document.querySelector<HTMLDivElement>("#room-bar")!;
const movement={up:false,down:false,left:false,right:false};

function setStatus(text:string){status.textContent=text}
function bindHold(button:HTMLElement,key:keyof typeof movement){
  const on=(e:PointerEvent)=>{e.preventDefault();movement[key]=true;button.setPointerCapture?.(e.pointerId)};
  const off=(e:PointerEvent)=>{e.preventDefault();movement[key]=false};
  button.addEventListener("pointerdown",on);
  button.addEventListener("pointerup",off);
  button.addEventListener("pointercancel",off);
  button.addEventListener("lostpointercapture",()=>movement[key]=false);
}
document.querySelectorAll<HTMLElement>("[data-move]").forEach(b=>bindHold(b,b.dataset.move as keyof typeof movement));

class GameScene extends Phaser.Scene{
  payload!:WorldPayload;
  currentRoom="";
  player!:Phaser.GameObjects.Container;
  playerBody!:Phaser.Physics.Arcade.Body;
  playerSprite!:Phaser.GameObjects.Sprite;
  facing:HamsterFacing="down";
  blockers!:Phaser.Physics.Arcade.StaticGroup;
  arrows!:Phaser.Types.Input.Keyboard.CursorKeys;
  wasd!:Record<string,Phaser.Input.Keyboard.Key>;
  joyKeys:any=null;
  archetypes=new Map<string,Archetype>();
  entityViews=new Map<string,Phaser.GameObjects.GameObject>();

  constructor(){super("game")}

  preload(){
    const base=import.meta.env.BASE_URL;
    this.load.spritesheet("hamster-walk",base+"assets/hamster_walk_4dir.png",{frameWidth:32,frameHeight:32});
    this.load.atlas("env-atlas",base+"assets/environment_atlas.png",base+"assets/environment_atlas.json");
  }

  async create(){
    try{
      this.payload=await loadWorld("draft");
      this.payload.archetypes.forEach(a=>this.archetypes.set(a.archetype_id,a));
      this.currentRoom=this.payload.world.player.start_room||Object.keys(this.payload.world.rooms)[0];
      this.arrows=this.input.keyboard!.createCursorKeys();
      this.wasd=this.input.keyboard!.addKeys("W,A,S,D") as Record<string,Phaser.Input.Keyboard.Key>;
      ensurePixelTextures(this);
      this.createHamsterAnimations();
      await this.loadGeneratedAssets();
      this.createPlayer();
      this.openRoom(this.currentRoom);
      this.createTouchJoystick();
      bindActions(this);
    }catch(error){
      setStatus(error instanceof Error?error.message:String(error));
    }
  }

  createHamsterAnimations(){
    for(const [direction,frames] of Object.entries(HAMSTER_FRAMES)){
      const key="hamster-walk-"+direction;
      if(this.anims.exists(key))continue;
      this.anims.create({
        key,
        frames:frames.map(frame=>({key:"hamster-walk",frame})),
        frameRate:8,
        repeat:-1
      });
    }
  }

  async loadGeneratedAssets(){
    const ready=(this.payload.assets||[]).filter(a=>a.status==="ready"&&a.file_path);
    if(!ready.length)return;
    for(const asset of ready){
      const key="asset:"+asset.asset_id;
      if(!this.textures.exists(key))this.load.image(key,publicAssetUrl(String(asset.file_path)));
    }
    await new Promise<void>((resolve)=>{
      this.load.once(Phaser.Loader.Events.COMPLETE,()=>resolve());
      this.load.start();
    });
  }

  textureForAsset(assetId:string|undefined,fallback:string){
    const key=assetId?"asset:"+assetId:"";
    return key&&this.textures.exists(key)?key:fallback;
  }

  createTouchJoystick(){
    try{
      const plugin=this.plugins.get("rexVirtualJoystick") as any;
      if(!plugin?.add)return;
      const base=this.add.circle(92,H-92,58,0x513728,.24).setStrokeStyle(4,0xf7dfac,.8).setDepth(20000).setScrollFactor(0);
      const thumb=this.add.circle(0,0,28,0xf7dfac,.88).setStrokeStyle(3,0x6c4935,.95).setDepth(20001).setScrollFactor(0);
      const joystick=plugin.add(this,{x:92,y:H-92,radius:58,base,thumb,dir:"8dir",forceMin:8,enable:true});
      this.joyKeys=joystick.createCursorKeys();
      document.body.classList.add("rex-ready");
    }catch{}
  }

  createPlayer(){
    const shadow=this.add.ellipse(0,4,40,10,0x3d2c20,.18);
    this.playerSprite=this.add.sprite(0,0,"hamster-walk",HAMSTER_FRAMES.down[0]).setOrigin(.5,1).setScale(2.15);
    this.player=this.add.container(W*.5,H*.62,[shadow,this.playerSprite]).setSize(54,56);
    this.physics.add.existing(this.player);
    this.playerBody=this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true).setSize(34,23).setOffset(10,29);
    this.player.setDepth(this.player.y+20);
  }

  clearRoom(){
    for(const obj of this.entityViews.values())obj.destroy();
    this.entityViews.clear();
    this.blockers?.clear(true,true);
  }

  openRoom(id:string){
    const room=this.payload.world.rooms[id];
    if(!room)return;
    this.currentRoom=id;
    this.clearRoom();
    this.blockers=this.physics.add.staticGroup();
    this.drawRoom(room);
    for(const entity of room.entities||[])this.spawnEntity(entity);
    this.physics.add.collider(this.player,this.blockers);
    this.player.setPosition(W*.5,H*.66);
    buildRoomBar(this,room.id);
    const nav=buildNavigationGrid(room,this.archetypes);
    const blocked=nav.data.reduce((n,row)=>n+row.filter(Boolean).length,0);
    setStatus(`${room.name} · draft v${this.payload.version} · ${blocked} blocked nav cells`);
  }

  drawRoom(room:Room){
    drawRoomBackdrop(this,room.theme,W,H).forEach((o,i)=>this.entityViews.set("__bg"+i,o));
    const title=this.add.text(18,16,room.name.toUpperCase(),{
      fontFamily:"monospace",fontSize:"18px",color:"#513728",
      backgroundColor:"#f7dfacdd",padding:{x:8,y:5}
    }).setDepth(10000).setResolution(2);
    this.entityViews.set("__title",title);
  }

  spawnEntity(entity:Entity){
    const x=(entity.position?.x??.5)*W,y=(entity.position?.y??.5)*H;
    const arch=this.archetypes.get(entity.archetype);
    const fallback=textureForArchetype(entity.archetype);
    const localFrame=localFrameFor(entity.asset);
    let sprite:Phaser.GameObjects.Image;
    if(localFrame){
      sprite=this.add.image(x,y,"env-atlas",localFrame).setOrigin(.5,1).setDepth(y).setScale(ENV_SCALE[localFrame]||1.3);
    }else{
      const texture=this.textureForAsset(entity.asset,fallback);
      sprite=this.add.image(x,y,texture).setOrigin(.5,1).setDepth(y);
      const baseW=this.textures.get(fallback).getSourceImage().width||48;
      const baseH=this.textures.get(fallback).getSourceImage().height||48;
      sprite.setDisplaySize(baseW*1.35,baseH*1.35);
    }
    this.entityViews.set(entity.id,sprite);
    const collision=entity.physics?.collision||arch?.collision;
    if(collision?.mode&&collision.mode!=="none"){
      const n=collision.normalized||{x:.1,y:.68,w:.8,h:.25};
      const b=sprite.getBounds();
      const rw=Math.max(12,b.width*n.w),rh=Math.max(10,b.height*n.h);
      const rx=x+b.width*(n.x+.5*n.w-.5);
      const ry=y-b.height+b.height*(n.y+.5*n.h);
      const blocker=this.add.rectangle(rx,ry,rw,rh,0xff0000,0);
      this.physics.add.existing(blocker,true);
      this.blockers.add(blocker);
      this.entityViews.set(entity.id+"__collision",blocker);
    }
  }

  update(){
    if(!this.playerBody)return;
    let dx=0,dy=0;
    if(movement.left||this.arrows?.left.isDown||this.wasd?.A.isDown||this.joyKeys?.left?.isDown)dx--;
    if(movement.right||this.arrows?.right.isDown||this.wasd?.D.isDown||this.joyKeys?.right?.isDown)dx++;
    if(movement.up||this.arrows?.up.isDown||this.wasd?.W.isDown||this.joyKeys?.up?.isDown)dy--;
    if(movement.down||this.arrows?.down.isDown||this.wasd?.S.isDown||this.joyKeys?.down?.isDown)dy++;
    const len=Math.hypot(dx,dy)||1;
    this.playerBody.setVelocity(dx/len*190,dy/len*190);
    if(dx||dy){
      if(Math.abs(dx)>Math.abs(dy))this.facing=dx<0?"left":"right";
      else this.facing=dy<0?"up":"down";
      this.playerSprite.play("hamster-walk-"+this.facing,true);
    }else{
      this.playerSprite.stop();
      this.playerSprite.setFrame(HAMSTER_FRAMES[this.facing][0]);
    }
    this.player.setDepth(this.player.y+20);
  }

  interact(){
    const room=this.payload.world.rooms[this.currentRoom];
    let nearest:Entity|undefined,dist=Infinity;
    for(const entity of room.entities||[]){
      const ex=(entity.position?.x??.5)*W,ey=(entity.position?.y??.5)*H;
      const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,ex,ey);
      if(d<dist){dist=d;nearest=entity}
    }
    if(nearest&&dist<115)setStatus(`Interacting with ${nearest.name||nearest.id}.`);
    else setStatus("Nothing close enough to interact with.");
  }
}

function buildRoomBar(scene:GameScene,current:string){
  roomBar.innerHTML="";
  Object.values(scene.payload.world.rooms).forEach(room=>{
    const b=document.createElement("button");
    b.type="button";
    b.textContent=room.name;
    b.classList.toggle("active",room.id===current);
    b.addEventListener("click",()=>scene.openRoom(room.id));
    roomBar.appendChild(b);
  });
}

function bindActions(scene:GameScene){
  document.querySelector<HTMLButtonElement>("#interact")!.onclick=()=>scene.interact();
  document.querySelector<HTMLButtonElement>("#build")!.onclick=()=>setStatus("Build mode uses the same archetype + placement pipeline as creator edits.");
}

new Phaser.Game({
  type:Phaser.AUTO,parent:"game",width:W,height:H,backgroundColor:"#d8ba74",pixelArt:true,
  physics:{default:"arcade",arcade:{debug:false}},
  plugins:{
    scene:[{key:"gridEngine",plugin:GridEngine,mapping:"gridEngine"}],
    global:[{key:"rexVirtualJoystick",plugin:VirtualJoystickPlugin,start:true}]
  },
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  scene:[GameScene],input:{activePointers:3}
});
