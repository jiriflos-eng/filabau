function initNav() {
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

document.addEventListener("DOMContentLoaded", initNav);

const WA = "420725866862";
const MAIL = "jiripilnaj@seznam.cz";

function whatsappLink(text) {
  return `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
}

function mailLink(subject, text) {
  return `mailto:${MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
