let DATA = null;
let adminBusy = false;
async function persistAdmin(previous) {
  if (!centralBookings()) return true;
  adminBusy = true;
  try { DATA = ensureStays(await writeCentralAdmin(DATA)); return true; }
  catch (e) {
    DATA = previous;
    try { const latest=await readCentralAdmin(); if(latest) DATA=ensureStays(latest); } catch (_) {}
    paint(); toast("Centrální uložení nebylo potvrzeno: " + e.message,true); return false;
  } finally { adminBusy=false; }
}
function copyAdminData() { return JSON.parse(JSON.stringify(DATA)); }
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

function adminEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
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
          (s) => `<tr data-id="${adminEscape(s.id)}" class="${s.status === "pending" ? "stay-pending" : "stay-confirmed"}">
      <td>
        <select data-f="studio">
          <option value="filemon" ${s.studio === "filemon" ? "selected" : ""}>Filemon</option>
          <option value="baucis" ${s.studio === "baucis" ? "selected" : ""}>Baucis</option>
        </select>
      </td>
      <td><input data-f="name" value="${adminEscape(s.name)}" /></td>
      <td><input data-f="arrival" type="date" value="${s.arrival}" required /></td>
      <td><input data-f="departure" type="date" value="${s.departure}" required /></td>
      <td class="nights">${nightsBetween(s.arrival, s.departure)}</td>
      <td class="status-text">${s.status === "pending" ? "Čeká na schválení" : "Schváleno"}
        ${s.email ? `<small style="display:block;white-space:normal">${adminEscape(s.email)} · ${adminEscape(s.phone)}<br>${adminEscape(s.message)}<br>${adminEscape(s.requestId)}</small>` : ""}</td>
      <td class="acts">
        ${s.status === "pending" ? '<button type="button" class="btn approve">Schválit</button>' : ""}
        <button type="button" class="btn btn-sea save">Uložit</button>
        <button type="button" class="btn btn-ghost del">Smazat</button>
      </td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="muted">V roce ${YEAR} zatím žádné rezervace.</td></tr>`;
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
  if (centralBookings()) {
    document.getElementById("gate-title").textContent="Přístup správce";
    document.getElementById("gate-help").textContent="Zadejte serverové heslo správce. Místní PIN již nepoužíváme.";
    document.getElementById("pin").removeAttribute("inputmode");
    document.getElementById("pin-label").textContent="Heslo správce";
    return;
  }
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
  if (centralBookings()) {
    if(adminBusy) return;
    adminBusy=true; bookingAdminToken=pin;
    try {
      let remote=await readCentralAdmin();
      if(!remote){
        if(!confirm("Centrální úložiště je prázdné. Chcete ho založit z dat tohoto prohlížeče (nebo z původního JSONu, pokud zde nejsou)? Nejprve si ověřte, že máte správnou zálohu.")) {bookingAdminToken="";return;}
        remote=await writeCentralAdmin(await loadLegacyBookings());
      }
      DATA=ensureStays(remote);document.getElementById("pin").value="";enter();
    } catch(e) {bookingAdminToken="";document.getElementById("gate-err").textContent="Přihlášení nebo načtení se nezdařilo: "+e.message;}
    finally{adminBusy=false;}
    return;
  }
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
  try {
    await loadBookingSettings();
    if (!centralBookings()) DATA = await loadLegacyBookings();
  } catch(e) {document.getElementById("gate-err").textContent="Nelze načíst konfiguraci: "+e.message;return;}
  document.getElementById("storage-mode").textContent=centralBookings()?"GitHub – centrální bookings.json; změny platí pro všechny návštěvníky.":"Místní režim – změny nejsou zveřejněné. Stáhněte zálohu; centrální zápis na GitHub ještě není připojený.";
  document.getElementById("reset").textContent=centralBookings()?"Načíst ze serveru":"Obnovit z webu";
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
  document.getElementById("new-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if(adminBusy) return;
    const previous=copyAdminData();
    const dateError = stayDateError(newArrival, newDeparture);
    if (dateError) return toast(dateError, true);
    const stay = {
      studio: document.getElementById("new-studio").value,
      name: document.getElementById("new-name").value,
      arrival: newArrival.value,
      departure: newDeparture.value,
    };
    const r = saveNewStay(DATA, stay);
    if (!r.ok) return toast(r.error, true);
    if (!await persistAdmin(previous)) return;
    YEAR = Number(r.stay.arrival.slice(0, 4));
    document.getElementById("new-name").value = "";
    newArrival.value = "";
    newDeparture.value = "";
    syncDepartureDate(newArrival, newDeparture);
    const label = stay.studio === "both" ? "Filemon + Baucis" : STUDIOS.find((s) => s.id === stay.studio).label;
    toast(`Přidáno: ${label} · ${r.stay.name} · ${fmtDate(r.stay.arrival)} – ${fmtDate(r.stay.departure)}`);
    paint();
  });
  document.getElementById("rows").addEventListener("click", async (e) => {
    if(adminBusy) return;
    const previous=copyAdminData();
    const save = e.target.closest(".save");
    const del = e.target.closest(".del");
    const approve = e.target.closest(".approve");
    if (approve) {
      const r = approveStay(DATA, approve.closest("tr").dataset.id);
      if (!r.ok) return toast(r.error,true);
      if(!await persistAdmin(previous)) return;
      toast("Rezervace schválena.");
      paint();
      return;
    }
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
      if(!await persistAdmin(previous)) return;
      toast(`Uloženo: ${r.stay.name}`);
      paint();
    }
    if (del) {
      const tr = del.closest("tr");
      const s = readRow(tr);
      if (!confirm(`Smazat rezervaci ${s.name || ""} (${s.arrival} – ${s.departure})?`)) return;
      deleteStay(DATA, s.id);
      if(!await persistAdmin(previous)) return;
      toast("Rezervace smazána.");
      paint();
    }
  });
  document.getElementById("download").addEventListener("click", () => exportData(DATA));
  document.getElementById("upload").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file || adminBusy) return;
    if(centralBookings() && !confirm("Nahrání zálohy nahradí celý centrální kalendář včetně čekajících poptávek. Pokračovat?")) {e.target.value="";return;}
    const previous=copyAdminData();
    try {
      DATA=ensureStays(JSON.parse(await file.text()));
      saveBookings(DATA);
      if(!await persistAdmin(previous)) return;
      YEAR=yearsOf(DATA).at(-1);toast("Záloha nahraná.");paint();
    } catch(error){DATA=previous;toast("Zálohu nelze načíst: "+error.message,true);}
    finally{e.target.value="";}
  });
  document.getElementById("reset").addEventListener("click", async () => {
    if(adminBusy) return;
    if(centralBookings()){
      adminBusy=true;
      try{DATA=ensureStays(await readCentralAdmin());paint();toast("Načteno ze serveru.");}
      catch(e){toast("Načtení selhalo: "+e.message,true);}
      finally{adminBusy=false;}
      return;
    }
    if (!confirm("Vrátit rezervace k verzi z webu? Místní úpravy na tomto počítači se smažou.")) return;
    localStorage.removeItem(STORE_KEY);
    DATA = await loadBookings();
    YEAR = yearsOf(DATA).at(-1);
    paint();
    toast("Obnoveno z webu.");
  });
});
