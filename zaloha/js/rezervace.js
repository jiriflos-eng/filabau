let DATA = null;
let YEAR = typeof seasonYear === "function" ? seasonYear() : new Date().getFullYear();
let picks = { baucis: [], filemon: [] };

function expandRange(pick) {
  if (!pick || pick.length < 2) return (pick || []).slice();
  const a = pick[0] < pick[1] ? pick[0] : pick[1];
  const b = pick[0] < pick[1] ? pick[1] : pick[0];
  const out = [];
  for (let d = a; parseIso(d) <= parseIso(b); d = addDays(d, 1)) out.push(d);
  return out;
}

function studioLabel(id) {
  return id === "filemon" ? "Filemon" : "Baucis";
}

function studioChoice(id) {
  const pick = picks[id] || [];
  if (pick.length === 1) {
    return { status: "partial", pick, label: studioLabel(id) };
  }
  if (pick.length < 2) {
    return { status: "empty", pick, label: studioLabel(id) };
  }
  const dates = expandRange(pick);
  const start = dates[0];
  const end = dates[dates.length - 1];
  const nights = nightsBetween(start, end);
  if (nights < (DATA.minNights || 5)) {
    return { status: "short", start, end, nights, dates, label: studioLabel(id) };
  }
  if (!rangeFree(DATA, YEAR, id, start, end)) {
    return { status: "busy", start, end, nights, dates, label: studioLabel(id) };
  }
  return { status: "ok", start, end, nights, dates, label: studioLabel(id) };
}

function paint() {
  const years = [...new Set([...yearsOf(DATA), ...seasonYears()])].sort((a, b) => a - b);
  const sel = document.getElementById("year");
  sel.innerHTML = years.map((y) => `<option ${y === YEAR ? "selected" : ""}>${y}</option>`).join("");
  renderGuestCalendar(document.getElementById("cal"), {
    data: DATA,
    year: YEAR,
    selected: {
      baucis: expandRange(picks.baucis),
      filemon: expandRange(picks.filemon),
    },
    onDay: (date, studio, busy) => {
      if (busy || !inSeason(DATA, date) || isPastDate(date)) return;
      const cur = picks[studio] || [];
      if (cur.length === 0 || cur.length === 2) picks[studio] = [date];
      else picks[studio] = [cur[0], date];
      updateInquiry();
      paint();
    },
  });
  updateInquiry();
}

function updateInquiry() {
  const box = document.getElementById("summary");
  const btn = document.getElementById("send");
  const baucis = studioChoice("baucis");
  const filemon = studioChoice("filemon");
  const both = [baucis, filemon];
  const ok = both.filter((s) => s.status === "ok");
  const bad = both.find((s) => s.status === "partial" || s.status === "short" || s.status === "busy");

  box.classList.remove("has-picks");
  if (bad) {
    if (bad.status === "partial") {
      box.textContent = t("sum_partial", { label: bad.label, date: fmtDate(bad.pick[0]) });
    } else if (bad.status === "short") {
      box.textContent = t("sum_short", { label: bad.label, min: DATA.minNights, n: bad.nights });
    } else {
      box.textContent = t("sum_busy", { label: bad.label });
    }
    btn.disabled = true;
    return;
  }
  if (!ok.length) {
    box.textContent = t("sum_empty");
    btn.disabled = true;
    return;
  }
  box.classList.add("has-picks");
  box.innerHTML =
    `<div class="pick-head">${t("pick_head")}</div>` +
    ok
      .map(
        (s) => `<div class="pick-row">
          <b>${s.label}</b>
          <span><small>${t("arrive")}</small>${fmtDate(s.start)}</span>
          <span><small>${t("depart")}</small>${fmtDate(s.end)}</span>
          <span class="pick-nights">${t("nights", { n: s.nights })}</span>
        </div>`
      )
      .join("");
  btn.disabled = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  DATA = await loadBookings();
  YEAR = seasonYear();
  document.getElementById("year").addEventListener("change", (e) => {
    YEAR = Number(e.target.value);
    picks = { baucis: [], filemon: [] };
    paint();
    jumpToRelevantMonth(document.getElementById("cal"));
  });
  document.getElementById("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const ok = ["baucis", "filemon"].map(studioChoice).filter((s) => s.status === "ok");
    if (!ok.length) return;
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const msg = document.getElementById("msg").value.trim();
    const lines = ok.map(
      (s) =>
        `${t("mail_studio", { label: s.label })}\n${t("mail_in", { date: fmtDate(s.start) })}\n${t("mail_out", { date: fmtDate(s.end) })}\n${t("mail_nights", { n: s.nights })}`
    );
    const text = `${t("mail_hello")}\n\n${lines.join("\n\n")}\n\n${t("mail_name", { v: name })}\n${t("mail_phone", { v: phone })}\n${t("mail_email", { v: email })}\n${msg ? t("mail_msg", { v: msg }) : ""}`;
    const via = document.querySelector("[name=via]:checked").value;
    if (via === "wa") window.open(whatsappLink(text), "_blank");
    else window.location.href = mailLink(t("mail_subject"), text);
  });
  paint();
  jumpToRelevantMonth(document.getElementById("cal"));
});
