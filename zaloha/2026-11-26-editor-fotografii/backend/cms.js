// CMS writes only allowlisted content, gallery metadata and new JPEGs.
const ALBUMS=["unas","pobliz","opodal","ruzne","filemon","baucis"], LANGS=["cs","en","de","fr","it","es","pl"];
const SAFE_IMG=/^img\/(?:unas|pobliz|opodal|ruzne|filemon|baucis)\/[A-Za-z0-9_.-]+\.(?:jpe?g|png|webp|avif)$/i;
const NEW_IMG=/^img\/(?:unas|pobliz|opodal|ruzne|filemon|baucis)\/cms-[a-f0-9-]{36}\.jpg$/;
const out=(d,status=200)=>Response.json(d,{status,headers:{"Cache-Control":"no-store"}});
const fail=(s,status=400)=>out({error:s},status);
const str=(s,n)=>typeof s==="string"&&s.length<=n;
function sameKeys(a,b){return a&&typeof a==="object"&&!Array.isArray(a)&&Object.keys(a).length===b.length&&b.every(k=>Object.hasOwn(a,k));}
async function gh(env,path,method="GET",body){
  if(!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY||"")||!env.GITHUB_TOKEN)throw Error("GitHub configuration");
  const r=await fetch("https://api.github.com/repos/"+env.GITHUB_REPOSITORY+path,{method,headers:{Authorization:"Bearer "+env.GITHUB_TOKEN,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"filabau-cms","Content-Type":"application/json","Cache-Control":"no-cache"},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await r.json();if(!r.ok){const e=Error("GitHub HTTP "+r.status);e.status=r.status;throw e;}return data;
}
async function fileAt(env,path,ref){
  const r=await gh(env,"/contents/"+path+"?ref="+encodeURIComponent(ref));
  if(r.type!=="file"||r.encoding!=="base64"||!r.sha)throw Error("Invalid CMS file");
  return {sha:r.sha,data:JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(r.content.replace(/\s/g,"")),c=>c.charCodeAt(0))))};
}
async function snapshot(env){
  const ref=await gh(env,"/git/ref/heads/"+encodeURIComponent(env.GITHUB_BRANCH));
  const head=ref.object.sha;
  const [commit,content,photos]=await Promise.all([gh(env,"/git/commits/"+head),fileAt(env,"data/content.json",head),fileAt(env,"data/photos.json",head)]);
  return {head,tree:commit.tree.sha,content,photos};
}
function normalizedPhotos(data){
  return Object.fromEntries(ALBUMS.map(k=>[k,(data[k]||[]).map(x=>{
    const p=typeof x==="string"?{file:x}:x;
    return {path:p.path||("img/"+k+"/"+p.file),caption:p.caption||"",captions:p.captions||{},hidden:p.hidden===true};
  })]));
}
function validContent(next,old){
  // Shared numeric prices are part of the same revision as translations.
  const priceKeys=["may","jun","jul","aug","sep","oct"];
  const hasPrices=Object.hasOwn(old,"prices");
  if(!sameKeys(next,hasPrices?[...LANGS,"prices"]:LANGS))return false;
  for(const l of LANGS){if(!sameKeys(next[l],Object.keys(old[l])))return false;for(const v of Object.values(next[l]))if(!str(v,10000))return false;}
  if(hasPrices){
    if(!sameKeys(next.prices,priceKeys))return false;
    for(const v of Object.values(next.prices))if(typeof v!=="number"||!Number.isFinite(v)||v<=0||v>10000||Math.abs(v*100-Math.round(v*100))>1e-7)return false;
  }
  return true;
}
function validatePhotos(next,uploads,existing){
  if(!sameKeys(next,ALBUMS)||!Array.isArray(uploads)||uploads.length>6)return "Neplatná struktura galerie nebo příliš mnoho nových fotek.";
  const added=new Set();
  for(const u of uploads){
    if(!u||!NEW_IMG.test(u.path)||existing.has(u.path)||added.has(u.path)||!str(u.base64,600000))return "Neplatný nový soubor.";
    let b;try{b=atob(u.base64);}catch(_){return "Neplatná data obrázku.";}
    if(b.length<4||b.length>420000||b.charCodeAt(0)!==255||b.charCodeAt(1)!==216||b.charCodeAt(b.length-2)!==255||b.charCodeAt(b.length-1)!==217)return "Povoleny jsou optimalizované JPEG fotografie do 420 kB.";
    added.add(u.path);
  }
  let count=0;const used=new Set();
  for(const album of ALBUMS){
    if(!Array.isArray(next[album]))return "Neplatné album.";
    const seen=new Set();
    for(const p of next[album]){
      count++;
      if(!sameKeys(p,["path","caption","captions","hidden"])||!SAFE_IMG.test(p.path)||seen.has(p.path)||(!existing.has(p.path)&&!added.has(p.path))||!str(p.caption,5000)||typeof p.hidden!=="boolean"||!p.captions||typeof p.captions!=="object"||Array.isArray(p.captions)||Object.entries(p.captions).some(([k,v])=>!LANGS.includes(k)||!str(v,5000)))return "Neplatná fotografie nebo popisek.";
      seen.add(p.path);used.add(p.path);
    }
  }
  if(count>1000||[...added].some(p=>!used.has(p)))return "Příliš mnoho fotografií nebo nepoužitý soubor.";
  return null;
}
async function publish(env,p){
  if(!p||!p.revision||!Array.isArray(p.uploads))return fail("Neplatný požadavek.");
  for(let attempt=0;attempt<4;attempt++){
    const s=await snapshot(env);
    if(p.revision.content!==s.content.sha||p.revision.photos!==s.photos.sha)return fail("Obsah mezitím změnil jiný správce. Načtěte aktuální verzi.",409);
    if(!validContent(p.content,s.content.data))return fail("Neplatné texty nebo překlady.");
    const tr=await gh(env,"/git/trees/"+s.tree+"?recursive=1");
    if(tr.truncated)throw Error("Repository tree too large");
    const existing=new Set(tr.tree.filter(x=>x.type==="blob"&&SAFE_IMG.test(x.path)).map(x=>x.path));
    const err=validatePhotos(p.photos,p.uploads,existing);if(err)return fail(err);
    const entries=[{path:"data/content.json",mode:"100644",type:"blob",content:JSON.stringify(p.content,null,2)+"\n"},{path:"data/photos.json",mode:"100644",type:"blob",content:JSON.stringify(p.photos,null,2)+"\n"}];
    for(const u of p.uploads){const blob=await gh(env,"/git/blobs","POST",{content:u.base64,encoding:"base64"});entries.push({path:u.path,mode:"100644",type:"blob",sha:blob.sha});}
    const tree=await gh(env,"/git/trees","POST",{base_tree:s.tree,tree:entries});
    const commit=await gh(env,"/git/commits","POST",{message:"Publish editorial content and gallery",tree:tree.sha,parents:[s.head]});
    try{await gh(env,"/git/refs/heads/"+encodeURIComponent(env.GITHUB_BRANCH),"PATCH",{sha:commit.sha,force:false});}
    catch(e){if([409,422].includes(e.status))continue;throw e;}
    const fresh=await snapshot(env);
    if(JSON.stringify(fresh.content.data)!==JSON.stringify(p.content)||JSON.stringify(normalizedPhotos(fresh.photos.data))!==JSON.stringify(p.photos))return fail("Publikováno, ale následovala další změna. Načtěte znovu.",409);
    return out({published:true,commit:commit.sha,revision:{content:fresh.content.sha,photos:fresh.photos.sha}});
  }
  return fail("Repozitář se opakovaně mění. Zkuste publikaci znovu.",409);
}
export async function handleCMS(req,env,adminAllowed){
  if(!await adminAllowed(req,env))return fail("Unauthorized",401);
  if(req.method==="GET"){const s=await snapshot(env);return out({content:s.content.data,photos:normalizedPhotos(s.photos.data),revision:{content:s.content.sha,photos:s.photos.sha}});}
  if(req.method==="PUT"){
    const raw=await req.text();if(raw.length>4500000)return fail("Příliš velká dávka změn.",413);
    let p;try{p=JSON.parse(raw);}catch(_){return fail("Neplatný JSON.");}
    return publish(env,p);
  }
  return fail("Method not allowed",405);
}
