import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const root=process.cwd();
const PIXEL_QUANTUM=2;
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
    if(seen[p]||alphaAt(p)<=16)continue;
    const stack=[p];
    seen[p]=1;
    const pixels=[];

    while(stack.length){
      const i=stack.pop();
      pixels.push(i);
      const x=i%width,y=(i/width)|0;
      const next=[];
      if(x>0)next.push(i-1);
      if(x<width-1)next.push(i+1);
      if(y>0)next.push(i-width);
      if(y<height-1)next.push(i+width);

      for(const n of next){
        if(!seen[n]&&alphaAt(n)>16){
          seen[n]=1;
          stack.push(n);
        }
      }
    }
    comps.push(pixels);
  }

  for(const pixels of comps){
    if(pixels.length>3)continue;
    for(const i of pixels)data[i*channels+3]=0;
  }

  return sharp(data,{raw:{width,height,channels}}).png().toBuffer();
}

async function hardAlpha(buffer){
  const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height,channels}=info;
  for(let i=0;i<width*height;i++){
    const a=i*channels+3;
    data[a]=data[a]>=64?255:0;
  }
  return sharp(data,{raw:{width,height,channels}}).png().toBuffer();
}

async function contentBounds(buffer){
  const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height,channels}=info;
  let minX=width,minY=height,maxX=-1,maxY=-1;

  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      if(data[(y*width+x)*channels+3]===0)continue;
      minX=Math.min(minX,x);minY=Math.min(minY,y);
      maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    }
  }

  if(maxX<0)return{x:0,y:0,w:0,h:0};
  return{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
}

async function normalizeSprite(buffer,cell,gutter){
  if(cell%PIXEL_QUANTUM!==0||gutter%PIXEL_QUANTUM!==0){
    throw new Error(`cell/gutter must be divisible by pixel quantum ${PIXEL_QUANTUM}`);
  }

  let cleaned=await cleanTinyComponents(buffer);
  cleaned=await sharp(cleaned)
    .trim({background:{r:0,g:0,b:0,alpha:0},threshold:8})
    .png()
    .toBuffer();

  const logicalCell=cell/PIXEL_QUANTUM;
  const logicalGutter=gutter/PIXEL_QUANTUM;
  const logicalMax=logicalCell-logicalGutter*2;
  const meta=await sharp(cleaned).metadata();
  const scale=Math.min(logicalMax/(meta.width||1),logicalMax/(meta.height||1));
  const logicalW=Math.max(1,Math.round((meta.width||1)*scale));
  const logicalH=Math.max(1,Math.round((meta.height||1)*scale));

  let logicalSprite=await sharp(cleaned)
    .resize(logicalW,logicalH,{kernel:"nearest",fit:"fill"})
    .png()
    .toBuffer();
  logicalSprite=await hardAlpha(logicalSprite);

  const x=Math.floor((logicalCell-logicalW)/2);
  const y=logicalCell-logicalGutter-logicalH;

  if(
    x<logicalGutter||
    x+logicalW>logicalCell-logicalGutter||
    y<logicalGutter||
    y+logicalH>logicalCell-logicalGutter
  ){
    throw new Error(`sprite violates logical gutter: ${JSON.stringify({cell,gutter,x,y,logicalW,logicalH})}`);
  }

  const logicalCanvas=await sharp({
    create:{
      width:logicalCell,
      height:logicalCell,
      channels:4,
      background:{r:0,g:0,b:0,alpha:0}
    }
  }).composite([{input:logicalSprite,left:x,top:y}]).png().toBuffer();

  let output=await sharp(logicalCanvas)
    .resize(cell,cell,{kernel:"nearest"})
    .png({compressionLevel:9})
    .toBuffer();
  output=await hardAlpha(output);

  return{
    buffer:output,
    content:{
      x:x*PIXEL_QUANTUM,
      y:y*PIXEL_QUANTUM,
      w:logicalW*PIXEL_QUANTUM,
      h:logicalH*PIXEL_QUANTUM
    }
  };
}

