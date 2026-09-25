const CONTROL="https://umvmilulnqnmeqvfoxxc.supabase.co/functions/v1/hamster-control-v1";
const STORAGE_KEY="hamsterCreatorKey";

const panel=document.querySelector<HTMLElement>("#creator-panel")!;
const toggle=document.querySelector<HTMLButtonElement>("#creator-toggle")!;
const closeButton=document.querySelector<HTMLButtonElement>("#creator-close")!;
const keyInput=document.querySelector<HTMLInputElement>("#creator-key")!;
const saveKey=document.querySelector<HTMLButtonElement>("#creator-save-key")!;
const promptInput=document.querySelector<HTMLTextAreaElement>("#creator-prompt")!;
const apply=document.querySelector<HTMLButtonElement>("#creator-apply")!;
const state=document.querySelector<HTMLElement>("#creator-state")!;
const result=document.querySelector<HTMLElement>("#creator-result")!;

function getKey(){return localStorage.getItem(STORAGE_KEY)||""}
function setResult(text:string,kind:"good"|"bad"|""=""){result.textContent=text;result.className=kind}
function refreshState(){
  const has=Boolean(getKey());
  state.textContent=has?"✓ Creator access saved on this device.":"This device is not authorized yet.";
  keyInput.value="";
  apply.disabled=!has;
}
function importHashKey(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,""));
  const key=hash.get("creator");
  if(!key)return;
  localStorage.setItem(STORAGE_KEY,key);
  history.replaceState(null,"",location.pathname+location.search);
  panel.hidden=false;
  setResult("Creator mode authorized on this device.","good");
  refreshState();
}

toggle.addEventListener("click",()=>{panel.hidden=!panel.hidden;if(!panel.hidden)promptInput.focus()});
closeButton.addEventListener("click",()=>panel.hidden=true);
saveKey.addEventListener("click",()=>{
  const key=keyInput.value.trim();
  if(!key){setResult("Paste the family creator key first.","bad");return}
  localStorage.setItem(STORAGE_KEY,key);
  setResult("Creator key saved.","good");
  refreshState();
  promptInput.focus();
});
apply.addEventListener("click",async()=>{
  const creatorKey=getKey(),text=promptInput.value.trim();
  if(!creatorKey){setResult("Authorize this device first.","bad");return}
  if(!text){setResult("Say or type what you want to change.","bad");return}
  apply.disabled=true;
  apply.textContent="MAKING IT…";
  setResult("Turning that into a game change…","");
  try{
    const response=await fetch(CONTROL,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-hamster-creator":creatorKey},
      body:JSON.stringify({prompt:text})
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body?.error||("Creator request failed ("+response.status+")"));
    setResult("✓ Change applied to the draft world. Reloading…","good");
    setTimeout(()=>location.reload(),650);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    if(/creator access required/i.test(message))localStorage.removeItem(STORAGE_KEY);
    setResult(message,"bad");
    refreshState();
  }finally{
    apply.disabled=!getKey();
    apply.textContent="✨ MAKE IT";
  }
});

importHashKey();
refreshState();
