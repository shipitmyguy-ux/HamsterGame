import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const root=process.cwd();
const catalogPath=path.join(root,"assets","asset-catalog.json");
const catalog=JSON.parse(await fs.readFile(catalogPath,"utf8"));
const sourceAtlas=path.join(root,catalog.sourceAtlas);
const hamsterSource=path.join(root,catalog.hamsterSource);
const outDir=path.join(root,"public","assets","generated");
await fs.mkdir(outDir,{recursive:true});

async function cleanTinyComponents(buffer){
  const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height,channels}=info;
  const seen=new Uint8Array(width*height);
  const comps=[];
  const alphaAt=i=>data[i*channels+3];
  for(let p=0;p<width*height;p++){
    if(seen[p]||alphaAt(p)<=16) continue;
    const stack=[p];
    seen[p]=1;
    const pixels=[];
    while(stack.length){
      const i=stack.pop();
      pixels.push(i);
      const x=i%width,y=(i/width)|0;
      const next=[];
      if(x>0) next.push(i-1);
      if(x<width-1) next.push(i+1);
      if(y>0) next.push(i-width);
      if(y<height-1) next.push(i+width);
      for(const n of next){
        if(!seen[n]&&alphaAt(n)>16){seen[n]=1;stack.push(n)}
      }
    }
    comps.push(pixels);
  }
  for(const pixels of comps){
    if(pixels.length>3) continue;
    for(const i of pixels){
      const o=i*channels;
      data[o+3]=0;
    }
  }
  return sharp(data,{raw:{width,height,channels}}).png().toBuffer();
}

async function normalizeSprite(buffer,cell,gutter){
  let cleaned=await cleanTinyComponents(buffer);
  cleaned=await sharp(cleaned)
    .trim({background:{r:0,g:0,b:0,alpha:0},threshold:8})
    .png()
    .toBuffer();

  const meta=await sharp(cleaned).metadata();
  const max=cell-gutter*2;
  const scale=Math.min(max/(meta.width||1),max/(meta.height||1));
  const width=Math.max(1,Math.round((meta.width||1)*scale));
  const height=Math.max(1,Math.round((meta.height||1)*scale));
  const resized=await sharp(cleaned)
    .resize(width,height,{kernel:"nearest",fit:"fill"})
    .png()
    .toBuffer();

  const x=Math.floor((cell-width)/2);
  const y=cell-gutter-height;
  if(x<gutter||x+width>cell-gutter||y<gutter||y+height>cell-gutter){
    throw new Error(`sprite violates gutter: ${JSON.stringify({cell,gutter,x,y,width,height})}`);
  }
  return {buffer:resized,content:{x,y,w:width,h:height}};
}

async function buildSheet(sheetId,assets){
  const spec=catalog.sheets[sheetId];
  const rows=Math.ceil(assets.length/spec.columns);
  const width=spec.columns*spec.cell;
  const height=rows*spec.cell;
  const layers=[];
  const manifestAssets={};

  for(let index=0;index<assets.length;index++){
    const asset=assets[index];
    const raw=await sharp(sourceAtlas)
      .extract({left:asset.source.x,top:asset.source.y,width:asset.source.w,height:asset.source.h})
      .png()
      .toBuffer();
    const normalized=await normalizeSprite(raw,spec.cell,spec.gutter);
    const col=index%spec.columns,row=Math.floor(index/spec.columns);
    layers.push({
      input:normalized.buffer,
      left:col*spec.cell+normalized.content.x,
      top:row*spec.cell+normalized.content.y
    });
    manifestAssets[asset.id]={
      sheet:sheetId,
      frame:index,
      cell:spec.cell,
      content:normalized.content
    };
  }

  const output=await sharp({
    create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}
  }).composite(layers).png({compressionLevel:9}).toBuffer();

  const hash=crypto.createHash("sha256").update(output).digest("hex").slice(0,10);
  const file=`${sheetId}.${hash}.png`;
  await fs.writeFile(path.join(outDir,file),output);
  return {file,cell:spec.cell,columns:spec.columns,rows,width,height,assets:manifestAssets,hash};
}

async function buildHamster(){
  const source=sharp(hamsterSource);
  const meta=await source.metadata();
  if(meta.width!==128||meta.height!==128) throw new Error("hamster source must be 128x128");
  const cell=32,gutter=2,columns=4,rows=4,layers=[],content=[];
  for(let frame=0;frame<16;frame++){
    const col=frame%4,row=Math.floor(frame/4);
    const raw=await sharp(hamsterSource)
      .extract({left:col*32,top:row*32,width:32,height:32})
      .png()
      .toBuffer();
    const normalized=await normalizeSprite(raw,cell,gutter);
    layers.push({input:normalized.buffer,left:col*cell+normalized.content.x,top:row*cell+normalized.content.y});
    content.push(normalized.content);
  }
  const output=await sharp({
    create:{width:128,height:128,channels:4,background:{r:0,g:0,b:0,alpha:0}}
  }).composite(layers).png({compressionLevel:9}).toBuffer();
  const hash=crypto.createHash("sha256").update(output).digest("hex").slice(0,10);
  const file=`hamster32.${hash}.png`;
  await fs.writeFile(path.join(outDir,file),output);
  return {
    file,cell,columns,rows,hash,content,
    directions:{up:[0,1,2,3],left:[4,5,6,7],right:[8,9,10,11],down:[12,13,14,15]}
  };
}

const grouped={};
for(const asset of catalog.assets){
  (grouped[asset.sheet]??=[]).push(asset);
}

const sheets={},assets={};
for(const sheetId of Object.keys(catalog.sheets)){
  const built=await buildSheet(sheetId,grouped[sheetId]||[]);
  sheets[sheetId]={
    file:built.file,cell:built.cell,columns:built.columns,rows:built.rows,
    width:built.width,height:built.height,hash:built.hash
  };
  Object.assign(assets,built.assets);
}

const hamster=await buildHamster();
const fingerprint=crypto.createHash("sha256")
  .update(JSON.stringify({sheets,assets,hamster}))
  .digest("hex").slice(0,12);

const manifest={
  schema:1,
  version:fingerprint,
  worldScale:1.7,
  playerScale:2.15,
  sheets,
  assets,
  hamster
};
await fs.writeFile(path.join(outDir,"asset-manifest.json"),JSON.stringify(manifest,null,2)+"\n");

for(const entry of await fs.readdir(outDir)){
  if(entry==="asset-manifest.json")continue;
  const keep=new Set([
    ...Object.values(sheets).map(s=>s.file),
    hamster.file
  ]);
  if(!keep.has(entry)&&/^(items32|props64|structures96|hamster32)\./.test(entry)){
    await fs.unlink(path.join(outDir,entry)).catch(()=>{});
  }
}

console.log(`Normalized ${Object.keys(assets).length} assets + 16 hamster frames. Manifest ${fingerprint}.`);