async function pixelateFixedCell(buffer,cell){
  const logical=cell/PIXEL_QUANTUM;
  let out=await sharp(buffer)
    .resize(logical,logical,{kernel:"nearest",fit:"fill"})
    .resize(cell,cell,{kernel:"nearest",fit:"fill"})
    .png({compressionLevel:9})
    .toBuffer();
  out=await hardAlpha(out);
  return out;
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
      .extract({
        left:asset.source.x,
        top:asset.source.y,
        width:asset.source.w,
        height:asset.source.h
      })
      .png()
      .toBuffer();

    const normalized=await normalizeSprite(raw,spec.cell,spec.gutter);
    const col=index%spec.columns;
    const row=Math.floor(index/spec.columns);

    layers.push({
      input:normalized.buffer,
      left:col*spec.cell,
      top:row*spec.cell
    });

    manifestAssets[asset.id]={
      sheet:sheetId,
      frame:index,
      cell:spec.cell,
      pixelQuantum:PIXEL_QUANTUM,
      content:normalized.content
    };
  }

  const output=await sharp({
    create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}
  }).composite(layers).png({compressionLevel:9}).toBuffer();

  const hash=crypto.createHash("sha256").update(output).digest("hex").slice(0,10);
  const file=`${sheetId}.${hash}.png`;
  await fs.writeFile(path.join(outDir,file),output);

  return{
    file,
    cell:spec.cell,
    logicalCell:spec.cell/PIXEL_QUANTUM,
    pixelQuantum:PIXEL_QUANTUM,
    columns:spec.columns,
    rows,
    width,
    height,
    assets:manifestAssets,
    hash
  };
}

async function buildHamster(){
  const meta=await sharp(hamsterSource).metadata();
  if(meta.width!==128||meta.height!==128){
    throw new Error("hamster source must be 128x128");
  }

  const cell=32;
  const columns=4;
  const rows=4;
  const layers=[];
  const content=[];

  for(let frame=0;frame<16;frame++){
    const col=frame%4;
    const row=Math.floor(frame/4);
    const raw=await sharp(hamsterSource)
      .extract({left:col*32,top:row*32,width:32,height:32})
      .png()
      .toBuffer();

    const normalized=await pixelateFixedCell(raw,cell);
    const bounds=await contentBounds(normalized);

    layers.push({
      input:normalized,
      left:col*cell,
      top:row*cell
    });
    content.push(bounds);
  }

  const output=await sharp({
    create:{width:128,height:128,channels:4,background:{r:0,g:0,b:0,alpha:0}}
  }).composite(layers).png({compressionLevel:9}).toBuffer();

  const hash=crypto.createHash("sha256").update(output).digest("hex").slice(0,10);
  const file=`hamster32.${hash}.png`;
  await fs.writeFile(path.join(outDir,file),output);

  return{
    file,
    cell,
    logicalCell:cell/PIXEL_QUANTUM,
    pixelQuantum:PIXEL_QUANTUM,
    columns,
    rows,
    hash,
    content,
    directions:{
      up:[0,1,2,3],
      left:[4,5,6,7],
      right:[8,9,10,11],
      down:[12,13,14,15]
    }
  };
}

const grouped={};
for(const asset of catalog.assets){
  (grouped[asset.sheet]??=[]).push(asset);
}

const sheets={};
const assets={};

for(const sheetId of Object.keys(catalog.sheets)){
  const built=await buildSheet(sheetId,grouped[sheetId]||[]);
  sheets[sheetId]={
    file:built.file,
    cell:built.cell,
    logicalCell:built.logicalCell,
    pixelQuantum:built.pixelQuantum,
    columns:built.columns,
    rows:built.rows,
    width:built.width,
    height:built.height,
    hash:built.hash
  };
  Object.assign(assets,built.assets);
}

const hamster=await buildHamster();
const fingerprint=crypto.createHash("sha256")
  .update(JSON.stringify({pixelQuantum:PIXEL_QUANTUM,sheets,assets,hamster}))
  .digest("hex")
  .slice(0,12);

const manifest={
  schema:2,
  version:fingerprint,
  pixelQuantum:PIXEL_QUANTUM,
  worldScale:2,
  playerScale:2,
  sheets,
  assets,
  hamster
};

await fs.writeFile(
  path.join(outDir,"asset-manifest.json"),
  JSON.stringify(manifest,null,2)+"\n"
);

for(const entry of await fs.readdir(outDir)){
  if(entry==="asset-manifest.json")continue;
  const keep=new Set([
    ...Object.values(sheets).map(s=>s.file),
    hamster.file
  ]);
  if(
    !keep.has(entry)&&
    /^(items32|props64|structures96|hamster32)\./.test(entry)
  ){
    await fs.unlink(path.join(outDir,entry)).catch(()=>{});
  }
}

console.log(
  `Normalized ${Object.keys(assets).length} assets + 16 hamster frames at ${PIXEL_QUANTUM}x pixel quantum. Manifest ${fingerprint}.`
);
