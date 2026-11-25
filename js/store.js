const STORE_KEY = "filabau-bookings-v2";
const PIN_KEY = "filabau-pin-hash";
const STUDIOS = [
  { id: "filemon", label: "Filemon" },
  { id: "baucis", label: "Baucis" },
];

function iso(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isIsoDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(parseIso(s)) === s;
}

function addDays(s, n) {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

async function hashPin(pin) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("filabau:" + pin)
  );
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function uid() {
  return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function staysFromDayMap(data) {
  const stays = [];
  for (const y of Object.keys(data.years || {})) {
    for (const st of ["filemon", "baucis"]) {
      const map = data.years[y]?.[st] || {};
      const days = Object.keys(map).sort();
      let cur = null;
      for (const d of days) {
        const note = map[d].note || "";
        if (cur && addDays(cur.departure, 1) === d && cur.name === note && cur.studio === st) {
          cur.departure = d;
        } else {
          if (cur) stays.push(cur);
          cur = { id: uid(), studio: st, name: note, arrival: d, departure: d };
        }
      }
      if (cur) stays.push(cur);
    }
  }
  return stays;
}

function ensureStays(data) {
  // An explicitly empty list is authoritative, including after the last deletion.
  if (!Array.isArray(data.stays)) {
    data.stays = staysFromDayMap(data);
  }
  return data;
}

async function loadBookings() {
  const local = localStorage.getItem(STORE_KEY);
  if (local) {
    try {
      return ensureStays(JSON.parse(local));
    } catch (_) {}
  }
  const res = await fetch("data/bookings.json", { cache: "no-store" });
  return ensureStays(await res.json());
}

function saveBookings(data) {
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  return data;
}

function yearsOf(data) {
  const set = new Set(Object.keys(data.years || {}).map(Number));
  for (const s of data.stays || []) {
    if (s.arrival) set.add(Number(s.arrival.slice(0, 4)));
    if (s.departure) set.add(Number(s.departure.slice(0, 4)));
  }
  const years = [...set].filter(Boolean).sort((a, b) => a - b);
  return years.length ? years : [new Date().getFullYear()];
}

function createYear(data, year) {
  const y = String(year);
  if (data.years[y]) return { ok: false, error: "Tento rok už v kalendáři je." };
  data.years[y] = { filemon: {}, baucis: {} };
  data.history = data.history || [];
  data.history.unshift({
    at: new Date().toISOString(),
    action: "new-year",
    year: Number(y),
    detail: `Založen rok ${y}`,
  });
  saveBookings(data);
  return { ok: true };
}

function inSeason(data, dateStr) {
  const d = parseIso(dateStr);
  const y = d.getFullYear();
  const start = new Date(y, (data.season.startMonth || 4) - 1, data.season.startDay || 30);
  const end = new Date(y, (data.season.endMonth || 10) - 1, data.season.endDay || 31);
  return d >= start && d <= end;
}

function isBusy(data, year, studio, dateStr) {
  const day = dayAvailability(data, year, studio, dateStr);
  return day.morningBusy || day.afternoonBusy;
}

function dayAvailability(data, year, studio, date) {
  const stays = staysInYear(data, year, studio);
  // A departing guest occupies the morning; an arriving guest the afternoon.
  const morningStay = stays.find((s) => s.start < date && date <= s.end) || null;
  const afternoonStay = stays.find((s) => s.start <= date && date < s.end) || null;
  return {
    morningBusy: morningStay !== null,
    afternoonBusy: afternoonStay !== null,
    morningStay,
    afternoonStay,
  };
}

function fmtDate(s) {
  const [y, m, d] = s.split("-");
  return `${Number(d)}. ${Number(m)}. ${y}`;
}

function stayDays(start, end) {
  const out = [];
  let a = start;
  let b = end;
  if (parseIso(a) > parseIso(b)) [a, b] = [b, a];
  for (let d = a; parseIso(d) <= parseIso(b); d = addDays(d, 1)) out.push(d);
  return out;
}

function findStay(data, year, studio, date) {
  return staysInYear(data, year, studio).find((s) => date >= s.start && date <= s.end) || null;
}

function stayRole(stay, date) {
  if (stay.start === stay.end) return "both";
  if (date === stay.start) return "arrive";
  if (date === stay.end) return "depart";
  return "mid";
}

function setRange(data, year, studio, start, end, occupy, note) {
  const y = String(year);
  data.years[y] = data.years[y] || { filemon: {}, baucis: {} };
  data.years[y][studio] = data.years[y][studio] || {};
  let a = start;
  let b = end;
  if (parseIso(a) > parseIso(b)) [a, b] = [b, a];
  const days = [];
  for (let d = a; parseIso(d) <= parseIso(b); d = addDays(d, 1)) days.push(d);
  for (const d of days) {
    if (occupy) data.years[y][studio][d] = { status: "occupied", note: note || "" };
    else delete data.years[y][studio][d];
  }
  data.history = data.history || [];
  data.history.unshift({
    at: new Date().toISOString(),
    action: occupy ? "occupy" : "free",
    year: Number(y),
    studio,
    start: a,
    end: b,
    note: note || "",
    detail: `${occupy ? "Obsazeno" : "Uvolněno"} ${studio} ${a} – ${b}${note ? " · " + note : ""}`,
  });
  saveBookings(data);
  return days.length;
}

function staysInYear(data, year, studio) {
  ensureStays(data);
  const y = String(year);
  return (data.stays || [])
    .filter(
      (s) =>
        s.studio === studio &&
        s.arrival <= `${y}-12-31` && s.departure >= `${y}-01-01`
    )
    .map((s) => ({
      id: s.id,
      start: s.arrival,
      end: s.departure,
      note: s.name || "",
      studio: s.studio,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function rangesOverlap(a1, a2, b1, b2) {
  // Occupied nights form [arrival, departure); touching endpoints can hand over.
  return a1 < a2 && b1 < b2 && a1 < b2 && b1 < a2;
}

function findOverlap(data, stay, excludeId) {
  ensureStays(data);
  return (data.stays || []).find(
    (s) =>
      (excludeId == null || s.id !== excludeId) &&
      s.studio === stay.studio &&
      rangesOverlap(stay.arrival, stay.departure, s.arrival, s.departure)
  );
}

function saveStay(data, stay, persist = true) {
  ensureStays(data);
  let a = stay.arrival;
  let b = stay.departure;
  if (!a || !b) return { ok: false, error: "Vyplňte příjezd i odjezd." };
  if (!isIsoDate(a) || !isIsoDate(b)) return { ok: false, error: "Vyplňte platné datum příjezdu a odjezdu." };
  if (parseIso(a) > parseIso(b)) [a, b] = [b, a];
  if (a === b) return { ok: false, error: "Pobyt musí zahrnovat alespoň jednu noc." };
  const next = {
    id: stay.id || uid(),
    studio: stay.studio,
    name: (stay.name || "").trim(),
    arrival: a,
    departure: b,
  };
  if (!STUDIOS.some((s) => s.id === next.studio)) return { ok: false, error: "Vyberte studio." };
  const clash = findOverlap(data, next, stay.id);
  if (clash) {
    return {
      ok: false,
      error: `Termín se kryje s rezervací „${clash.name || "bez jména"}“ (${fmtDate(clash.arrival)} – ${fmtDate(clash.departure)}).`,
      clash,
    };
  }
  const i = data.stays.findIndex((s) => s.id === next.id);
  if (i >= 0) data.stays[i] = next;
  else data.stays.push(next);
  data.stays.sort((x, y) => x.arrival.localeCompare(y.arrival) || x.studio.localeCompare(y.studio));
  data.history = data.history || [];
  data.history.unshift({
    at: new Date().toISOString(),
    action: i >= 0 ? "edit" : "add",
    detail: `${i >= 0 ? "Upraveno" : "Přidáno"} ${next.studio} ${next.name} ${next.arrival} – ${next.departure}`,
  });
  if (persist) saveBookings(data);
  return { ok: true, stay: next };
}

// The combined option is only a creation shortcut, not a third studio.
// Stage both inserts and persist exactly once, only if both pass validation.
function saveNewStay(data, stay) {
  if (stay.studio !== "both") return saveStay(data, stay);
  const staged = JSON.parse(JSON.stringify(data));
  const created = [];
  for (const studio of STUDIOS) {
    const result = saveStay(staged, { ...stay, id: undefined, studio: studio.id }, false);
    if (!result.ok) return { ...result, error: `${studio.label}: ${result.error} Nebyla uložena žádná z obou rezervací.` };
    created.push(result.stay);
  }
  try {
    saveBookings(staged);
  } catch (_) {
    return { ok: false, error: "Rezervace se nepodařilo uložit do prohlížeče. Nebyla uložena žádná z obou rezervací." };
  }
  Object.assign(data, staged);
  return { ok: true, stay: created[0], stays: created };
}

function deleteStay(data, id) {
  ensureStays(data);
  const s = data.stays.find((x) => x.id === id);
  data.stays = data.stays.filter((x) => x.id !== id);
  data.history = data.history || [];
  if (s) {
    data.history.unshift({
      at: new Date().toISOString(),
      action: "delete",
      detail: `Smazáno ${s.studio} ${s.name} ${s.arrival} – ${s.departure}`,
    });
  }
  saveBookings(data);
}

function exportData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `filabau-kalendar-${iso(new Date())}.json`;
  a.click();
}

function nightsBetween(start, end) {
  return Math.round((parseIso(end) - parseIso(start)) / 86400000);
}

function rangeFree(data, year, studio, start, end) {
  if (!isIsoDate(start) || !isIsoDate(end)) return false;
  let a = start;
  let b = end;
  if (a > b) [a, b] = [b, a];
  if (a === b || !stayDays(a, b).every((d) => inSeason(data, d))) return false;
  return !findOverlap(data, { studio, arrival: a, departure: b });
}
