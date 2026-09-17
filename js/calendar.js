function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7; // Monday-first
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells = Array(startPad).fill(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function renderCalendar(el, opts) {
  const { data, year, studios, interactive, selected, onDay, mode } = opts;
  const months = [];
  for (let m = 0; m < 12; m++) {
    const seasonMonth =
      m + 1 >= (data.season.startMonth || 4) && m + 1 <= (data.season.endMonth || 10);
    if (!seasonMonth && !opts.showAll) continue;
    months.push(m);
  }
  const names = [
    "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
    "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
  ];
  const dow = ["P", "Ú", "S", "Č", "P", "S", "N"];
  el.innerHTML = months
    .map((m) => {
      const cells = monthGrid(year, m);
      const weeks = [];
      for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
      const head = `<div class="dow"><span></span>${dow.map((d) => `<span>${d}</span>`).join("")}</div>`;
      const body = studios
        .map((st) => {
          return weeks
            .map((week) => {
              const days = week
                .map((d) => {
                  if (!d) return `<span class="day off"></span>`;
                  const date = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const busy = isBusy(data, year, st.id, date);
                  const season = inSeason(data, date);
                  const sel = selected && selected.studio === st.id && selected.dates?.includes(date);
                  const cls = [
                    "day",
                    season ? "in" : "off",
                    busy ? "busy" : "",
                    sel ? "sel" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const title = busy
                    ? (interactive ? data.years[String(year)][st.id][date]?.note || "Obsazeno" : "Obsazeno")
                    : season
                      ? "Volno"
                      : "Mimo sezónu";
                  return `<button type="button" class="${cls}" data-date="${date}" data-studio="${st.id}" title="${title}" ${!season && !interactive ? "disabled" : ""}>${d}</button>`;
                })
                .join("");
              return `<div class="days"><div class="lab">${st.label}</div>${days}</div>`;
            })
            .join("");
        })
        .join("");
      return `<article class="month"><h3>${names[m]} ${year}</h3>${head}${body}</article>`;
    })
    .join("");

  if (onDay) {
    el.querySelectorAll(".day.in, .day.busy").forEach((btn) => {
      btn.addEventListener("click", () => {
        onDay(btn.dataset.date, btn.dataset.studio, btn.classList.contains("busy"));
      });
    });
  }
}
