// Public CMS content. Existing bundled translations remain a safe fallback.
let cmsPublicContent = null;
let cmsPreviewLanguage = null;
const cmsOriginalT = t;
t = function(key, vars) {
  const lang = cmsPreviewLanguage || getLang();
  let value = cmsPublicContent?.[lang]?.[key] ?? I18N[lang]?.[key] ?? I18N.cs[key];
  if (typeof value !== "string") return cmsOriginalT(key, vars);
  if(vars) for(const [k,v] of Object.entries(vars)) value=value.replaceAll("{"+k+"}",String(v));
  return value;
};
const cmsContentReady = fetch("data/content.json",{cache:"no-store"}).then(r=>{
  if(!r.ok) throw Error("Content unavailable");
  return r.json();
}).then(data=>{cmsPublicContent=data;}).catch(e=>console.warn("CMS content fallback",e));
function cmsApplyContent(){
  applyI18n();
  if(cmsPreviewLanguage) document.documentElement.lang=cmsPreviewLanguage;
  document.querySelectorAll("[data-cms-key]").forEach(el=>{el.textContent=t(el.dataset.cmsKey);});
  document.querySelectorAll("[data-cms-meta]").forEach(el=>{el.content=t(el.dataset.cmsMeta);});
}
window.cmsPreview = function(data,lang){
  cmsPublicContent=data;
  cmsPreviewLanguage=lang;
  cmsApplyContent();
  // Gallery titles are built asynchronously; update their existing text nodes.
  document.querySelectorAll("[data-album-title],[data-album-lead]").forEach(el=>{el.textContent=t(el.dataset.albumTitle||el.dataset.albumLead);});
};
document.addEventListener("DOMContentLoaded",()=>{cmsContentReady.then(cmsApplyContent);});
