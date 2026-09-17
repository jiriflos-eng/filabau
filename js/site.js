function initIcons() {
  if (document.getElementById("icon-sprite")) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = `<svg id="icon-sprite" xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></symbol>
    <symbol id="i-plane" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></symbol>
    <symbol id="i-car" viewBox="0 0 24 24"><path d="M18.9 6C18.7 5.4 18.2 5 17.5 5h-11c-.7 0-1.2.4-1.4 1L3 12v8h2v-1h14v1h2v-8l-2.1-6zM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM5 11l1.5-4.5h11L19 11H5z"/></symbol>
    <symbol id="i-trips" viewBox="0 0 24 24"><path d="M14 6V4h-4v2H4v15h16V6h-6zM10 4h4v2h-4V4zM8 10h8v2H8v-2z"/></symbol>
    <symbol id="i-info" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></symbol>
    <symbol id="i-sos" viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></symbol>
    <symbol id="i-embassy" viewBox="0 0 24 24"><path d="M6.5 10h3v7h-3v-7zm8 0h3v7h-3v-7zM2 19h20v3H2v-3zM12 1 2 6v2h20V6L12 1z"/></symbol>
    <symbol id="i-bed" viewBox="0 0 24 24"><path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7 4 8.34 4 10s1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v2h2v-2h14v2h2v-2h2V7h-2z"/></symbol>
    <symbol id="i-transfer" viewBox="0 0 24 24"><path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM6 6h12v4H6V6z"/></symbol>
    <symbol id="i-home" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></symbol>
    <symbol id="i-near" viewBox="0 0 24 24"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></symbol>
    <symbol id="i-far" viewBox="0 0 24 24"><path d="m14 6-3.8 3.8-2.4-2.4L2 13.2l1.4 1.4 4.4-4.4 2.4 2.4L14 9l6.6 6.6L22 14 14 6z"/></symbol>
    <symbol id="i-misc" viewBox="0 0 24 24"><path d="M12 17.3 18.2 21l-1.6-7L22 9.2l-7.2-.6L12 2 9.2 8.6 2 9.2 7.4 14 5.8 21z"/></symbol>
    <symbol id="i-sun" viewBox="0 0 24 24"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2V1zm0 19h2v3h-2v-3zM3.5 4.9 5 3.5 7.1 5.6 5.6 7 3.5 4.9zm13.4 13.4 1.4-1.4 2.1 2.1-1.4 1.4-2.1-2.1zM1 11h3v2H1v-2zm19 0h3v2h-3v-2zM3.5 19.1 5.6 17 7 18.4 4.9 20.5 3.5 19.1zm13.4-13.4L18.4 4 20.5 6.1 19.1 7.5 16.9 5.7z"/></symbol>
    <symbol id="i-sunset" viewBox="0 0 24 24"><path d="M12 7.5a5 5 0 0 1 5 5H7a5 5 0 0 1 5-5zM2 18h20v2H2v-2zM11 1h2v3h-2V1zM4.2 5.6 5.6 4.2 7.8 6.4 6.4 7.8 4.2 5.6zm12 1.8 2.1-2.2 1.4 1.4-2.1 2.2-1.4-1.4z"/></symbol>
  </svg>`;
  document.body.prepend(wrap.firstElementChild);
}

function ico(id) {
  return `<svg class="h-ico" aria-hidden="true"><use href="#${id}"></use></svg>`;
}

function initNav() {
  const links = document.querySelector("[data-nav]");
  if (links) {
    links.innerHTML = `
      <a href="index.html">${t("nav_home")}</a>
      <a href="studia.html">${t("nav_studios")}</a>
      <a href="cenik.html">${t("nav_prices")}</a>
      <a href="jak-k-nam.html">${t("nav_howto")}</a>
      <a href="info.html">${t("nav_info")}</a>
      <a href="galerie.html">${t("nav_gallery")}</a>
      <a class="btn btn-gold" href="rezervace.html">${t("nav_book")}</a>
      ${langSelectHtml()}`;
    links.querySelector(".lang-select")?.addEventListener("change", (e) => setLang(e.target.value));
  }
  const nav = document.querySelector(".nav");
  const btn = document.querySelector(".menu-btn");
  if (!nav) return;
  const onScroll = () => nav.classList.toggle("solid", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  btn?.addEventListener("click", () => nav.classList.toggle("open"));
}

function brandSvg() {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#123a46"/><circle cx="32" cy="26" r="10" fill="#e8c872"/><path d="M18 46c6-10 10-10 14-4 4-8 10-8 14 2 0 0-8 10-14 10S18 46 18 46z" fill="#7d9a5a"/></svg>`;
}

function initScrollStory() {
  const bg = document.querySelector(".hero-bg");
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => e.target.classList.toggle("is-on", e.isIntersecting));
      },
      { threshold: 0.45, rootMargin: "-12% 0px -12% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  }
  const hero = document.querySelector(".hero");
  if (!bg || !hero) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const r = hero.getBoundingClientRect();
    const top = Math.max(0, -r.top);
    const bottom = Math.max(0, window.innerHeight - r.bottom);
    bg.style.clipPath = `inset(${top}px 0 ${bottom}px 0)`;
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}

function seasonYear(d) {
  d = d || new Date();
  return d.getMonth() >= 10 ? d.getFullYear() + 1 : d.getFullYear();
}

function seasonYears() {
  const y = seasonYear();
  return [y, y + 1];
}

function fillSeasonYears() {
  const y = String(seasonYear());
  document.querySelectorAll(".season-year").forEach((el) => {
    el.textContent = y;
  });
  document.title = document.title.replace(/20\d{2}/g, y);
  const meta = document.querySelector('meta[name="description"]');
  if (meta && meta.content) meta.content = meta.content.replace(/20\d{2}/g, y);
}

document.addEventListener("DOMContentLoaded", () => {
  initIcons();
  applyI18n();
  initNav();
  fillSeasonYears();
  initScrollStory();
});

const WA = "420725866862";
const MAIL = "jiripilnaj@seznam.cz";

function whatsappLink(text) {
  return `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
}

function mailLink(subject, text) {
  return `mailto:${MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
