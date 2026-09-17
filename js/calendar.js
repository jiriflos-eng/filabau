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
  if (!stay) return { busy: false, letter: "", arrive: false, depart: false, title: "Volno" };
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
  const monthNames = [
    "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
    "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
  ];
  const dow = ["P", "Ú", "S", "Č", "P", "S", "N"];
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
                  const title = info.busy ? info.title : season ? "Volno" : "Mimo sezónu";
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

function guestTrackHtml(data, year, st, week, dates, selected) {
  const items = [];
  let col = 0;
  while (col < 7) {
    const date = dates[col];
    const d = week[col];
    if (!d) {
      items.push(`<span class="gpill blank" style="grid-column:${col + 1}"></span>`);
      col++;
      continue;
    }
    const stay = findStay(data, year, st.id, date);
    if (!stay) {
      const season = inSeason(data, date);
      const sel = selected && selected.studio === st.id && selected.dates?.includes(date);
      items.push(
        `<button type="button" class="gpill ${season ? "free" : "off"} ${sel ? "sel" : ""}" style="grid-column:${col + 1}" data-date="${date}" data-studio="${st.id}" ${season ? "" : "disabled"}>${d}</button>`
      );
      col++;
      continue;
    }
    let end = col;
    while (
      end + 1 < 7 &&
      dates[end + 1] &&
      findStay(data, year, st.id, dates[end + 1]) &&
      findStay(data, year, st.id, dates[end + 1]).start === stay.start
    ) {
      end++;
    }
    const span = end - col + 1;
    const starts = dates[col] === stay.start;
    const ends = dates[end] === stay.end;
    const days = [];
    for (let k = col; k <= end; k++) {
      const sel = selected && selected.studio === st.id && selected.dates?.includes(dates[k]);
      const isA = dates[k] === stay.start;
      const isD = dates[k] === stay.end;
      days.push(
        `<button type="button" class="gday ${sel ? "sel" : ""}" data-date="${dates[k]}" data-studio="${st.id}" data-busy="1">
          <span class="gnum">${week[k]}</span>
          ${isA ? `<span class="gtag gtag-in">Příjezd</span>` : ""}
          ${isD && !isA ? `<span class="gtag gtag-out">Odjezd</span>` : ""}
          ${isA && isD ? `<span class="gtag gtag-out">Příj. / odj.</span>` : ""}
        </button>`
      );
    }
    const name = stay.note || "Obsazeno";
    items.push(
      `<div class="gband ${starts ? "starts" : ""} ${ends ? "ends" : ""} ${span <= 2 ? "short" : ""}" style="grid-column:${col + 1} / ${end + 2}" title="${name} · ${fmtDate(stay.start)} – ${fmtDate(stay.end)}">
        <div class="gband-days" style="grid-template-columns:repeat(${span},1fr)">${days.join("")}</div>
        <div class="gname">${name}</div>
      </div>`
    );
    col = end + 1;
  }
  return `<div class="guest-week ${st.rowClass || ""}"><div class="guest-lab">${st.label}</div><div class="guest-track">${items.join("")}</div></div>`;
}

function renderGuestCalendar(el, opts) {
  const { data, year, selected, onDay } = opts;
  const order = [
    { id: "baucis", label: "Baucis", rowClass: "is-top" },
    { id: "filemon", label: "Filemon", rowClass: "is-bot" },
  ];
  const monthNames = [
    "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
    "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
  ];
  const dow = ["P", "Ú", "S", "Č", "P", "S", "N"];
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
            .map((st) => guestTrackHtml(data, year, st, week, dates, selected))
            .join("");
          return `<div class="guest-pair ${wi % 2 ? "is-alt" : ""}">${rows}</div>`;
        })
        .join("");
      return `<section class="guest-month">
        <h3>${monthNames[m]} ${year}</h3>
        <div class="guest-dow"><span></span>${dow.map((x) => `<span>${x}</span>`).join("")}</div>
        ${weekHtml}
      </section>`;
    })
    .join("");

  if (onDay) {
    el.querySelectorAll(".gpill.free, .gday").forEach((btn) => {
      btn.addEventListener("click", () => {
        onDay(btn.dataset.date, btn.dataset.studio, btn.dataset.busy === "1" || btn.classList.contains("busy"));
      });
    });
  }
}
