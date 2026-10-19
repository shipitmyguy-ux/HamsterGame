// Family password screen, shared by every game on shipitmyguy-ux.github.io.
// Unlocking one game unlocks all of them on that device. Not real security:
// it keeps casual visitors out; the repo itself stays public.
// To change the password, replace HASH with the SHA-256 of the new lowercase password
// in every game's gate.js.
(()=>{
  const HASH="e9ca42b535c4046696d89181ecb0964bf863dd96be1a8114fb78e255ede5d8b6";
  const KEY="familyGamesUnlock";
  try{if(localStorage.getItem(KEY)===HASH)return;}catch(e){}

  const show=()=>{
    const gate=document.createElement("div");
    gate.id="family-gate";
    gate.innerHTML=`<form style="background:#fff7e6;border-radius:24px;padding:28px 24px;max-width:320px;width:calc(100% - 48px);text-align:center;box-shadow:0 10px 40px #0004;font-family:system-ui,sans-serif">
      <div style="font-size:56px;line-height:1">🔒</div>
      <h1 style="margin:12px 0 16px;font-size:24px;color:#3b2d28">Family games</h1>
      <input type="password" autocomplete="current-password" placeholder="Password" aria-label="Password"
        style="box-sizing:border-box;width:100%;font-size:22px;padding:12px 14px;border:3px solid #dfc18c;border-radius:14px;text-align:center">
      <button style="margin-top:14px;width:100%;font-size:22px;padding:12px;border:0;border-radius:14px;background:#39724b;color:#fff;font-weight:700">Play</button>
      <p role="status" style="min-height:1.4em;margin:12px 0 0;color:#b4412f;font-size:18px"></p>
    </form>`;
    gate.style.cssText="position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#8fbd79";
    document.body.appendChild(gate);
    const form=gate.querySelector("form"),input=gate.querySelector("input"),status=gate.querySelector("p");
    setTimeout(()=>input.focus(),50);
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      const bytes=new TextEncoder().encode(input.value.trim().toLowerCase());
      const digest=await crypto.subtle.digest("SHA-256",bytes);
      const hex=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
      if(hex!==HASH){status.textContent="Try again";input.select();return;}
      try{localStorage.setItem(KEY,HASH);}catch(e){}
      gate.remove();
    });
  };
  if(document.body)show();else document.addEventListener("DOMContentLoaded",show);
})();
