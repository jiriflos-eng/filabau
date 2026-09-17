const STORE_KEY = "filabau-bookings-v1";
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

async function loadBookings() {
  const local = localStorage.getItem(STORE_KEY);
  if (local) {
    try {
      return JSON.parse(local);
    } catch (_) {}
  }
  const res = await fetch("data/bookings.json", { cache: "no-store" });
  return res.json();
}

function saveBookings(data) {
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  return data;
}

function yearsOf(data) {
  return Object.keys(data.years).map(Number).sort((a, b) => a - b);
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
  return Boolean(data.years[String(year)]?.[studio]?.[dateStr]);
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
  const map = data.years[String(year)]?.[studio] || {};
  const days = Object.keys(map).sort();
  const groups = [];
  for (const d of days) {
    const last = groups[groups.length - 1];
    if (last && addDays(last.end, 1) === d && (last.note || "") === (map[d].note || "")) {
      last.end = d;
    } else {
      groups.push({ start: d, end: d, note: map[d].note || "", studio });
    }
  }
  return groups;
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
  if (parseIso(start) > parseIso(end)) return false;
  for (let d = start; parseIso(d) < parseIso(end); d = addDays(d, 1)) {
    if (isBusy(data, year, studio, d)) return false;
    if (!inSeason(data, d)) return false;
  }
  return true;
}
