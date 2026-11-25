let DATA = null;
let YEAR = typeof seasonYear === "function" ? seasonYear() : new Date().getFullYear();
let picks = { baucis: [], filemon: [] };
let activeStudio = "baucis";

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
    const state = dayAvailability(DATA, YEAR, id, pick[0]);
    return { status: "partial", pick, departureFirst: state.afternoonBusy, label: studioLabel(id) };
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
    selected: picks,
    getHint: calendarHint,
    getPreview: calendarPreview,
    onDay: (date, studio, busy) => {
      if (busy || !inSeason(DATA, date) || isPastDate(date)) return;
      activeStudio = studio;
      const cur = picks[studio] || [];
      if (cur.length === 0 || cur.length === 2) picks[studio] = [date];
      else if (cur[0] === date) picks[studio] = [];
      else picks[studio] = [cur[0], date];
      paint();
      // Repainting must not lose keyboard focus or scroll the selected month away.
      document.querySelector(`.gdate[data-date="${date}"][data-studio="${studio}"]`)?.focus({ preventScroll: true });
    },
  });
  updateInquiry();
}

function calendarHint(date, studio, state) {
  if (isPastDate(date)) return t("tooltip_past");
  if (!inSeason(DATA, date)) return t("off_season");
  if (state.morningBusy && state.afternoonBusy) return t("tooltip_busy");
  const pick = picks[studio] || [];
  if (pick.length === 1) {
    if (pick[0] === date) return t("tooltip_selected");
    const start = date < pick[0] ? date : pick[0];
    const end = date < pick[0] ? pick[0] : date;
    const nights = nightsBetween(start, end);
    if (!rangeFree(DATA, YEAR, studio, start, end)) return t("tooltip_clash");
    const hint = t(date < pick[0] ? "tooltip_arrival" : "tooltip_departure");
    const minimum = DATA.minNights || 5;
    return `${hint} · ${t("nights", { n: nights })}${nights < minimum ? ` · ${t("tooltip_short", { min: minimum })}` : ""}`;
  }
  return t(state.afternoonBusy ? "tooltip_departure" : pick.length ? "tooltip_new" : "tooltip_arrival");
}

function calendarPreview(date, studio) {
  const pick = picks[studio] || [];
  // Preview only a future checkout after this studio's selected arrival.
  if (pick.length !== 1 || date <= pick[0] || isPastDate(date) || isPastDate(pick[0])) return null;
  if (!rangeFree(DATA, YEAR, studio, pick[0], date)) return null;
  return { studio, start: pick[0], end: date };
}

function clearPick(studio) {
  picks[studio] = [];
  paint();
}

function choiceMessage(choice) {
  if (choice.status === "partial") {
    return t(choice.departureFirst ? "sum_partial_departure" : "sum_partial", {
      label: choice.label, date: fmtDate(choice.pick[0]),
    });
  }
  if (choice.status === "short") {
    return t("sum_short", { label: choice.label, min: DATA.minNights || 5, n: choice.nights });
  }
  return t("sum_busy", { label: choice.label });
}

function updateGuide(choices) {
  const guide = document.getElementById("calendar-guide");
  if (!guide) return;
  const ids = ["baucis", "filemon"];
  const badOrder = [activeStudio, ...ids.filter((id) => id !== activeStudio)];
  const bad = badOrder.find((id) => choices[id].status !== "empty" && choices[id].status !== "ok");
  const chosen = ids.filter((id) => choices[id].status === "ok");
  const step = document.getElementById("guide-step");
  const title = document.getElementById("guide-title");
  const detail = document.getElementById("guide-detail");
  const reset = document.getElementById("guide-reset");
  const next = document.getElementById("guide-form");
  const resetStudio = bad || (picks[activeStudio].length ? activeStudio : chosen[0]);
  reset.hidden = !resetStudio;
  if (resetStudio) {
    reset.dataset.studio = resetStudio;
    reset.textContent = t("pick_reset", { label: studioLabel(resetStudio) });
  }
  next.hidden = Boolean(bad) || !chosen.length;
  guide.classList.toggle("is-complete", !bad && chosen.length > 0);
  guide.classList.toggle("is-error", Boolean(bad) && choices[bad].status !== "partial");
  if (bad) {
    const choice = choices[bad];
    if (choice.status === "partial") {
      step.textContent = "2";
      title.textContent = t(choice.departureFirst ? "guide_arrival_before" : "guide_departure");
      detail.textContent = t(choice.departureFirst ? "guide_arrival_before_detail" : "guide_departure_detail", {
        label: choice.label, date: fmtDate(choice.pick[0]), min: DATA.minNights || 5,
      });
    } else {
      step.textContent = "!";
      title.textContent = t("guide_invalid");
      detail.textContent = choiceMessage(choice);
    }
  } else if (chosen.length) {
    step.textContent = "✓";
    title.textContent = t("guide_done");
    detail.textContent = chosen.map((id) => {
      const s = choices[id];
      return `${s.label}: ${fmtDate(s.start)} – ${fmtDate(s.end)} (${t("nights", { n: s.nights })})`;
    }).join(" · ");
  } else {
    step.textContent = "1";
    title.textContent = t("guide_arrival");
    detail.textContent = t("guide_start_detail");
  }
}

function updateInquiry() {
  const box = document.getElementById("summary");
  const btn = document.getElementById("send");
  const baucis = studioChoice("baucis");
  const filemon = studioChoice("filemon");
  const both = [baucis, filemon];
  const ok = both.filter((s) => s.status === "ok");
  const priority = activeStudio === "filemon" ? [filemon, baucis] : both;
  const bad = priority.find((s) => s.status === "partial" || s.status === "short" || s.status === "busy");

  box.classList.remove("has-picks");
  if (bad) {
    box.textContent = choiceMessage(bad);
    btn.disabled = true;
  } else if (!ok.length) {
    box.textContent = t("sum_empty");
    btn.disabled = true;
  } else {
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
  const resetBox = document.createElement("div");
  resetBox.className = "pick-actions";
  for (const id of ["baucis", "filemon"]) {
    if (!picks[id].length) continue;
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "pick-reset";
    reset.textContent = t("pick_reset", { label: studioLabel(id) });
    reset.addEventListener("click", () => clearPick(id));
    resetBox.append(reset);
  }
  if (resetBox.childElementCount) box.append(resetBox);
  updateGuide({ baucis, filemon });
}

document.addEventListener("DOMContentLoaded", async () => {
  DATA = await loadBookings();
  YEAR = seasonYear();
  document.getElementById("guide-reset")?.addEventListener("click", (e) => clearPick(e.currentTarget.dataset.studio));
  document.getElementById("guide-form")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("form").scrollIntoView({ block: "start", behavior: "smooth" });
    document.getElementById("name").focus({ preventScroll: true });
  });
  document.getElementById("year").addEventListener("change", (e) => {
    YEAR = Number(e.target.value);
    picks = { baucis: [], filemon: [] };
    paint();
    jumpToRelevantMonth(document.getElementById("cal"));
  });
  document.getElementById("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const choices = ["baucis", "filemon"].map(studioChoice);
    const ok = choices.filter((s) => s.status === "ok");
    if (!ok.length || choices.some((s) => s.status !== "ok" && s.status !== "empty")) return;
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
