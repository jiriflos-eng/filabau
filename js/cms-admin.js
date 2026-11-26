"use strict";
const $=id=>document.getElementById(id);
const LANGS={cs:"Čeština",en:"English",de:"Deutsch",fr:"Français",it:"Italiano",es:"Español",pl:"Polski"};
const ALBUMS={unas:"U nás",pobliz:"Poblíž",opodal:"Opodál",ruzne:"Různé",filemon:"Studio Filemon",baucis:"Studio Baucis"};
const PRICE_MONTHS={may:"Květen",jun:"Červen",jul:"Červenec",aug:"Srpen",sep:"Září",oct:"Říjen"};
const priceKey=k=>typeof k==="string"&&k.startsWith("price:")&&Object.hasOwn(PRICE_MONTHS,k.slice(6));
const editableKey=k=>draft&&(priceKey(k)?Object.hasOwn(draft.content.prices||{},k.slice(6)):Object.hasOwn(draft.content.cs,k));
const nodeKey=el=>el.dataset.cmsPrice?"price:"+el.dataset.cmsPrice:el.dataset.i18n||el.dataset.albumTitle||el.dataset.albumLead;
const editorSelector="[data-i18n],[data-album-title],[data-album-lead],[data-cms-price]";
let api="",password="",draft=null,uploads=new Map(),dirty=false,busy=false,selectedKey="",textDirty=false,photoBusy=false;
const clone=x=>JSON.parse(JSON.stringify(x));
const selectOptions=(el,values)=>{el.replaceChildren(...Object.entries(values).map(([v,l])=>new Option(l,v)));};
["cms-lang","cms-text-lang","cms-caption-lang"].forEach(id=>selectOptions($(id),LANGS));selectOptions($("cms-album"),ALBUMS);
function status(s){$("cms-state").textContent=s;}
function sync(){
  $("cms-publish").disabled=!dirty||busy||photoBusy||textDirty;
  $("cms-reload").disabled=busy||photoBusy;$("cms-logout").disabled=busy||photoBusy;
  $("cms-add-photo").disabled=busy||photoBusy;$("cms-apply-text").disabled=!selectedKey||busy||!textDirty;
  $("cms-app").setAttribute("aria-busy",String(busy||photoBusy));
  $("cms-texts").inert=busy;
  $("cms-gallery").inert=busy||photoBusy;
}
function changed(){dirty=true;status("Nezveřejněné změny. Po dokončení klikněte na Publikovat změny.");sync();}
async function call(method="GET",data){
  const r=await fetch(api+"/cms",{method,headers:{Authorization:"Bearer "+password,Accept:"application/json",...(data?{"Content-Type":"application/json"}:{})},cache:"no-store",credentials:"omit",redirect:"error",...(data?{body:JSON.stringify(data)}:{})});
  let x;try{x=await r.json();}catch(_){throw Error("API nevrátilo platnou odpověď (HTTP "+r.status+").");}
  if(!r.ok)throw Error(x.error||"HTTP "+r.status);return x;
}
async function init(){
  const r=await fetch("data/config.json",{cache:"no-store"});if(!r.ok)throw Error("Konfigurace nedostupná.");
  const c=await r.json();const u=new URL(c.bookingApi?.url);if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash)throw Error("Neplatná adresa API.");api=u.href.replace(/\/+$/,"");
}
function clearDraft(next){draft=clone(next);uploads.clear();dirty=false;textDirty=false;selectedKey="";$("cms-key").value="";$("cms-value").value="";$("cms-value").disabled=true;resetPriceEditor();status("Načtena aktuální verze z GitHubu.");sync();}
$("cms-login-form").addEventListener("submit",async e=>{
  e.preventDefault();if(busy)return;busy=true;const button=e.target.querySelector("button");button.disabled=true;$("cms-login-error").textContent="Ověřuji přístup…";
  try{if(!api)await init();password=$("cms-password").value.trim();const data=await call();clearDraft(data);$("cms-password").value="";$("cms-login").hidden=true;$("cms-app").hidden=false;loadPreview();renderGallery();}
  catch(e){password="";$("cms-login-error").textContent="Přihlášení selhalo: "+e.message;}
  finally{busy=false;button.disabled=false;sync();}
});
function confirmDiscard(){return (!dirty&&!textDirty)||confirm("Zahodit dosud nepublikované změny?");}
$("cms-reload").onclick=async()=>{if(busy||!confirmDiscard())return;busy=true;sync();try{clearDraft(await call());loadPreview();renderGallery();}catch(e){status(e.message);}finally{busy=false;sync();}};
$("cms-logout").onclick=()=>{if(!confirmDiscard())return;password="";draft=null;uploads.clear();dirty=false;textDirty=false;location.reload();};
window.addEventListener("beforeunload",e=>{if(dirty||textDirty){e.preventDefault();e.returnValue="";}});
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{if(busy)return;document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("on",x===b));$("cms-texts").hidden=b.dataset.tab!=="texts";$("cms-gallery").hidden=b.dataset.tab!=="gallery";if(b.dataset.tab==="gallery")renderGallery();});
function discardText(){if(!textDirty)return true;if(!confirm("Zahodit dosud nepoužitou úpravu textu?"))return false;textDirty=false;sync();return true;}
let page=$("cms-page").value;
$("cms-page").onchange=()=>{if(!discardText()){$("cms-page").value=page;return;}page=$("cms-page").value;selectedKey="";$("cms-value").disabled=true;$("cms-value").value="";resetPriceEditor();sync();loadPreview();};
function loadPreview(){$("cms-preview").src=page+"?cms=prices-3";}
function previewApply(){
  const w=$("cms-preview").contentWindow;if(!w||!draft)return;
  try{w.cmsPreview?.(draft.content,$("cms-lang").value);}catch(e){console.warn("Preview",e);}
}
function pageKeys(doc){
  const nodes=[...doc.querySelectorAll(editorSelector)];
  return [...new Set(nodes.map(nodeKey).filter(editableKey))];
}
function updateKeys(doc){
  const keys=pageKeys(doc);const current=selectedKey||$("cms-key").value;
  $("cms-key").replaceChildren(new Option("Vyberte text v náhledu",""),...keys.map(k=>new Option(priceKey(k)?PRICE_MONTHS[k.slice(6)]+" · cena za noc":(draft.content.cs[k]||k).slice(0,75)+" · "+k,k)));
  if(keys.includes(current))$("cms-key").value=current;
}
$("cms-preview").addEventListener("load",async()=>{
  if(!draft)return;
  let w,doc;
  try{w=$("cms-preview").contentWindow;doc=w.document;if(w.cmsContentReady)await w.cmsContentReady;}catch(_){return;}
  if(doc!==$("cms-preview").contentDocument||!draft)return;
  const style=doc.createElement("style");style.textContent=".cms-preview-edit [data-cms-editable]{outline:1px dashed #2f8f96;outline-offset:3px;cursor:text!important}.cms-preview-edit [data-cms-editable]:hover{outline:2px solid #2f8f96;background:rgba(47,143,150,.07)}";doc.head.append(style);
  const mark=()=>{if(!draft)return;doc.querySelectorAll(editorSelector).forEach(el=>{const k=nodeKey(el);if(editableKey(k)&&!["META","TITLE"].includes(el.tagName))el.dataset.cmsEditable=k;});updateKeys(doc);doc.documentElement.classList.toggle("cms-preview-edit",$("cms-edit-mode").checked);previewApply();};
  mark();
  const observer=new MutationObserver(mutations=>{if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.(".album-block")||n.querySelector?.("[data-album-title]")))))mark();});
  observer.observe(doc.body,{childList:true,subtree:true});
  doc.addEventListener("click",e=>{
    const el=e.target.closest("[data-cms-editable]");
    if($("cms-edit-mode").checked&&el){e.preventDefault();e.stopImmediatePropagation();chooseKey(el.dataset.cmsEditable);return;}
    const link=e.target.closest("a");if(link){e.preventDefault();e.stopImmediatePropagation();}
  },true);
});
$("cms-edit-mode").onchange=()=>{$("cms-preview").contentDocument?.documentElement.classList.toggle("cms-preview-edit",$("cms-edit-mode").checked);};
$("cms-lang").onchange=()=>{previewApply();};
function chooseKey(k){
  if(!editableKey(k))return;
  if(!discardText()){$("cms-key").value=selectedKey;return;}
  selectedKey=k;$("cms-key").value=k;$("cms-text-lang").value=$("cms-lang").value;loadText();$(priceKey(k)?"cms-price-value":"cms-value").focus();
}
$("cms-key").onchange=()=>{if($("cms-key").value)chooseKey($("cms-key").value);else $("cms-key").value=selectedKey;};
let textLang="cs";
function resetPriceEditor(){
  $("cms-editor-title").textContent="Editor obsahu";
  $("cms-text-lang-label").hidden=false;$("cms-value-label").hidden=false;
  $("cms-price-label").hidden=true;$("cms-price-value").disabled=true;$("cms-price-value").value="";
  $("cms-key-note").textContent="";
}
function loadText(){
  textLang=$("cms-text-lang").value;resetPriceEditor();
  const isPrice=priceKey(selectedKey);
  $("cms-value").disabled=!selectedKey||isPrice;
  if(isPrice){
    $("cms-editor-title").textContent="Editor ceny";
    $("cms-text-lang-label").hidden=true;$("cms-value-label").hidden=true;
    $("cms-price-label").hidden=false;$("cms-price-value").disabled=false;
    $("cms-price-value").value=draft.content.prices[selectedKey.slice(6)];
    $("cms-key-note").textContent=PRICE_MONTHS[selectedKey.slice(6)]+" · stejná cena pro všechny jazyky.";
  }else{
    $("cms-value").value=selectedKey?draft.content[textLang][selectedKey]||"":"";
    $("cms-key-note").textContent=selectedKey?"Klíč: "+selectedKey:"";
  }
  textDirty=false;sync();
}
$("cms-text-lang").onchange=()=>{if(!discardText()){$("cms-text-lang").value=textLang;return;}loadText();};
$("cms-value").oninput=()=>{textDirty=true;sync();};
$("cms-price-value").oninput=()=>{textDirty=true;sync();};
$("cms-apply-text").onclick=()=>{
  if(!selectedKey||!textDirty)return;
  if(priceKey(selectedKey)){
    const input=$("cms-price-value"),v=input.valueAsNumber;
    if(!input.value||!input.reportValidity()||!Number.isFinite(v)||v<=0||v>10000||Math.abs(v*100-Math.round(v*100))>1e-7){status("Zadejte platnou cenu v eurech (nejvýše dvě desetinná místa).");return;}
    draft.content.prices[selectedKey.slice(6)]=Math.round(v*100)/100;
  }else draft.content[textLang][selectedKey]=$("cms-value").value;
  textDirty=false;changed();previewApply();
};
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function button(label,fn,cls=""){const b=element("button",cls,label);b.type="button";b.onclick=()=>{if(!busy&&!photoBusy)fn();};return b;}
function renderGallery(){
 if(!draft)return;const album=$("cms-album").value,lang=$("cms-caption-lang").value,items=draft.photos[album],grid=$("cms-photo-grid");
 $("cms-gallery-count").textContent=items.length+" fotografií · "+items.filter(p=>!p.hidden).length+" viditelných · "+uploads.size+" nových v konceptu";
 grid.replaceChildren();
 items.forEach((p,index)=>{
  const card=element("article","cms-photo"+(p.hidden?" is-hidden":""));card.draggable=true;
  card.ondragstart=e=>{e.dataTransfer.setData("text/plain",String(index));e.dataTransfer.setData("application/x-filabau-photo",album);};
  card.ondragover=e=>{if(e.dataTransfer.types.includes("application/x-filabau-photo"))e.preventDefault();};
  card.ondrop=e=>{if(!e.dataTransfer.types.includes("application/x-filabau-photo"))return;e.preventDefault();e.stopPropagation();if(busy||photoBusy||e.dataTransfer.getData("application/x-filabau-photo")!==album)return;const from=Number(e.dataTransfer.getData("text/plain"));if(Number.isInteger(from)&&from>=0&&from<items.length&&from!==index){items.splice(index,0,items.splice(from,1)[0]);changed();renderGallery();}};
  const image=element("img");image.src=uploads.has(p.path)?"data:image/jpeg;base64,"+uploads.get(p.path):p.path;image.alt=p.caption;image.loading="lazy";card.append(image);
  const body=element("div","cms-photo-body"),meta=element("div","cms-photo-meta",(p.hidden?"Skryto · ":"")+p.path.split("/").pop());body.append(meta);
  const label=element("label","","Popisek · "+LANGS[lang]);const input=element("textarea");input.rows=3;input.maxLength=5000;input.value=lang==="cs"?p.caption:p.captions[lang]??"";input.placeholder=lang==="cs"?"Popisek fotografie":"Prázdné = použije český popisek";input.oninput=()=>{if(lang==="cs")p.caption=input.value;else if(input.value)p.captions[lang]=input.value;else delete p.captions[lang];changed();};label.append(input);body.append(label);
  const actions=element("div","cms-photo-actions");
  const move=delta=>{const n=index+delta;if(n<0||n>=items.length)return;[items[index],items[n]]=[items[n],items[index]];changed();renderGallery();};
  const up=button("↑",()=>move(-1));up.setAttribute("aria-label","Posunout výše");up.disabled=index===0;
  const down=button("↓",()=>move(1));down.setAttribute("aria-label","Posunout níže");down.disabled=index===items.length-1;
  const hide=button(p.hidden?"Zobrazit":"Skrýt",()=>{p.hidden=!p.hidden;changed();renderGallery();});
  const remove=button("Odebrat",()=>{if(!confirm("Odebrat fotografii z alba? Soubor zůstane na GitHubu."))return;items.splice(index,1);pruneUploads();changed();renderGallery();},"remove");
  const replace=button("Nahradit",()=>{const file=element("input");file.type="file";file.accept="image/jpeg,image/png,image/webp,image/avif";file.onchange=()=>{if(file.files[0])addFiles([file.files[0]],album,index);};file.click();});
  actions.append(up,down,hide,replace,remove);body.append(actions);
  const moveSelect=element("select");moveSelect.append(new Option("Přesunout do alba…",""),...Object.entries(ALBUMS).filter(([k])=>k!==album).map(([k,l])=>new Option(l,k)));moveSelect.onchange=()=>{const dest=moveSelect.value;if(!dest||busy||photoBusy)return;if(draft.photos[dest].some(x=>x.path===p.path)){alert("Tato fotografie již v cílovém albu existuje.");moveSelect.value="";return;}draft.photos[dest].push(items.splice(index,1)[0]);changed();renderGallery();};body.append(moveSelect);card.append(body);grid.append(card);
 });
}
function pruneUploads(){const used=new Set(Object.values(draft.photos).flat().map(p=>p.path));for(const k of uploads.keys())if(!used.has(k))uploads.delete(k);}
$("cms-album").onchange=renderGallery;$("cms-caption-lang").onchange=renderGallery;
$("cms-add-photo").onclick=()=>$("cms-files").click();$("cms-drop").onclick=()=>$("cms-files").click();$("cms-drop").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("cms-files").click();}};
$("cms-files").onchange=e=>{const files=[...e.target.files];e.target.value="";addFiles(files,$("cms-album").value);};
$("cms-drop").ondragover=e=>{e.preventDefault();$("cms-drop").classList.add("drag");};$("cms-drop").ondragleave=()=>$("cms-drop").classList.remove("drag");$("cms-drop").ondrop=e=>{e.preventDefault();$("cms-drop").classList.remove("drag");addFiles([...e.dataTransfer.files],$("cms-album").value);};
async function optimize(file){
 if(!/^image\/(jpeg|png|webp|avif)$/.test(file.type)||file.size>25000000)throw Error("Nepodporovaná nebo příliš velká fotografie: "+file.name);
 const src=URL.createObjectURL(file),img=new Image();
 try{img.src=src;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw Error("Neplatný obrázek.");
  const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");let max=1600;
  for(let i=0;i<5;i++){const ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   for(const quality of [.82,.72,.62,.52]){const result=canvas.toDataURL("image/jpeg",quality);if(result.startsWith("data:image/jpeg;base64,")&&result.length<560000)return result.split(",")[1];}
   max=Math.round(max*.75);
  }throw Error("Fotografii nelze optimalizovat.");
 }finally{URL.revokeObjectURL(src);}
}
async function addFiles(files,album,replaceIndex){
 if(busy||photoBusy||!draft||!files.length)return;
 if(uploads.size+files.length>6){status("Na jednu publikaci lze připravit nejvýše 6 nových fotografií.");return;}
 photoBusy=true;sync();status("Optimalizuji fotografie…");
 try{
  const prepared=[];for(const file of files){const base64=await optimize(file);const path="img/"+album+"/cms-"+crypto.randomUUID()+".jpg";prepared.push({path,base64});}
  for(const x of prepared){uploads.set(x.path,x.base64);if(replaceIndex!==undefined)draft.photos[album][replaceIndex].path=x.path;else draft.photos[album].push({path:x.path,caption:"",captions:{},hidden:false});}
  pruneUploads();changed();renderGallery();
 }catch(e){status("Fotografie nebyly přidány: "+e.message);}finally{photoBusy=false;sync();}
}
$("cms-publish").onclick=async()=>{
 if(!dirty||busy||photoBusy||textDirty)return;
 if(!confirm("Publikovat všechny připravené změny textů, cen a galerie na GitHub?"))return;
 busy=true;sync();status("Publikuji změny…");
 try{const result=await call("PUT",{revision:draft.revision,content:draft.content,photos:draft.photos,uploads:[...uploads].map(([path,base64])=>({path,base64}))});if(!result.published)throw Error("Zápis nebyl potvrzen.");draft.revision=result.revision;dirty=false;uploads.clear();status("Publikováno na GitHubu ("+result.commit.slice(0,7)+"). Veřejný web se aktualizuje po nasazení GitHub Pages.");renderGallery();}
 catch(e){status("Publikace nebyla potvrzena: "+e.message+" Koncept ponechán.");}
 finally{busy=false;sync();}
};
