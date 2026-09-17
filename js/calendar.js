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
