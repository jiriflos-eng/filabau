let DATA = null;
let YEAR = 2026;
let TOOL = "busy"; // busy | free
let pending = null;

function toast(msg) {
  const el = document.getElementById("flash");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3500);
}

function paint() {
  const years = yearsOf(DATA);
  if (!years.includes(YEAR)) YEAR = years[years.length - 1];
  document.getElementById("year").innerHTML = years
    .map((y) => `<option ${y === YEAR ? "selected" : ""}>${y}</option>`)
    .join("");
  renderCalendar(document.getElementById("cal"), {
    data: DATA,
    year: YEAR,
    selected: pending
      ? { studio: pending.studio, dates: [pending.start] }
      : null,
    onDay: onDay,
  });
  renderHistory();
  document.getElementById("updated").textContent = DATA.updatedAt
    ? `Uloženo ${DATA.updatedAt.replace("T", " ").slice(0, 16)}`
    : "";
}

function onDay(date, studio, busy) {
  if (TOOL === "free") {
    const stay = findStay(DATA, YEAR, studio, date);
    if (!stay) return toast("Tady nic obsazené není.");
    const n = setRange(DATA, YEAR, studio, stay.start, stay.end, false, "");
    toast(`Smazán pobyt ${stay.note || ""} · ${fmtDate(stay.start)} – ${fmtDate(stay.end)} (${n} dní)`);
    pending = null;
    paint();
    return;
  }
  if (busy && !pending) {
    toast("Klikněte na volný den příjezdu.");
    return;
  }
  if (pending && pending.studio === studio) {
    finishRange(pending.start, date, studio);
    pending = null;
    return;
  }
  pending = { start: date, studio };
  toast("Teď klikněte na den odjezdu (celý den).");
  paint();
}

function finishRange(a, b, studio) {
  if (parseIso(a) > parseIso(b)) [a, b] = [b, a];
  if (!rangeFree(DATA, YEAR, studio, a, b)) {
    toast("Termín se překrývá s jiným pobytem, nebo je mimo sezónu.");
    return;
  }
  openModal(a, b, studio);
}

function openModal(a, b, studio) {
  const nights = nightsBetween(a, b);
  const days = stayDays(a, b).length;
  const m = document.getElementById("modal");
  document.getElementById("modal-range").textContent =
    `${studio === "filemon" ? "Filemon" : "Baucis"} · příjezd ${fmtDate(a)} · odjezd ${fmtDate(b)} · ${nights} nocí (${days} dní včetně odjezdu)`;
  document.getElementById("guest").value = "";
  m.dataset.start = a;
  m.dataset.end = b;
  m.dataset.studio = studio;
  m.classList.remove("hidden");
  document.getElementById("guest").focus();
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

function renderHistory() {
  const stays = [
    ...staysInYear(DATA, YEAR, "filemon").map((s) => ({ ...s, studio: "Filemon" })),
    ...staysInYear(DATA, YEAR, "baucis").map((s) => ({ ...s, studio: "Baucis" })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  document.getElementById("stays").innerHTML = stays.length
    ? stays
        .map(
          (s) =>
            `<div class="stay"><b>${s.note || "bez jména"}</b> · ${s.studio}<br>příjezd ${fmtDate(s.start)}<br>odjezd ${fmtDate(s.end)}</div>`
        )
        .join("")
    : `<p class="muted">V roce ${YEAR} zatím žádné pobyty.</p>`;
  const log = (DATA.history || []).slice(0, 12);
  document.getElementById("log").innerHTML = log
    .map((h) => `<li>${(h.detail || h.action)}<br><small>${(h.at || "").replace("T", " ").slice(0, 16)}</small></li>`)
    .join("") || "<li>Zatím bez záznamů.</li>";
}

async function gate() {
  const saved = localStorage.getItem(PIN_KEY);
  document.getElementById("app").classList.add("hidden");
  document.getElementById("gate").classList.remove("hidden");
  document.getElementById("gate-title").textContent = saved
    ? "Zadejte PIN administrátora"
    : "Nastavte si jednoduchý PIN";
  document.getElementById("gate-help").textContent = saved
    ? "Stejný PIN, který jste si zvolili na tomto počítači."
    : "Třeba 4 čísla. PIN zůstane jen v tomto prohlížeči.";
}

async function unlock(pin) {
  const saved = localStorage.getItem(PIN_KEY);
  const h = await hashPin(pin);
  if (!saved) {
    localStorage.setItem(PIN_KEY, h);
    enter();
    toast("PIN je nastavený. Kalendář se ukládá sám.");
    return;
  }
  if (h !== saved) {
    document.getElementById("gate-err").textContent = "Špatný PIN.";
    return;
  }
  enter();
}

function enter() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  paint();
}

document.addEventListener("DOMContentLoaded", async () => {
  DATA = await loadBookings();
  YEAR = yearsOf(DATA).at(-1);
  await gate();

  document.getElementById("pin-form").addEventListener("submit", (e) => {
    e.preventDefault();
    unlock(document.getElementById("pin").value.trim());
  });
  document.getElementById("year").addEventListener("change", (e) => {
    YEAR = Number(e.target.value);
    paint();
  });
  document.getElementById("new-year").addEventListener("click", () => {
    const next = Math.max(...yearsOf(DATA)) + 1;
    const y = Number(prompt("Založit rok:", String(next)));
    if (!y) return;
    const r = createYear(DATA, y);
    if (!r.ok) return toast(r.error);
    YEAR = y;
    toast(`Rok ${y} je založený. Je prázdný — klikáním doplníte obsazení.`);
    paint();
  });
  document.querySelectorAll(".tool").forEach((t) => {
    t.addEventListener("click", () => {
      TOOL = t.dataset.tool;
      document.querySelectorAll(".tool").forEach((x) => x.classList.remove("active-free", "active-busy"));
      t.classList.add(TOOL === "busy" ? "active-busy" : "active-free");
    });
  });
  document.getElementById("save-guest").addEventListener("click", () => {
    const m = document.getElementById("modal");
    const n = setRange(
      DATA,
      YEAR,
      m.dataset.studio,
      m.dataset.start,
      m.dataset.end,
      true,
      document.getElementById("guest").value.trim()
    );
    closeModal();
    toast(`Uloženo: příjezd ${fmtDate(m.dataset.start)} · odjezd ${fmtDate(m.dataset.end)}`);
    paint();
  });
  document.getElementById("cancel-modal").addEventListener("click", closeModal);
  document.getElementById("download").addEventListener("click", () => exportData(DATA));
  document.getElementById("upload").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    DATA = JSON.parse(await file.text());
    saveBookings(DATA);
    YEAR = yearsOf(DATA).at(-1);
    toast("Záloha nahraná.");
    paint();
  });
  document.getElementById("reset").addEventListener("click", async () => {
    if (!confirm("Vrátit kalendář k verzi z webu? Místní úpravy na tomto počítači se smažou.")) return;
    localStorage.removeItem(STORE_KEY);
    DATA = await loadBookings();
    paint();
    toast("Obnoveno z webu.");
  });
});
