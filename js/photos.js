const ALBUM_META = {
  unas: { title: "U nás", lead: "Taverny cestou na pláž, Santa Barbara / Marathias, dům a okolí." },
  pobliz: { title: "Poblíž", lead: "Cesta na pláž přes útes, Agios Georgios, Issos, Petriti, Lefkimmi." },
  opodal: { title: "Opodál", lead: "Kerkyra, Achillion, Paleokastritsa, Pantokrator, Paxos a další výlety." },
  ruzne: { title: "Různé", lead: "Velikonoce, masopust v Lefkimmi, jaro a podzim na Korfu." },
  filemon: { title: "Studio Filemon", lead: "Východní strana, větší terasa, odpolední stín." },
  baucis: { title: "Studio Baucis", lead: "Západní strana, menší terasa, olivové háje a západ slunce." },
};

function lightbox(urls, start) {
  let i = start;
  const box = document.createElement("div");
  box.className = "lb";
  box.innerHTML = `<button type="button" aria-label="Zavřít">×</button>
    <button class="prev" type="button" aria-label="Předchozí">‹</button>
    <img alt="">
    <button class="next" type="button" aria-label="Další">›</button>`;
  const img = box.querySelector("img");
  const show = () => { img.src = urls[i]; };
  show();
  const close = () => box.remove();
  box.querySelector("button").onclick = close;
  box.querySelector(".prev").onclick = (e) => { e.stopPropagation(); i = (i - 1 + urls.length) % urls.length; show(); };
  box.querySelector(".next").onclick = (e) => { e.stopPropagation(); i = (i + 1) % urls.length; show(); };
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
  const urls = files.map((f) => `img/${folder || key}/${f}`);
  const block = document.createElement("section");
  block.className = "album-block";
  block.dataset.album = key;
  block.innerHTML = `<h2>${meta.title}</h2><p class="muted">${meta.lead}</p><div class="ggrid"></div>`;
  const grid = block.querySelector(".ggrid");
  urls.forEach((src, idx) => {
    const im = document.createElement("img");
    im.src = src;
    im.alt = meta.title;
    im.loading = "lazy";
    im.addEventListener("click", () => lightbox(urls, idx));
    grid.append(im);
  });
  el.append(block);
}

async function mountGalleries(targetId, keys) {
  const data = await fetch("data/photos.json").then((r) => r.json());
  const el = document.getElementById(targetId);
  keys.forEach((k) => renderAlbum(el, k, data[k], k));
}
