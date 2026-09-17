let DATA = null;
let YEAR = 2026;

function toast(msg, isError) {
  const el = document.getElementById(isError ? "err" : "flash");
  const other = document.getElementById(isError ? "flash" : "err");
  other.classList.add("hidden");
  el.textContent = msg;
  el.classList.remove("hidden");
  if (!isError) setTimeout(() => el.classList.add("hidden"), 4000);
}

function rowsForYear() {
  const y = String(YEAR);
  return (DATA.stays || [])
    .filter((s) => s.arrival.slice(0, 4) === y || s.departure.slice(0, 4) === y)
    .sort((a, b) => a.arrival.localeCompare(b.arrival) || a.studio.localeCompare(b.studio));
}

function paint() {
  const years = yearsOf(DATA);
  if (!years.includes(YEAR)) YEAR = years[years.length - 1];
  document.getElementById("year").innerHTML = years
    .map((y) => `<option ${y === YEAR ? "selected" : ""}>${y}</option>`)
    .join("");
  const body = document.getElementById("rows");
  const rows = rowsForYear();
  body.innerHTML = rows.length
    ? rows
        .map(
          (s) => `<tr data-id="${s.id}">
      <td>
        <select data-f="studio">
          <option value="filemon" ${s.studio === "filemon" ? "selected" : ""}>Filemon</option>
          <option value="baucis" ${s.studio === "baucis" ? "selected" : ""}>Baucis</option>
        </select>
      </td>
      <td><input data-f="name" value="${(s.name || "").replace(/"/g, "&quot;")}" /></td>
      <td><input data-f="arrival" type="date" value="${s.arrival}" /></td>
      <td><input data-f="departure" type="date" value="${s.departure}" /></td>
      <td class="nights">${nightsBetween(s.arrival, s.departure)}</td>
      <td class="acts">
        <button type="button" class="btn btn-sea save" data-id="${s.id}">Uložit</button>
        <button type="button" class="btn btn-ghost del" data-id="${s.id}">Smazat</button>
      </td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="muted">V roce ${YEAR} zatím žádné rezervace.</td></tr>`;
  document.getElementById("updated").textContent = DATA.updatedAt
    ? `Uloženo ${DATA.updatedAt.replace("T", " ").slice(0, 16)} · ${rows.length} rezervací`
    : "";
}

function readRow(tr) {
  return {
    id: tr.dataset.id,
    studio: tr.querySelector('[data-f="studio"]').value,
    name: tr.querySelector('[data-f="name"]').value,
    arrival: tr.querySelector('[data-f="arrival"]').value,
    departure: tr.querySelector('[data-f="departure"]').value,
  };
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
    toast("PIN je nastavený.");
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
  document.getElementById("new-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const stay = {
      studio: document.getElementById("new-studio").value,
      name: document.getElementById("new-name").value,
      arrival: document.getElementById("new-from").value,
      departure: document.getElementById("new-to").value,
    };
    const r = saveStay(DATA, stay);
    if (!r.ok) return toast(r.error, true);
    YEAR = Number(r.stay.arrival.slice(0, 4));
    document.getElementById("new-name").value = "";
    document.getElementById("new-from").value = "";
    document.getElementById("new-to").value = "";
    toast(`Přidáno: ${r.stay.name} · ${fmtDate(r.stay.arrival)} – ${fmtDate(r.stay.departure)}`);
    paint();
  });
  document.getElementById("rows").addEventListener("click", (e) => {
    const save = e.target.closest(".save");
    const del = e.target.closest(".del");
    if (save) {
      const tr = save.closest("tr");
      const r = saveStay(DATA, readRow(tr));
      if (!r.ok) {
        tr.classList.add("row-error");
        return toast(r.error, true);
      }
      tr.classList.remove("row-error");
      toast(`Uloženo: ${r.stay.name}`);
      paint();
    }
    if (del) {
      const tr = del.closest("tr");
      const s = readRow(tr);
      if (!confirm(`Smazat rezervaci ${s.name || ""} (${s.arrival} – ${s.departure})?`)) return;
      deleteStay(DATA, s.id);
      toast("Rezervace smazána.");
      paint();
    }
  });
  document.getElementById("download").addEventListener("click", () => exportData(DATA));
  document.getElementById("upload").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    DATA = ensureStays(JSON.parse(await file.text()));
    saveBookings(DATA);
    YEAR = yearsOf(DATA).at(-1);
    toast("Záloha nahraná.");
    paint();
  });
  document.getElementById("reset").addEventListener("click", async () => {
    if (!confirm("Vrátit rezervace k verzi z webu? Místní úpravy na tomto počítači se smažou.")) return;
    localStorage.removeItem(STORE_KEY);
    DATA = await loadBookings();
    YEAR = yearsOf(DATA).at(-1);
    paint();
    toast("Obnoveno z webu.");
  });
});
