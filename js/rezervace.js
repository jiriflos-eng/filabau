let DATA = null;
let YEAR = 2026;
let STUDIO = "filemon";
let pick = [];

function selectedDates() {
  if (pick.length < 2) return pick.slice();
  const a = pick[0] < pick[1] ? pick[0] : pick[1];
  const b = pick[0] < pick[1] ? pick[1] : pick[0];
  const out = [];
  for (let d = a; parseIso(d) <= parseIso(b); d = addDays(d, 1)) out.push(d);
  return out;
}

function paint() {
  const years = yearsOf(DATA);
  const sel = document.getElementById("year");
  sel.innerHTML = years.map((y) => `<option ${y === YEAR ? "selected" : ""}>${y}</option>`).join("");
  renderCalendar(document.getElementById("cal"), {
    data: DATA,
    year: YEAR,
    studios: STUDIOS.filter((s) => s.id === STUDIO),
    interactive: false,
    selected: { studio: STUDIO, dates: selectedDates() },
    onDay: (date, studio, busy) => {
      if (busy || !inSeason(DATA, date)) return;
      if (pick.length === 0 || pick.length === 2) pick = [date];
      else pick = [pick[0], date];
      updateInquiry();
      paint();
    },
    showNames: true,
  });
  updateInquiry();
}

function updateInquiry() {
  const box = document.getElementById("summary");
  const btn = document.getElementById("send");
  if (pick.length === 1) {
    box.textContent = `Příjezd ${fmtDate(pick[0])} — teď klikněte na den odjezdu.`;
    btn.disabled = true;
    return;
  }
  if (pick.length < 2) {
    box.textContent = "Klikněte na den příjezdu a pak na den odjezdu. Oba dny jsou obsazené celé.";
    btn.disabled = true;
    return;
  }
  const dates = selectedDates();
  const start = dates[0];
  const end = dates[dates.length - 1];
  const nights = nightsBetween(start, end);
  const ok =
    nights >= (DATA.minNights || 5) &&
    rangeFree(DATA, YEAR, STUDIO, start, end);
  if (!ok) {
    box.textContent =
      nights < (DATA.minNights || 5)
        ? `Minimální pobyt je ${DATA.minNights} nocí. Teď máte ${nights}.`
        : "Ve vybraném termínu je studio obsazené (příjezd i odjezd bereme jako celý den). Zkuste jiné dny.";
    btn.disabled = true;
    return;
  }
  box.innerHTML = `<b>${STUDIO === "filemon" ? "Filemon" : "Baucis"}</b> · příjezd ${fmtDate(start)} · odjezd ${fmtDate(end)} · <b>${nights} nocí</b>`;
  btn.disabled = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  DATA = await loadBookings();
  YEAR = yearsOf(DATA).includes(new Date().getFullYear())
    ? new Date().getFullYear()
    : yearsOf(DATA)[0];
  document.getElementById("year").addEventListener("change", (e) => {
    YEAR = Number(e.target.value);
    pick = [];
    paint();
  });
  document.getElementById("studio").addEventListener("change", (e) => {
    STUDIO = e.target.value;
    pick = [];
    paint();
  });
  document.getElementById("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const dates = selectedDates();
    const start = dates[0];
    const end = dates[dates.length - 1];
    const nights = nightsBetween(start, end);
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const msg = document.getElementById("msg").value.trim();
    const studio = STUDIO === "filemon" ? "Filemon" : "Baucis";
    const text = `Dobrý den, chtěl(a) bych rezervovat studio ${studio}.\nPříjezd: ${fmtDate(start)}\nOdjezd: ${fmtDate(end)}\nPočet nocí: ${nights}\nJméno: ${name}\nTelefon: ${phone}\nE-mail: ${email}\n${msg ? "Zpráva: " + msg : ""}`;
    const via = document.querySelector("[name=via]:checked").value;
    if (via === "wa") window.open(whatsappLink(text), "_blank");
    else window.location.href = mailLink("Poptávka Filemon a Baucis", text);
  });
  paint();
});
