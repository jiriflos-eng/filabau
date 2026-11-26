import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import worker from "./worker.js";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const env={ALLOWED_ORIGIN:"https://jiriflos-eng.github.io",TURNSTILE_HOSTNAME:"jiriflos-eng.github.io",GITHUB_REPOSITORY:"test/filabau",GITHUB_BRANCH:"main",GITHUB_TOKEN:"mock",ADMIN_TOKEN:"a".repeat(48),BOOKING_DATA_KEY:"ab".repeat(32),TURNSTILE_SECRET:"mock"};
const seed={updatedAt:"2026-01-01",minNights:5,season:{startMonth:4,startDay:30,endMonth:10,endDay:31},years:{},history:[],stays:[]};
let stored=structuredClone(seed),sha="old-sha",writes=0,forceConflict=false;
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(url,opts={})=>{
  if(String(url).includes("siteverify"))return Response.json({success:true,hostname:env.TURNSTILE_HOSTNAME,action:"booking"});
  assert.match(String(url),/api\.github\.com\/repos\/test\/filabau\/contents\/data\/bookings\.json/);
  if(opts.method==="PUT"){
    const body=JSON.parse(opts.body);
    if(forceConflict){forceConflict=false;sha="external-"+writes;return Response.json({message:"conflict"},{status:409});}
    if(body.sha!==sha)return Response.json({message:"conflict"},{status:409});
    stored=JSON.parse(Buffer.from(body.content,"base64").toString("utf8"));sha="sha-"+ ++writes;
    return Response.json({content:{sha}},{status:200});
  }
  return Response.json({type:"file",encoding:"base64",sha,content:Buffer.from(JSON.stringify(stored)).toString("base64")});
};
const call=(path,method="GET",body,admin=false,override={})=>worker.fetch(new Request("https://worker.example"+path,{method,headers:{Origin:env.ALLOWED_ORIGIN,...(admin?{Authorization:"Bearer "+env.ADMIN_TOKEN}:{}),...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})}),{...env,...override});
test("GitHub-backed booking lifecycle, authenticated encryption and SHA conflicts",async()=>{
 try{
  assert.equal((await call("/admin")).status,401);
  assert.equal((await call("/calendar")).status,503);
  let r=await (await call("/admin","GET",undefined,true)).json();
  assert.equal(r.data,null);
  const initialized=await call("/admin","PUT",{revision:r.revision,data:seed},true);assert.equal(initialized.status,200);
  assert.ok(stored.privateData.ciphertext);
  const year=new Date().getUTCFullYear()+1;
  const p={requestId:"FB-test-1234567890",channel:"email",name:"Soukromý host",email:"guest@example.invalid",phone:"+420 123",message:"Private message",token:"captcha",stays:[{studio:"filemon",arrival:year+"-07-01",departure:year+"-07-06"},{studio:"baucis",arrival:year+"-07-01",departure:year+"-07-06"}]};
  forceConflict=true;
  const saved=await call("/pending","POST",p);assert.equal(saved.status,200);assert.equal((await saved.json()).calendar.stays.length,2);
  assert.ok(stored.stays.every(s=>s.status==="pending"&&s.name===""));
  assert.ok(!JSON.stringify(stored).includes(p.email));assert.ok(!JSON.stringify(stored).includes(p.name));
  const count=writes;assert.equal((await call("/pending","POST",p)).status,200);assert.equal(writes,count);
  assert.equal((await call("/pending","POST",{...p,requestId:"FB-test-9876543210"})).status,409);
  const admin=await (await call("/admin","GET",undefined,true)).json();
  assert.equal(admin.data.stays[0].email,p.email);
  assert.equal((await call("/admin","PUT",{revision:"stale",data:admin.data},true)).status,409);
  admin.data.stays[0].status="confirmed";
  assert.equal((await call("/admin","PUT",admin,true)).status,200);
  assert.equal(stored.stays[0].status,"confirmed");
  assert.equal((await call("/calendar","GET",undefined,false,{BOOKING_DATA_KEY:"cd".repeat(32)})).status,503);
  const pub=await (await call("/calendar")).json();assert.ok(!pub.privateData);assert.ok(!pub.stays[0].email);
 }finally{globalThis.fetch=nativeFetch;}
});
