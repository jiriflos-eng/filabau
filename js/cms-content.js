// Public CMS content. Existing bundled translations remain a safe fallback.
let cmsPublicContent = null;
let cmsPreviewLanguage = null;
const cmsOriginalT = t;
t = function(key, vars) {
  const lang = cmsPreviewLanguage || getLang();
  let value = cmsPublicContent?.[lang]?.[key] ?? I18N[lang]?.[key] ?? I18N.cs[key] ?? ({fact_beach_value:'650 m',fact_size_value:'23 m²',fact_tavern_value:'80 m'})[key];
  if (typeof value !== "string") return cmsOriginalT(key, vars);
  if(vars) for(const [k,v] of Object.entries(vars)) value=value.replaceAll("{"+k+"}",String(v));
  return value;
};
const cmsContentReady = fetch("data/content.json",{cache:"no-store"}).then(r=>{
  if(!r.ok) throw Error("Content unavailable");
  return r.json();
}).then(data=>{cmsPublicContent=data;}).catch(e=>console.warn("CMS content fallback",e));
window.cmsContentReady=cmsContentReady;
function cmsPriceValues(data) {
  const defaults={may:45,jun:50,jul:55,aug:55,sep:50,oct:45};
  return Object.fromEntries(Object.entries(defaults).map(([key,fallback])=>{
    const v=data?.prices?.[key];
    return [key,typeof v==="number"&&Number.isFinite(v)&&v>0&&v<=10000?v:fallback];
  }));
}
function cmsApplyPrices(){
  const prices=cmsPriceValues(cmsPublicContent);
  const fmt=new Intl.NumberFormat(cmsPreviewLanguage||getLang(),{maximumFractionDigits:2});
  document.querySelectorAll("[data-cms-price]").forEach(el=>{
    const value=prices[el.dataset.cmsPrice];
    if(value!==undefined)el.textContent=fmt.format(value);
  });
  const min=Math.min(...Object.values(prices)),max=Math.max(...Object.values(prices));
  document.querySelectorAll("[data-cms-price-range]").forEach(el=>{
    el.textContent=(min===max?fmt.format(min):fmt.format(min)+"–"+fmt.format(max))+" €";
  });
}
function cmsApplyContent(){
  applyI18n();
  cmsApplyPrices();
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
  const navKeys={"index.html":"nav_home","studia.html":"nav_studios","cenik.html":"nav_prices","jak-k-nam.html":"nav_howto","info.html":"nav_info","galerie.html":"nav_gallery","rezervace.html":"nav_book"};
  document.querySelectorAll("[data-nav] a").forEach(a=>{const k=navKeys[a.getAttribute("href")];if(k)a.textContent=t(k);});
};
document.addEventListener("DOMContentLoaded",()=>{cmsContentReady.then(cmsApplyContent);});
