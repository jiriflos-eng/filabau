// Run from repository root: node backend/import-backup.mjs https://worker.example backup.json
import {readFile} from "node:fs/promises";
import {createInterface} from "node:readline/promises";
import {Writable} from "node:stream";
const [rawURL,file]=process.argv.slice(2);
if(!rawURL||!file||!process.stdin.isTTY){console.error("Usage (interactive terminal): node backend/import-backup.mjs URL_WORKERU backup.json");process.exit(1);}
const url=new URL(rawURL);
if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash)throw Error("Use a trusted HTTPS Worker URL");
const base=url.href.replace(/\/+$/,"");
const data=JSON.parse(await readFile(file,"utf8"));
if(!data||!Array.isArray(data.stays)||data.privateData||!data.season||!data.years)throw Error("Use the private admin export, not the public encrypted GitHub JSON.");
console.log("Worker:",base);
console.log("Backup:",file,"Stays:",data.stays.length,"Pending:",data.stays.filter(s=>s.status==="pending").length);
const prompt=createInterface({input:process.stdin,output:process.stdout});
const answer=await prompt.question("Verify the backup and type IMPORT to initialize GitHub: ");prompt.close();
if(answer!=="IMPORT"){console.log("Cancelled.");process.exit(0);}
const muted=new Writable({write(_chunk,_encoding,callback){callback();}});
process.stderr.write("Admin password (hidden): ");
const secretPrompt=createInterface({input:process.stdin,output:muted,terminal:true});
const secret=await secretPrompt.question("");secretPrompt.close();process.stderr.write("\n");
if(!secret||secret.length<32)throw Error("Admin password must have at least 32 characters");
const headers={Authorization:"Bearer "+secret,Accept:"application/json"};
async function call(path,opts={}){
  const res=await fetch(base+path,{...opts,headers:{...headers,...opts.headers},redirect:"error",signal:AbortSignal.timeout(30000)});
  const body=await res.json();
  if(!res.ok)throw Error(body.error||"HTTP "+res.status);
  return body;
}
const current=await call("/admin");
if(current.data!==null)throw Error("Already initialized; use the administration for subsequent imports.");
if(!current.revision)throw Error("Cannot verify current GitHub SHA.");
const result=await call("/admin",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:current.revision,data})});
if(!result.revision||result.data?.stays?.length!==data.stays.length)throw Error("Import not confirmed. Check admin before retrying.");
const publicResponse=await fetch(base+"/calendar",{redirect:"error",signal:AbortSignal.timeout(30000)});
const publicData=await publicResponse.json();
if(!publicResponse.ok||publicData.stays?.length!==data.stays.length)throw Error("Import saved, but public calendar check failed.");
console.log("Imported and verified",publicData.stays.length,"stays. GitHub SHA:",result.revision);
