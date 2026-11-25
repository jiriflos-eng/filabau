let DATA = null;
let YEAR = typeof seasonYear === "function" ? seasonYear() : new Date().getFullYear();

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

function syncDepartureDate(arrival, departure, suggest = false) {
  if (!isIsoDate(arrival.value)) {
    departure.removeAttribute("min");
    return;
  }
  const min = addDays(arrival.value, 1);
  departure.min = min;
  // A selected value, rather than min alone, anchors the native picker month.
  if (suggest && (!isIsoDate(departure.value) || departure.value < min)) {
    departure.value = min;
  }
}

function bindStayDateInputs(arrival, departure) {
  const suggest = () => syncDepartureDate(arrival, departure, true);
  arrival.addEventListener("input", () => syncDepartureDate(arrival, departure));
  arrival.addEventListener("change", suggest);
  departure.addEventListener("focus", suggest);
  departure.addEventListener("pointerdown", suggest);
  departure.addEventListener("keydown", (e) => {
    if ((e.altKey && e.key === "ArrowDown") || ["F4", "Enter", " "].includes(e.key)) suggest();
  });
  syncDepartureDate(arrival, departure);
}

function stayDateError(arrival, departure) {
  // Validation must not silently correct manually entered dates on Save.
  syncDepartureDate(arrival, departure);
  if (!arrival.checkValidity() || !isIsoDate(arrival.value)) {
    arrival.reportValidity();
    return "Vyplňte platné datum příjezdu.";
  }
  if (!departure.checkValidity() || !isIsoDate(departure.value) || departure.value <= arrival.value) {
    // Keep the invalid value visible; reporting validity can focus and seed it.
    return "Odjezd musí být nejdříve následující den po příjezdu.";
  }
  return "";
}

function paint() {
  const years = [...new Set([...yearsOf(DATA), ...seasonYears()])].sort((a, b) => a - b);
  if (!years.includes(YEAR)) YEAR = seasonYear();
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
      <td><input data-f="arrival" type="date" value="${s.arrival}" required /></td>
      <td><input data-f="departure" type="date" value="${s.departure}" required /></td>
      <td class="nights">${nightsBetween(s.arrival, s.departure)}</td>
      <td class="acts">
        <button type="button" class="btn btn-sea save" data-id="${s.id}">Uložit</button>
        <button type="button" class="btn btn-ghost del" data-id="${s.id}">Smazat</button>
      </td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="muted">V roce ${YEAR} zatím žádné rezervace.</td></tr>`;
  body.querySelectorAll("tr[data-id]").forEach((tr) => {
    bindStayDateInputs(tr.querySelector('[data-f="arrival"]'), tr.querySelector('[data-f="departure"]'));
  });
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
  YEAR = seasonYear();
  await gate();
  const newArrival = document.getElementById("new-from");
  const newDeparture = document.getElementById("new-to");
  bindStayDateInputs(newArrival, newDeparture);

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
    const dateError = stayDateError(newArrival, newDeparture);
    if (dateError) return toast(dateError, true);
    const stay = {
      studio: document.getElementById("new-studio").value,
      name: document.getElementById("new-name").value,
      arrival: newArrival.value,
      departure: newDeparture.value,
    };
    const r = saveStay(DATA, stay);
    if (!r.ok) return toast(r.error, true);
    YEAR = Number(r.stay.arrival.slice(0, 4));
    document.getElementById("new-name").value = "";
    newArrival.value = "";
    newDeparture.value = "";
    syncDepartureDate(newArrival, newDeparture);
    toast(`Přidáno: ${r.stay.name} · ${fmtDate(r.stay.arrival)} – ${fmtDate(r.stay.departure)}`);
    paint();
  });
  document.getElementById("rows").addEventListener("click", (e) => {
    const save = e.target.closest(".save");
    const del = e.target.closest(".del");
    if (save) {
      const tr = save.closest("tr");
      const dateError = stayDateError(
        tr.querySelector('[data-f="arrival"]'),
        tr.querySelector('[data-f="departure"]')
      );
      if (dateError) {
        tr.classList.add("row-error");
        return toast(dateError, true);
      }
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
