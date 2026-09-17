const ALBUM_META = {
  unas: {
    title: "U nás",
    lead: "Cestou k pláži Santa Barbara minete tavernu Maltas, Elia a Barbados. Na Marathias je organizovaná část s lehátky, sprchou a bary — i dlouhá liduprázdná pláž pod útesem. Písek, pozvolný vstup, průzračná voda. Moře bývá klidné, ale umí se i zlobit.",
  },
  pobliz: {
    title: "Poblíž",
    lead: "Cesta na pláž přes útes, jižní Agios Georgios (krámky, bary, taverny, půjčovny), pláž Issos na okraji pouště, Megas Choros, pláž Notos a rybářská vesnice Petriti, Argirades, rezervace Alikes, Kanoula, Lefkimi, Gardenos, Chlomos.",
  },
  opodal: {
    title: "Opodál",
    lead: "Kerkyra — hlavní město ostrova. Achillion, letní sídlo císařovny Sisi. Restaurace Archontiko, Moraitika, Paleokastritsa, pláž Timoni, mys Drastis, Canal d’Amour, Pantokrator, Angelokastro, Kaiser Throne, Agios Simeon, Agios Gordis, ostrov Paxos, Peroulades.",
  },
  ruzne: {
    title: "Různé",
    lead: "Velikonoce: Květná neděle s procesím sv. Spyridona a dechovkami. Na Bílou sobotu v 11 hodin lidé vyhazují z oken keramické nádoby s vodou — ulice jsou plné střepů, úlomky si někteří schovávají pro štěstí. Masopust v Lefkimmi, jaro a podzim na Korfu.",
  },
  filemon: {
    title: "Studio Filemon",
    lead: "Východní strana domu, větší terasa, velmi příjemný odpolední stín.",
  },
  baucis: {
    title: "Studio Baucis",
    lead: "Západní strana domu, menší terasa s výhledem na olivové háje a zapadající slunce.",
  },
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
  block.innerHTML = `<h2>${meta.title}</h2><p class="muted" style="max-width:46rem">${meta.lead}</p><div class="ggrid"></div>`;
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
