import {bookingToday,bookingCalendarSettings,bookingCalendarWindows,bookingEffectiveSeason,bookingWindowAllows} from "./calendar-range.js";
import {handleCMS} from "./cms.js";
// GitHub is the authoritative store; encrypted admin data and public availability commit atomically.
const STUDIOS=["filemon","baucis"];
const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const fail=(error,status=400)=>json({error},status);
const date=s=>typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
const overlap=(a,b)=>a.studio===b.studio&&a.arrival<b.departure&&b.arrival<a.departure;
const nights=(a,b)=>(Date.parse(b)-Date.parse(a))/86400000;
const text=(s,n)=>typeof s==="string"&&s.length<=n;
const validStay=s=>s&&text(s.id,200)&&s.id.length>0&&STUDIOS.includes(s.studio)&&date(s.arrival)&&date(s.departure)&&s.arrival<s.departure&&text(s.name,150)&&["pending","confirmed",undefined].includes(s.status);
function validData(d){
  if(!d||!Array.isArray(d.stays)||d.stays.length>5000||!d.season||!Number.isInteger(d.minNights)||d.minNights<1||d.minNights>366||!d.years||typeof d.years!=="object"||Array.isArray(d.years))return false;
  for(const k of ["startMonth","endMonth"])if(!Number.isInteger(d.season[k])||d.season[k]<1||d.season[k]>12)return false;
  for(const k of ["startDay","endDay"])if(!Number.isInteger(d.season[k])||d.season[k]<1||d.season[k]>31)return false;
  const ids=new Set();
  for(const s of d.stays){if(!validStay(s)||ids.has(s.id))return false;ids.add(s.id);}
  for(const studio of STUDIOS){const sorted=d.stays.filter(s=>s.studio===studio).sort((a,b)=>a.arrival.localeCompare(b.arrival));for(let i=1;i<sorted.length;i++)if(overlap(sorted[i-1],sorted[i]))return false;}
  return true;
}
// The stored public projection ALWAYS omits names. Only the live API may
// expose a short first-name label, based on trusted repository configuration.
function publicGuestName(s){
  const first=typeof s.name==="string"?s.name.trim().split(/\s+/u)[0]||"":"";
  return /^[\p{L}\p{M}][\p{L}\p{M}'’.-]{0,39}$/u.test(first)?first:"";
}
function publicData(d,displayMode="status"){
  return {updatedAt:d.updatedAt,minNights:d.minNights,season:d.season,years:Object.fromEntries(Object.keys(d.years).filter(y=>/^\d{4}$/.test(y)).map(y=>[y,{filemon:{},baucis:{}}])),stays:d.stays.map(s=>({id:s.id,studio:s.studio,arrival:s.arrival,departure:s.departure,status:s.status==="pending"?"pending":"confirmed",name:displayMode==="name"?publicGuestName(s):""}))};
}
async function readCalendarConfig(env){
  const url=gitEndpoint(env).replace(/bookings\.json$/,"config.json")+"?ref="+encodeURIComponent(env.GITHUB_BRANCH);
  const r=await fetch(url,{headers:{Authorization:"Bearer "+env.GITHUB_TOKEN,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"filabau-bookings","Cache-Control":"no-cache"}});
  if(!r.ok)throw Error("Calendar config unavailable");
  const file=await r.json();
  if(file.type!=="file"||file.encoding!=="base64"||typeof file.content!=="string")throw Error("Invalid calendar config");
  return JSON.parse(dec.decode(fromB64(file.content))).calendar||{};
}
async function calendarView(d,env,raw){
  // If config is temporarily unavailable, keep the original seasonal limits
  // and hide names; new bookings still require the live configuration.
  if(raw===undefined){try{raw=await readCalendarConfig(env);}catch(_){raw={};}}
  const mode=raw.displayMode==="name"?"name":"status";
  const settings=bookingCalendarSettings(raw,d.season);
  return {...publicData(d,mode),displayMode:mode,season:bookingEffectiveSeason(settings),calendarWindows:bookingCalendarWindows(settings),calendarSettings:settings};
}
function inSeason(s,season){
  const y=s.arrival.slice(0,4),md=(m,d)=>String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  return s.arrival>=y+"-"+md(season.startMonth,season.startDay)&&s.departure<=y+"-"+md(season.endMonth,season.endDay);
}
function addPending(d,p,calendarConfig={}){
  if(!p||!text(p.requestId,100)||!/^FB-[a-zA-Z0-9-]{10,95}$/.test(p.requestId)||!["email","whatsapp"].includes(p.channel)||!text(p.name,150)||!p.name.trim()||!text(p.email,254)||!/^\S+@\S+\.\S+$/.test(p.email)||!text(p.phone,60)||!p.phone.trim()||!text(p.message,5000)||!Array.isArray(p.stays)||p.stays.length<1||p.stays.length>2)return {error:"Invalid request",status:400};
  const existing=d.stays.filter(s=>s.requestId===p.requestId);
  if(existing.length){
    const same=existing.length===p.stays.length&&existing.every(s=>s.email===p.email.trim()&&s.phone===p.phone.trim()&&p.stays.some(x=>x&&x.studio===s.studio&&x.arrival===s.arrival&&x.departure===s.departure));
    return same?{existing:true}:{error:"Request ID conflict",status:409};
  }
  const today=bookingToday(),seen=new Set(),createdAt=new Date().toISOString();
  const settings=bookingCalendarSettings(calendarConfig,d.season);
  const windows=bookingCalendarWindows(settings,today);
  const season=bookingEffectiveSeason(settings);
  const next=[];
  for(const x of p.stays){
    if(!x||!STUDIOS.includes(x.studio)||seen.has(x.studio)||!date(x.arrival)||!date(x.departure)||!bookingWindowAllows(windows,x.arrival,x.departure,today)||nights(x.arrival,x.departure)<d.minNights||!inSeason(x,season))return {error:"Invalid dates",status:400};
    seen.add(x.studio);
    if(d.stays.some(s=>overlap(s,x)))return {error:"Dates no longer available",status:409};
    next.push({id:crypto.randomUUID(),studio:x.studio,arrival:x.arrival,departure:x.departure,name:p.name.trim(),email:p.email.trim(),phone:p.phone.trim(),message:p.message,channel:p.channel,requestId:p.requestId,status:"pending",createdAt});
  }
  if(d.stays.length+next.length>5000||d.stays.filter(s=>s.status==="pending"&&s.email?.toLowerCase()===p.email.toLowerCase()).length+next.length>4)return {error:"Too many pending requests",status:429};
  d.stays.push(...next);d.updatedAt=createdAt;
  return {saved:true};
}
async function body(req){const raw=await req.text();if(raw.length>2000000)throw Error("Too large");return JSON.parse(raw);}
async function adminAllowed(req,env){
  const given=req.headers.get("Authorization")||"",secret=env.ADMIN_TOKEN||"";
  if(secret.length<32||!given.startsWith("Bearer "))return false;
  const enc=new TextEncoder(),a=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(given.slice(7)))),b=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(secret)));let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
