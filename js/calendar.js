function todayIso() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function isPastMonth(year, monthIndex) {
  const now = new Date();
  return year < now.getFullYear() || (year === now.getFullYear() && monthIndex < now.getMonth());
}

function isPastDate(iso) {
  return iso < todayIso();
}

function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells = Array(startPad).fill(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function splitName(name, dayCount) {
  const chars = Array.from((name || "").toUpperCase().replace(/\s+/g, ""));
  const parts = Array(dayCount).fill("");
  if (!chars.length || !dayCount) return parts;
  if (chars.length <= dayCount) {
    chars.forEach((c, i) => {
      parts[i] = c;
    });
    return parts;
  }
  const per = Math.ceil(chars.length / dayCount);
  let k = 0;
  for (let i = 0; i < dayCount && k < chars.length; i++) {
    parts[i] = chars.slice(k, k + per).join("");
    k += per;
  }
  return parts;
}

function cellInfo(data, year, studio, date) {
  const stay = findStay(data, year, studio, date);
  if (!stay) return { busy: false, letter: "", arrive: false, depart: false, title: t("free") };
  const days = stayDays(stay.start, stay.end);
  const idx = days.indexOf(date);
  const parts = splitName(stay.note, days.length);
  return {
    busy: true,
    letter: parts[idx] || "",
    arrive: date === stay.start,
    depart: date === stay.end,
    title: `${stay.note || "Obsazeno"} · příjezd ${fmtDate(stay.start)} · odjezd ${fmtDate(stay.end)}`,
  };
}

function renderCalendar(el, opts) {
  const { data, year, onDay, selected } = opts;
  const monthNames = t("months").split("|");
  const dow = t("dow").split("|");
  const startM = (data.season && data.season.startMonth) || 4;
  const months = [];
  for (let m = startM - 1; m < 12; m++) months.push(m);

  el.innerHTML =
    `<div class="cal-board">` +
    months
      .map((m) => {
        const cells = monthGrid(year, m);
        const weeks = [];
        for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
        const weekRows = weeks
          .map((week) => {
            const nums = week
              .map((d) => `<td class="num">${d || ""}</td>`)
              .join("");
            const studioRows = STUDIOS.map((st) => {
              const tds = week
                .map((d) => {
                  if (!d) return `<td class="cell empty"></td>`;
                  const date = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const season = inSeason(data, date);
                  const info = cellInfo(data, year, st.id, date);
                  const sel =
                    selected && selected.studio === st.id && selected.dates?.includes(date);
                  const cls = [
                    "cell",
                    info.busy ? "busy" : season ? "free" : "off",
                    info.arrive ? "arrive" : "",
                    info.depart ? "depart" : "",
                    sel ? "sel" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const title = info.busy ? info.title : season ? t("free") : t("off_season");
                  const letter = info.busy ? info.letter : "";
                  return `<td class="${cls}" data-date="${date}" data-studio="${st.id}" title="${title}">${letter}</td>`;
                })
                .join("");
              return `<tr><th class="lab">${st.id === "filemon" ? "F" : "B"}</th>${tds}</tr>`;
            }).join("");
            return `<tr class="nums"><th></th>${nums}</tr>${studioRows}`;
          })
          .join("");
        return `<section class="month-card">
          <h3>${monthNames[m]}</h3>
          <table class="cal-table">
            <thead><tr><th class="lab">STUDIO</th>${dow.map((d) => `<th>${d}</th>`).join("")}</tr></thead>
            <tbody>${weekRows}</tbody>
          </table>
        </section>`;
      })
      .join("") +
    `</div>`;

  if (onDay) {
    el.querySelectorAll(".cell.free, .cell.busy").forEach((td) => {
      td.addEventListener("click", () => {
        onDay(td.dataset.date, td.dataset.studio, td.classList.contains("busy"));
      });
    });
  }
}

function escapeCalendarHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function selectedDayPart(data, year, studio, date, pick) {
  if (!pick?.length) return "";
  if (pick.length === 1) {
    if (pick[0] !== date) return "";
    const state = dayAvailability(data, year, studio, date);
    return state.afternoonBusy ? "morning" : "afternoon";
  }
  const start = pick[0] < pick[1] ? pick[0] : pick[1];
  const end = pick[0] < pick[1] ? pick[1] : pick[0];
  if (date < start || date > end || start === end) return "";
  if (date === start) return "afternoon";
  if (date === end) return "morning";
  return "both";
}

function guestStayLabel(data,stay) {
  const status=stay.status==="pending"?t("booking_pending"):t("occupied");
  return data.displayMode==="status"?status:stay.note||status;
}
function guestStayDescription(data,stay){
  const label=guestStayLabel(data,stay);
  const status=stay.status==="pending"?t("booking_pending"):t("occupied");
  return label===status?status:label+" · "+status;
}
// Even-numbered half-slot boundaries are midnight, not arrival/departure noon.
function guestDayDividers(startSlot, endSlot, status) {
  if (status === "pending") return "";
  const count = endSlot - startSlot;
  const dividers = [];
  for (let boundary = startSlot + 1; boundary < endSlot; boundary++) {
    if (boundary % 2 !== 0) continue;
    const fraction = (boundary - startSlot) / count;
    // Correct for the existing outer margins, so the line stays on the
    // actual day grid even in partial or continued bands.
    dividers.push(`<span class="gday-divider" style="left:calc(${fraction * 100}% - var(--band-margin-left) * ${1-fraction} + var(--band-margin-right) * ${fraction})" aria-hidden="true"></span>`);
  }
  return dividers.join("");
}
function guestTrackHtml(data, year, st, week, dates, selected, getHint) {
  const items = [];
  // Each date has two slots. A stay owns arrival afternoon through departure morning.
  const halves = [];
  for (let col = 0; col < 7; col++) {
    const date = dates[col];
    const d = week[col];
    if (!d) {
      halves.push(null, null);
      items.push(`<span class="gpill blank" style="grid-column:${col * 2 + 1} / span 2" aria-hidden="true"></span>`);
      continue;
    }
    const state = dayAvailability(data, year, st.id, date);
    halves.push(state.morningStay, state.afternoonStay);
    const season = inSeason(data, date);
    const past = isPastDate(date);
    const full = state.morningBusy && state.afternoonBusy;
    const occupied = state.morningBusy || state.afternoonBusy;
    const part = selectedDayPart(data, year, st.id, date, selected?.[st.id]);
    const canPick = season && !past && !full;
    const describe = (stay, available) => stay
      ? `${guestStayDescription(data,stay)} (${fmtDate(stay.start)} – ${fmtDate(stay.end)})`
      : t(available);
    const title = !season ? t("off_season") : occupied
      ? `${t("morning")}: ${describe(state.morningStay, "available_departure")} · ${t("afternoon")}: ${describe(state.afternoonStay, "available_arrival")}`
      : t("free");
    const hint = getHint ? getHint(date, st.id, state) : title;
    const label = `${st.label} · ${fmtDate(date)} · ${hint} · ${title}${part ? ` · ${t("selected")}` : ""}`;
    const tooltip = `${hint}\n${st.label} · ${fmtDate(date)}${occupied ? `\n${title}` : ""}`;
    const classes = ["gpill", "gdate", full ? "busy" : season ? "free" : "off",
      occupied ? "has-stay" : "", occupied && !full ? "partial" : "",
      full && state.morningStay.id !== state.afternoonStay.id ? "handover" : "",
      past ? "is-past" : "", part ? "has-selection" : ""].filter(Boolean).join(" ");
    items.push(`<button type="button" class="${classes}" style="grid-column:${col * 2 + 1} / span 2"
      data-date="${date}" data-studio="${st.id}" data-busy="${full ? "1" : "0"}"
      data-morning-busy="${state.morningBusy ? "1" : "0"}" data-afternoon-busy="${state.afternoonBusy ? "1" : "0"}"
      data-tooltip="${escapeCalendarHtml(tooltip)}" aria-label="${escapeCalendarHtml(label)}" aria-pressed="${Boolean(part)}" ${canPick ? "" : "disabled"}>
      <span class="gnum" aria-hidden="true">${d}</span>
      ${part ? `<span class="gselection ${part}" aria-hidden="true"></span>` : ""}
    </button>`);
  }

  // Group half-day slots by reservation identity, including two different stays on one date.
  for (let slot = 0; slot < 14;) {
    const stay = halves[slot];
    if (!stay) { slot++; continue; }
    let end = slot + 1;
    while (end < 14 && halves[end] && halves[end].id === stay.id &&
      halves[end].start === stay.start && halves[end].end === stay.end) end++;
    const starts = slot % 2 === 1 && dates[Math.floor(slot / 2)] === stay.start;
    const ends = end % 2 === 1 && dates[Math.floor((end - 1) / 2)] === stay.end;
    const count = end - slot;
    const classes = ["gband", stay.status === "pending" ? "is-pending" : "", starts ? "starts" : "continues-in", ends ? "ends" : "continues-out",
      starts && halves[slot - 1] ? "handover-in" : "",
      ends && halves[end] ? "handover-out" : "",
      count <= 4 ? "short" : "", count === 1 ? "edge-only" : ""].filter(Boolean).join(" ");
    const name = guestStayLabel(data,stay);
    items.push(`<div class="${classes}" style="grid-column:${slot + 1} / ${end + 1}" data-stay="${escapeCalendarHtml(stay.id || "")}" aria-hidden="true">
      ${guestDayDividers(slot, end, stay.status)}
      <span class="gname">${escapeCalendarHtml(name)}</span>
      ${starts ? `<span class="gtag gtag-in">${escapeCalendarHtml(t("arrive"))}</span>` : ""}
      ${ends ? `<span class="gtag gtag-out">${escapeCalendarHtml(t("depart"))}</span>` : ""}
    </div>`);
    slot = end;
  }
  return `<div class="guest-week ${st.rowClass || ""}"><div class="guest-lab">${st.label}</div><div class="guest-track">${items.join("")}</div></div>`;
}

function bindCalendarTooltips(el) {
  let tooltip = document.getElementById("calendar-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "calendar-tooltip";
    tooltip.className = "calendar-tooltip";
    tooltip.setAttribute("aria-hidden", "true");
    tooltip.hidden = true;
    document.body.append(tooltip);
    const hide = () => { tooltip.hidden = true; };
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  }
  tooltip.hidden = true;
  el.querySelectorAll(".gdate").forEach((btn) => {
    const show = (event) => {
      if (!window.matchMedia("(hover: hover)").matches) return;
      tooltip.textContent = btn.dataset.tooltip;
      tooltip.hidden = false;
      const rect = btn.getBoundingClientRect();
      const x = event.clientX ?? (rect.left + rect.width / 2);
      const y = event.clientY ?? rect.bottom;
      const left = Math.max(8, Math.min(x + 12, window.innerWidth - tooltip.offsetWidth - 8));
      const top = y + tooltip.offsetHeight + 20 > window.innerHeight
        ? Math.max(8, y - tooltip.offsetHeight - 12) : y + 12;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };
    const hide = () => { tooltip.hidden = true; };
    btn.addEventListener("pointerenter", show);
    btn.addEventListener("pointermove", show);
    btn.addEventListener("focus", show);
    btn.addEventListener("pointerleave", hide);
    btn.addEventListener("blur", hide);
  });
}

function bindCalendarPreview(el, getPreview) {
  if (!getPreview) return;
  let current = "";
  const buttons = Array.from(el.querySelectorAll(".gdate"));
  const clear = () => {
    if (!current) return;
    el.querySelectorAll(".gpreview").forEach((mark) => mark.remove());
    current = "";
  };
  const show = (btn, event) => {
    if (event.pointerType === "touch") return;
    const preview = getPreview(btn.dataset.date, btn.dataset.studio);
    if (!preview) { clear(); return; }
    const key = `${preview.studio}:${preview.start}:${preview.end}`;
    if (key === current) return;
    clear();
    current = key;
    buttons.forEach((day) => {
      const date = day.dataset.date;
      if (day.dataset.studio !== preview.studio || date < preview.start || date > preview.end) return;
      const part = date === preview.start ? "afternoon" : date === preview.end ? "morning" : "both";
      const mark = document.createElement("span");
      mark.className = `gpreview ${part}`;
      mark.setAttribute("aria-hidden", "true");
      day.append(mark);
    });
  };
  buttons.forEach((btn) => {
    btn.addEventListener("pointerenter", (event) => show(btn, event));
    btn.addEventListener("pointerleave", clear);
    btn.addEventListener("focus", (event) => show(btn, event));
    btn.addEventListener("blur", clear);
  });
}

function renderGuestCalendar(el, opts) {
  const { data, year, selected, onDay, getHint, getPreview } = opts;
  const order = [
    { id: "baucis", label: "Baucis", rowClass: "is-top" },
    { id: "filemon", label: "Filemon", rowClass: "is-bot" },
  ];
  const monthNames = t("months").split("|");
  const dow = t("dow").split("|");
  const startM = (data.season && data.season.startMonth) || 4;
  const endM = (data.season && data.season.endMonth) || 10;

  el.innerHTML = Array.from({ length: endM - startM + 1 }, (_, i) => startM - 1 + i)
    .map((m) => {
      const cells = monthGrid(year, m);
      const weeks = [];
      for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
      const weekHtml = weeks
        .map((week, wi) => {
          const dates = week.map((d) =>
            d ? `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null
          );
          const rows = order
            .map((st) => guestTrackHtml(data, year, st, week, dates, selected, getHint))
            .join("");
          return `<div class="guest-pair ${wi % 2 ? "is-alt" : ""}">${rows}</div>`;
        })
        .join("");
      const past = isPastMonth(year, m);
      return `<section class="guest-month${past ? " is-past" : ""}" data-month="${year}-${m}">
        <h3>${monthNames[m]} ${year}</h3>
        <div class="guest-dow"><span></span>${dow.map((x) => `<span>${x}</span>`).join("")}</div>
        ${weekHtml}
      </section>`;
    })
    .join("");

  if (onDay) {
    el.querySelectorAll(".gdate:not(:disabled)").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (isPastDate(btn.dataset.date)) return;
        onDay(btn.dataset.date, btn.dataset.studio, btn.dataset.busy === "1");
      });
    });
  }
  bindCalendarTooltips(el);
  bindCalendarPreview(el, getPreview);
}

function jumpToRelevantMonth(el) {
  if (!el) return;
  const now = new Date();
  const here = el.querySelector(`[data-month="${now.getFullYear()}-${now.getMonth()}"]`);
  const live = el.querySelector(".guest-month:not(.is-past)");
  const last = el.querySelector(".guest-month:last-of-type");
  (here || live || last)?.scrollIntoView({ block: "start", behavior: "auto" });
}
