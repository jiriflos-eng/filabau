// Private, strongly consistent JSON calendar. No guest contact data in public responses.
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
function publicData(d){
  return {updatedAt:d.updatedAt,minNights:d.minNights,season:d.season,years:Object.fromEntries(Object.keys(d.years).filter(y=>/^\d{4}$/.test(y)).map(y=>[y,{filemon:{},baucis:{}}])),stays:d.stays.map(s=>({id:s.id,studio:s.studio,arrival:s.arrival,departure:s.departure,status:s.status==="pending"?"pending":"confirmed",name:""}))};
}
function inSeason(s,season){
  const y=s.arrival.slice(0,4),md=(m,d)=>String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  return s.arrival>=y+"-"+md(season.startMonth,season.startDay)&&s.departure<=y+"-"+md(season.endMonth,season.endDay);
}
function addPending(d,p){
  if(!p||!text(p.requestId,100)||!/^FB-[a-zA-Z0-9-]{10,95}$/.test(p.requestId)||!["email","whatsapp"].includes(p.channel)||!text(p.name,150)||!p.name.trim()||!text(p.email,254)||!/^\S+@\S+\.\S+$/.test(p.email)||!text(p.phone,60)||!p.phone.trim()||!text(p.message,5000)||!Array.isArray(p.stays)||p.stays.length<1||p.stays.length>2)return {error:"Invalid request",status:400};
  const existing=d.stays.filter(s=>s.requestId===p.requestId);
  if(existing.length){
    const same=existing.length===p.stays.length&&existing.every(s=>s.email===p.email.trim()&&s.phone===p.phone.trim()&&p.stays.some(x=>x&&x.studio===s.studio&&x.arrival===s.arrival&&x.departure===s.departure));
    return same?{existing:true}:{error:"Request ID conflict",status:409};
  }
  const today=new Date().toISOString().slice(0,10),maxYear=Number(today.slice(0,4))+2,seen=new Set(),createdAt=new Date().toISOString();
  const next=[];
  for(const x of p.stays){
    if(!x||!STUDIOS.includes(x.studio)||seen.has(x.studio)||!date(x.arrival)||!date(x.departure)||x.arrival<today||Number(x.departure.slice(0,4))>maxYear||nights(x.arrival,x.departure)<d.minNights||!inSeason(x,d.season))return {error:"Invalid dates",status:400};
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
export default {async fetch(req,env){
  const origin=req.headers.get("Origin"),url=new URL(req.url);
  const cors={"Access-Control-Allow-Origin":env.ALLOWED_ORIGIN,"Access-Control-Allow-Methods":"GET, POST, PUT, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization","Vary":"Origin","Cache-Control":"no-store"};
  const wrap=r=>new Response(r.body,{status:r.status,headers:{...Object.fromEntries(r.headers),...cors}});
  if(origin&&origin!==env.ALLOWED_ORIGIN)return fail("Origin denied",403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  try{
    const path=url.pathname;
    if(path==="/admin"){if(!await adminAllowed(req,env))return wrap(fail("Unauthorized",401));if(!["GET","PUT"].includes(req.method))return wrap(fail("Method",405));}
    else if(path==="/pending"&&req.method==="POST"){
      const p=await body(req);if(!await verifyCaptcha(p,env))return wrap(fail("Captcha verification failed",403));delete p.token;
      return wrap(await env.BOOKINGS.get(env.BOOKINGS.idFromName("calendar")).fetch("https://internal/pending",{method:"POST",body:JSON.stringify(p)}));
    }else if(path!=="/calendar"||req.method!=="GET")return wrap(fail("Not found",404));
    const opts={method:req.method};
    if(req.method==="PUT")opts.body=JSON.stringify(await body(req));
    return wrap(await env.BOOKINGS.get(env.BOOKINGS.idFromName("calendar")).fetch("https://internal"+path,opts));
  }catch(e){console.error("Booking API error",e.message);return wrap(fail("Request failed",500));}
}};
export class Bookings{
  constructor(ctx){this.ctx=ctx;this.sql=ctx.storage.sql;this.sql.exec("CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL)");}
  read(){const row=this.sql.exec("SELECT revision,data FROM state WHERE id=1").toArray()[0];return row?{revision:row.revision,data:JSON.parse(row.data)}:{revision:0,data:null};}
  write(revision,data){this.sql.exec("INSERT INTO state(id,revision,data) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data",revision,JSON.stringify(data));}
  async fetch(req){
    const path=new URL(req.url).pathname;
    if(req.method==="GET"){const r=this.read();return path==="/admin"?json(r):r.data?json(publicData(r.data)):fail("Calendar not initialized",503);}
    const p=await body(req);
    return this.ctx.storage.transactionSync(()=>{
      const r=this.read();
      if(path==="/admin"&&req.method==="PUT"){
        if(p.revision!==r.revision)return fail("Calendar changed; reload before saving",409);
        if(!validData(p.data))return fail("Invalid calendar or overlapping stays",400);
        p.data.updatedAt=new Date().toISOString();this.write(r.revision+1,p.data);return json({revision:r.revision+1,data:p.data});
      }
      if(path==="/pending"&&req.method==="POST"){
        if(!r.data)return fail("Calendar not initialized",503);
        const result=addPending(r.data,p);if(result.error)return fail(result.error,result.status);
        if(!result.existing)this.write(r.revision+1,r.data);
        return json({saved:true,calendar:publicData(r.data)});
      }
      return fail("Not found",404);
    });
  }
}