async function verifyCaptcha(p,env){
  if(!env.TURNSTILE_SECRET||!text(p?.token,2048)||!p.token)return false;
  const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:p.token})});
  const result=await r.json();return result.success===true&&result.hostname===env.TURNSTILE_HOSTNAME&&result.action==="booking";
}

// One GitHub Contents API file: public availability plus authenticated encrypted admin data.
// The private key NEVER enters the repository. The blob SHA is an optimistic concurrency token.
const enc=new TextEncoder(),dec=new TextDecoder();
function toB64(bytes){let s="";for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
function fromB64(s){return Uint8Array.from(atob(s.replace(/\s/g,"")),c=>c.charCodeAt(0));}
async function dataKey(env){
  const key=env.BOOKING_DATA_KEY||"";
  if(!/^[a-f0-9]{64}$/i.test(key))throw Error("BOOKING_DATA_KEY must be 32 random bytes in hex");
  return crypto.subtle.importKey("raw",Uint8Array.from(key.match(/../g),x=>parseInt(x,16)),{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
const aad=enc.encode("filabau-bookings-v1");
async function seal(d,env){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:aad},await dataKey(env),enc.encode(JSON.stringify(d)));
  return {version:1,iv:toB64(iv),ciphertext:toB64(new Uint8Array(ciphertext))};
}
async function unseal(blob,env){
  if(blob?.version!==1||typeof blob.iv!=="string"||typeof blob.ciphertext!=="string")throw Error("Invalid encrypted data");
  const iv=fromB64(blob.iv);if(iv.length!==12)throw Error("Invalid IV");
  const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:aad},await dataKey(env),fromB64(blob.ciphertext));
  const d=JSON.parse(dec.decode(clear));if(!validData(d))throw Error("Invalid stored calendar");return d;
}
function gitEndpoint(env){
  if(!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY||"")||!env.GITHUB_TOKEN||!env.GITHUB_BRANCH)throw Error("GitHub is not configured");
  return "https://api.github.com/repos/"+env.GITHUB_REPOSITORY+"/contents/data/bookings.json";
}
async function gitRequest(env,method="GET",body){
  const url=gitEndpoint(env)+(method==="GET"?"?ref="+encodeURIComponent(env.GITHUB_BRANCH):"");
  return fetch(url,{method,headers:{Authorization:"Bearer "+env.GITHUB_TOKEN,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"filabau-bookings","Content-Type":"application/json","Cache-Control":"no-cache"},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function readGit(env){
  const r=await gitRequest(env);
  if(!r.ok)throw Error("GitHub read HTTP "+r.status);
  const f=await r.json();
  if(f.type!=="file"||f.encoding!=="base64"||typeof f.sha!=="string"||typeof f.content!=="string")throw Error("Unexpected GitHub response");
  const stored=JSON.parse(dec.decode(fromB64(f.content)));
  if(!stored.privateData)return {revision:f.sha,data:null}; // Explicit admin migration; don't silently overwrite legacy data.
  const d=await unseal(stored.privateData,env);
  return {revision:f.sha,data:d};
}
async function writeGit(env,revision,d){
  if(!validData(d))throw Error("Invalid data");
  const stored={...publicData(d),privateData:await seal(d,env)};
  const bytes=enc.encode(JSON.stringify(stored,null,2)+"\n");
  if(bytes.length>850000)throw Error("Calendar exceeds GitHub JSON size limit; archive old stays");
  const r=await gitRequest(env,"PUT",{message:"Update booking calendar",content:toB64(bytes),sha:revision,branch:env.GITHUB_BRANCH});
  if(r.status===409||r.status===422){
    // A changed SHA is retryable; other validation failures are not.
    const latest=await readGit(env);if(latest.revision!==revision)return {conflict:true};
  }
  if(!r.ok)throw Error("GitHub write HTTP "+r.status);
  const result=await r.json();
  if(typeof result.content?.sha!=="string")throw Error("GitHub did not confirm blob SHA");
  return {revision:result.content.sha,data:d};
}
async function handle(req,env){
  const path=new URL(req.url).pathname;
  if(path==="/cms")return handleCMS(req,env,adminAllowed);
  if(path==="/calendar"&&req.method==="GET"){
    const r=await readGit(env);return r.data?json(await calendarView(r.data,env)):fail("Calendar not initialized",503);
  }
  if(path==="/admin"){
    if(!await adminAllowed(req,env))return fail("Unauthorized",401);
    if(req.method==="GET")return json(await readGit(env));
    if(req.method!=="PUT")return fail("Method",405);
    const p=await body(req),r=await readGit(env);
    if(p?.revision!==r.revision)return fail("Calendar changed; reload before saving",409);
    if(!validData(p.data))return fail("Invalid calendar or overlapping stays",400);
    p.data.updatedAt=new Date().toISOString();
    const written=await writeGit(env,r.revision,p.data);
    return written.conflict?fail("Calendar changed; reload before saving",409):json(written);
  }
  if(path==="/pending"&&req.method==="POST"){
    const p=await body(req);
    if(!await verifyCaptcha(p,env))return fail("Captcha verification failed",403);
    delete p.token;
    // Revalidate each retry against the latest GitHub file. Both studios are committed together.
    for(let attempt=0;attempt<4;attempt++){
      const r=await readGit(env);
      if(!r.data)return fail("Calendar not initialized",503);
      const calendarConfig=await readCalendarConfig(env);
      const result=addPending(r.data,p,calendarConfig);
      if(result.error)return fail(result.error,result.status);
      if(result.existing)return json({saved:true,calendar:await calendarView(r.data,env,calendarConfig)});
      const written=await writeGit(env,r.revision,r.data);
      if(!written.conflict)return json({saved:true,calendar:await calendarView(written.data,env,calendarConfig)});
    }
    return fail("Calendar changed repeatedly; retry",409);
  }
  return fail("Not found",404);
}
export default {async fetch(req,env){
  const origin=req.headers.get("Origin");
  const cors={"Access-Control-Allow-Origin":env.ALLOWED_ORIGIN,"Access-Control-Allow-Methods":"GET, POST, PUT, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization","Vary":"Origin","Cache-Control":"no-store"};
  const wrap=r=>new Response(r.body,{status:r.status,headers:{...Object.fromEntries(r.headers),...cors}});
  if(origin&&origin!==env.ALLOWED_ORIGIN)return fail("Origin denied",403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  try{return wrap(await handle(req,env));}
  catch(e){console.error("Booking API error",e.message);return wrap(fail("Request failed; storage unavailable",503));}
}};
