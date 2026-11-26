const ALBUM_META = {
  unas: { icon: "i-home", title: "gal_unas", lead: "gal_unas_lead" },
  pobliz: { icon: "i-near", title: "gal_pobliz", lead: "gal_pobliz_lead" },
  opodal: { icon: "i-far", title: "gal_opodal", lead: "gal_opodal_lead" },
  ruzne: { icon: "i-misc", title: "gal_ruzne", lead: "gal_ruzne_lead" },
  filemon: { icon: "i-sun", title: "Studio Filemon", lead: "gal_filemon_lead" },
  baucis: { icon: "i-sunset", title: "Studio Baucis", lead: "gal_baucis_lead" },
};

function normalizePhotos(files,folder) {
  return (Array.isArray(files)?files:[]).map(f=>{
    const p=typeof f==="string"?{file:f}:f;
    const path=p.path||("img/"+folder+"/"+p.file);
    const caption=p.captions?.[getLang()] ?? p.caption ?? "";
    return {src:path,caption:String(caption),hidden:p.hidden===true};
  }).filter(p=>!p.hidden&&/^img\/(?:unas|pobliz|opodal|ruzne|filemon|baucis)\/[A-Za-z0-9_.-]+\.(?:jpe?g|png|webp|avif)$/i.test(p.src));
}

function lightbox(items, start) {
  let i = start;
  const box = document.createElement("div");
  box.className = "lb";
  box.innerHTML = `<button type="button" aria-label="Zavřít">×</button>
    <button class="prev" type="button" aria-label="Předchozí">‹</button>
    <figure>
      <img alt="">
      <figcaption></figcaption>
    </figure>
    <button class="next" type="button" aria-label="Další">›</button>`;
  const img = box.querySelector("img");
  const cap = box.querySelector("figcaption");
  const show = () => {
    img.src = items[i].src;
    img.alt = items[i].caption || "";
    cap.textContent = items[i].caption || "";
    cap.style.display = items[i].caption ? "" : "none";
  };
  show();
  const close = () => box.remove();
  box.querySelector("button").onclick = close;
  box.querySelector(".prev").onclick = (e) => { e.stopPropagation(); i = (i - 1 + items.length) % items.length; show(); };
  box.querySelector(".next").onclick = (e) => { e.stopPropagation(); i = (i + 1) % items.length; show(); };
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  document.addEventListener("keydown", function onKey(e) {
    if (!document.body.contains(box)) return document.removeEventListener("keydown", onKey);
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") box.querySelector(".prev").click();
    if (e.key === "ArrowRight") box.querySelector(".next").click();
  });
  document.body.append(box);
}

function renderAlbum(el, key, files, folder) {
  const meta = ALBUM_META[key];
  const items = normalizePhotos(files,folder||key);
  const block=document.createElement("section");block.className="album-block";block.dataset.album=key;
  const heading=document.createElement("h2");heading.className="with-ico";
  if(meta.icon){const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("class","h-ico");svg.setAttribute("aria-hidden","true");const use=document.createElementNS("http://www.w3.org/2000/svg","use");use.setAttribute("href","#"+meta.icon);svg.append(use);heading.append(svg);}
  const title=document.createElement("span");title.dataset.albumTitle=meta.title;title.textContent=t(meta.title);heading.append(title);
  const lead=document.createElement("p");lead.className="muted";lead.style.maxWidth="46rem";lead.dataset.albumLead=meta.lead;lead.textContent=t(meta.lead);
  const grid=document.createElement("div");grid.className="ggrid";block.append(heading,lead,grid);
  items.forEach((item,idx)=>{
    const fig=document.createElement("figure");fig.className="gitem";
    const img=document.createElement("img");img.src=item.src;img.alt=item.caption||t(meta.title);img.loading="lazy";fig.append(img);
    if(item.caption){const caption=document.createElement("figcaption");caption.textContent=item.caption;fig.append(caption);}
    fig.addEventListener("click",()=>lightbox(items,idx));grid.append(fig);
  });
  el.append(block);
}

async function mountGalleries(targetId, keys) {
  if(typeof cmsContentReady!=="undefined") await cmsContentReady;
  const res=await fetch("data/photos.json",{cache:"no-store"});
  if(!res.ok) throw Error("Galerii nelze načíst");
  const data=await res.json();
  const el = document.getElementById(targetId);
  keys.forEach((k) => renderAlbum(el, k, data[k], k));
}
