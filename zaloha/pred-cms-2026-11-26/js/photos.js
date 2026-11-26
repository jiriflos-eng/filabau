const ALBUM_META = {
  unas: { icon: "i-home", title: "gal_unas", lead: "gal_unas_lead" },
  pobliz: { icon: "i-near", title: "gal_pobliz", lead: "gal_pobliz_lead" },
  opodal: { icon: "i-far", title: "gal_opodal", lead: "gal_opodal_lead" },
  ruzne: { icon: "i-misc", title: "gal_ruzne", lead: "gal_ruzne_lead" },
  filemon: { icon: "i-sun", title: "Studio Filemon", lead: "gal_filemon_lead" },
  baucis: { icon: "i-sunset", title: "Studio Baucis", lead: "gal_baucis_lead" },
};

function normalizePhotos(files) {
  return files.map((f) =>
    typeof f === "string" ? { file: f, caption: "" } : { file: f.file, caption: f.caption || "" }
  );
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
  const photos = normalizePhotos(files);
  const items = photos.map((p) => ({
    src: `img/${folder || key}/${p.file}`,
    caption: p.caption,
  }));
  const block = document.createElement("section");
  block.className = "album-block";
  block.dataset.album = key;
  const icon = meta.icon ? `<svg class="h-ico" aria-hidden="true"><use href="#${meta.icon}"></use></svg>` : "";
  const title = t(meta.title);
  const lead = t(meta.lead);
  block.innerHTML = `<h2 class="with-ico">${icon}${title}</h2><p class="muted" style="max-width:46rem">${lead}</p><div class="ggrid"></div>`;
  const grid = block.querySelector(".ggrid");
  items.forEach((item, idx) => {
    const fig = document.createElement("figure");
    fig.className = "gitem";
    fig.innerHTML = `<img src="${item.src}" alt="${item.caption || meta.title}" loading="lazy">${item.caption ? `<figcaption>${item.caption}</figcaption>` : ""}`;
    fig.addEventListener("click", () => lightbox(items, idx));
    grid.append(fig);
  });
  el.append(block);
}

async function mountGalleries(targetId, keys) {
  const data = await fetch("data/photos.json").then((r) => r.json());
  const el = document.getElementById(targetId);
  keys.forEach((k) => renderAlbum(el, k, data[k], k));
}
