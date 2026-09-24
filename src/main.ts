import Phaser from "phaser";
import { GridEngine } from "grid-engine";
import VirtualJoystickPlugin from "phaser3-rex-plugins/plugins/virtualjoystick-plugin.js";
import "./styles.css";
import { loadWorld } from "./world";
import { buildNavigationGrid } from "./pipeline/navigation";
import type { Archetype, Entity, Room, WorldPayload } from "./types";

const W=960,H=600;
const status=document.querySelector<HTMLDivElement>("#status")!;
const roomBar=document.querySelector<HTMLDivElement>("#room-bar")!;
const movement={up:false,down:false,left:false,right:false};

function setStatus(text:string){status.textContent=text;}
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
  blockers!:Phaser.Physics.Arcade.StaticGroup;
  arrows!:Phaser.Types.Input.Keyboard.CursorKeys;
  wasd!:Record<string,Phaser.Input.Keyboard.Key>;
  joyKeys:any=null;
  joystick:any=null;
  archetypes=new Map<string,Archetype>();
  entityViews=new Map<string,Phaser.GameObjects.GameObject>();

  constructor(){super("game")}

  async create(){
    try{
      this.payload=await loadWorld("draft");
      this.payload.archetypes.forEach(a=>this.archetypes.set(a.archetype_id,a));
      this.currentRoom=this.payload.world.player.start_room || Object.keys(this.payload.world.rooms)[0];
      this.arrows=this.input.keyboard!.createCursorKeys();
      this.wasd=this.input.keyboard!.addKeys("W,A,S,D") as Record<string,Phaser.Input.Keyboard.Key>;
      this.createPlayer();
      this.openRoom(this.currentRoom);
      this.createTouchJoystick();
      this.cameras.main.setBackgroundColor("#d8ba74");
      bindActions(this);
    }catch(error){
      setStatus(error instanceof Error?error.message:String(error));
    }
  }

  createTouchJoystick(){
    try{
      const plugin=this.plugins.get("rexVirtualJoystick") as any;
      if(!plugin?.add)return;
      const base=this.add.circle(92,H-92,58,0x513728,.25)
        .setStrokeStyle(4,0xf7dfac,.7)
        .setDepth(20000)
        .setScrollFactor(0);
      const thumb=this.add.circle(0,0,28,0xf7dfac,.82)
        .setStrokeStyle(3,0x6c4935,.9)
        .setDepth(20001)
        .setScrollFactor(0);
      this.joystick=plugin.add(this,{
        x:92,y:H-92,radius:58,
        base,thumb,
        dir:"8dir",
        forceMin:8,
        enable:true
      });
      this.joyKeys=this.joystick.createCursorKeys();
      document.body.classList.add("rex-ready");
    }catch{
      // HTML D-pad remains available as the no-plugin fallback.
    }
  }

  createPlayer(){
    const body=this.add.ellipse(0,3,42,34,0xdc8c4a).setStrokeStyle(3,0x5b3c2c);
    const belly=this.add.ellipse(-3,9,25,18,0xffedcf);
    const head=this.add.circle(17,-7,18,0xe39a52).setStrokeStyle(3,0x5b3c2c);
    const ear=this.add.circle(10,-22,7,0xf2aa82).setStrokeStyle(2,0x5b3c2c);
    const eye=this.add.circle(24,-10,3,0x211712);
    const nose=this.add.circle(35,-3,3,0xa94f51);
    this.player=this.add.container(W*.5,H*.6,[body,belly,head,ear,eye,nose]).setSize(48,38);
    this.physics.add.existing(this.player);
    this.playerBody=this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true).setSize(36,25).setOffset(5,10);
    this.player.setDepth(this.player.y+20);
  }

  clearRoom(){
    for(const obj of this.entityViews.values()) obj.destroy();
    this.entityViews.clear();
    this.blockers?.clear(true,true);
  }

  openRoom(id:string){
    const room=this.payload.world.rooms[id];
    if(!room)return;
    this.currentRoom=id;
    this.clearRoom();
    this.blockers=this.physics.add.staticGroup();
    this.drawFloor(room);
    for(const entity of room.entities||[]) this.spawnEntity(entity);
    this.physics.add.collider(this.player,this.blockers);
    this.player.setPosition(W*.5,H*.65);
    buildRoomBar(this,room.id);

    const nav=buildNavigationGrid(room,this.archetypes);
    const blocked=nav.data.reduce((n,row)=>n+row.filter(Boolean).length,0);
    setStatus(`${room.name} · draft v${this.payload.version} · ${room.entities?.length||0} objects · ${blocked} nav cells blocked`);
  }

  drawFloor(room:Room){
    const color=room.theme?.includes("bath")?0xd9dedb:room.theme?.includes("garden")?0x8fb66b:room.theme?.includes("bedding")?0xe6c983:0xc78b5a;
    const bg=this.add.rectangle(W/2,H/2,W,H,color).setDepth(-1000);
    this.entityViews.set("__bg",bg);
    const g=this.add.grid(W/2,H/2,W,H,32,32,0xffffff,0,0x5e4738,.12).setDepth(-999);
    this.entityViews.set("__grid",g);
    const title=this.add.text(18,16,room.name,{fontFamily:"monospace",fontSize:"22px",color:"#513728",backgroundColor:"#f7dfaccc",padding:{x:8,y:5}}).setDepth(10000);
    this.entityViews.set("__title",title);
  }

  spawnEntity(entity:Entity){
    const x=(entity.position?.x??.5)*W,y=(entity.position?.y??.5)*H;
    const arch=this.archetypes.get(entity.archetype);
    const symbol=entity.emoji || guessEmoji(entity.archetype);
    const text=this.add.text(x,y,symbol,{fontSize:"48px"}).setOrigin(.5,1);
    text.setDepth(y);
    this.entityViews.set(entity.id,text);

    const collision=entity.physics?.collision || arch?.collision;
    if(collision?.mode && collision.mode!=="none"){
      const n=collision.normalized || {x:.1,y:.68,w:.8,h:.25};
      const bounds=text.getBounds();
      const rw=Math.max(12,bounds.width*n.w),rh=Math.max(10,bounds.height*n.h);
      const rx=x+bounds.width*(n.x+.5*n.w-.5),ry=y-bounds.height+bounds.height*(n.y+.5*n.h);
      const blocker=this.add.rectangle(rx,ry,rw,rh,0xff0000,0);
      this.physics.add.existing(blocker,true);
      this.blockers.add(blocker);
      this.entityViews.set(entity.id+"__collision",blocker);
    }
  }

  update(){
    if(!this.playerBody)return;
    const speed=190;
    let dx=0,dy=0;
    if(movement.left||this.arrows?.left.isDown||this.wasd?.A.isDown||this.joyKeys?.left?.isDown)dx--;
    if(movement.right||this.arrows?.right.isDown||this.wasd?.D.isDown||this.joyKeys?.right?.isDown)dx++;
    if(movement.up||this.arrows?.up.isDown||this.wasd?.W.isDown||this.joyKeys?.up?.isDown)dy--;
    if(movement.down||this.arrows?.down.isDown||this.wasd?.S.isDown||this.joyKeys?.down?.isDown)dy++;
    const len=Math.hypot(dx,dy)||1;
    this.playerBody.setVelocity(dx/len*speed,dy/len*speed);
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

function guessEmoji(a:string){
  if(a.includes("chair"))return "🪑";
  if(a.includes("bed"))return "🛏️";
  if(a.includes("tree"))return "🌳";
  if(a.includes("rock"))return "🪨";
  if(a.includes("wheel"))return "🎡";
  if(a.includes("house"))return "🏠";
  if(a.includes("door"))return "🚪";
  if(a.includes("flower"))return "🌻";
  if(a.includes("rug"))return "🟫";
  if(a.includes("pickup"))return "✨";
  return "📦";
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
  document.querySelector<HTMLButtonElement>("#build")!.onclick=()=>setStatus("Build mode will use the same archetype + placement pipeline as creator edits.");
}

new Phaser.Game({
  type:Phaser.AUTO,
  parent:"game",
  width:W,
  height:H,
  backgroundColor:"#d8ba74",
  pixelArt:true,
  physics:{default:"arcade",arcade:{debug:false}},
  plugins:{
    scene:[{key:"gridEngine",plugin:GridEngine,mapping:"gridEngine"}],
    global:[{key:"rexVirtualJoystick",plugin:VirtualJoystickPlugin,start:true}]
  },
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  scene:[GameScene],
  input:{activePointers:3}
});
