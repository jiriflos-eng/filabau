// Empty endpoint = legacy local mode. Never store the admin password in localStorage.
let bookingSettings=null, bookingSettingsPromise, bookingAdminToken="", bookingRevision=null;
let bookingCaptchaToken="", bookingWidget=null;
function loadBookingSettings(){
  if(!bookingSettingsPromise) bookingSettingsPromise=(async()=>{
    const res=await fetch("data/config.json",{cache:"no-store"});
    if(!res.ok)throw Error("Config HTTP "+res.status);
    const raw=(await res.json()).bookingApi||{};
    if(!raw.url)return bookingSettings={url:"",turnstileSiteKey:""};
    const u=new URL(raw.url);
    if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||!raw.turnstileSiteKey)throw Error("Invalid booking API configuration");
    return bookingSettings={url:u.href.replace(/\/+$/,""),turnstileSiteKey:raw.turnstileSiteKey};
  })();
  return bookingSettingsPromise;
}
function centralBookings(){return Boolean(bookingSettings?.url);}
async function bookingCall(path,method="GET",body,admin=false){
  const headers={Accept:"application/json"};
  if(body!==undefined)headers["Content-Type"]="application/json";
  if(admin)headers.Authorization="Bearer "+bookingAdminToken;
  const res=await fetch(bookingSettings.url+path,{method,headers,credentials:"omit",cache:"no-store",...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await res.json();
  if(!res.ok){const e=Error(result.error||"HTTP "+res.status);e.status=res.status;throw e;}
  return result;
}
async function readCentralAdmin(){const r=await bookingCall("/admin","GET",undefined,true);bookingRevision=r.revision;return r.data;}
async function writeCentralAdmin(data){const r=await bookingCall("/admin","PUT",{revision:bookingRevision,data},true);bookingRevision=r.revision;return r.data;}
function initBookingCaptcha(onChange){
  if(!centralBookings())return;
  const box=document.getElementById("booking-captcha");box.hidden=false;
  const script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.async=true;
  script.onload=()=>{bookingWidget=turnstile.render(box,{sitekey:bookingSettings.turnstileSiteKey,action:"booking",callback:token=>{bookingCaptchaToken=token;onChange();},"expired-callback":()=>{bookingCaptchaToken="";onChange();},"error-callback":()=>{bookingCaptchaToken="";onChange();}});};
  script.onerror=()=>{bookingCaptchaToken="";onChange();};
  document.head.append(script);
}
function resetBookingCaptcha(){bookingCaptchaToken="";if(bookingWidget!==null&&globalThis.turnstile)turnstile.reset(bookingWidget);}
