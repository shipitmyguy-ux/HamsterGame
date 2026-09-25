import fs from "node:fs/promises";
import path from "node:path";
import texturePacker from "free-tex-packer-core";

const sourceDir = path.resolve("assets/source");
const outDir = path.resolve("public/assets/generated");
const atlasName = process.argv[2] || "hamster-atlas";
console.warn("pack-atlas is for exceptional/freeform atlases only; world sprites use assets:normalize.");

async function walk(dir){
  const entries = await fs.readdir(dir,{withFileTypes:true}).catch(()=>[]);
  const out=[];
  for(const entry of entries){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...await walk(full));
    else if(entry.isFile() && /\.png$/i.test(entry.name)) out.push(full);
  }
  return out;
}

const pngs = await walk(sourceDir);
if(!pngs.length){
  console.log("No PNG source assets found in assets/source; atlas step skipped.");
  process.exit(0);
}

const images = await Promise.all(pngs.map(async file=>({
  path:path.relative(sourceDir,file).replaceAll(path.sep,"/"),
  contents:await fs.readFile(file)
})));

await fs.mkdir(outDir,{recursive:true});

const options = {
  textureName: atlasName,
  width: 2048,
  height: 2048,
  fixedSize: false,
  powerOfTwo: false,
  padding: 2,
  extrude: 1,
  allowRotation: false,
  detectIdentical: true,
  allowTrim: false,
  exporter: "Phaser3",
  removeFileExtension: true,
  prependFolderName: true
};

const packed = await new Promise((resolve,reject)=>{
  texturePacker(images,options,(files,error)=>{
    if(error) reject(error);
    else resolve(files);
  });
});

for(const file of packed){
  await fs.writeFile(path.join(outDir,file.name),file.buffer);
  console.log("wrote",path.relative(process.cwd(),path.join(outDir,file.name)));
}
