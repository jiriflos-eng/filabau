function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells = Array(startPad).fill(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function renderCalendar(el, opts) {
  const { data, year, studios, interactive, selected, onDay } = opts;
  const months = [];
  for (let m = 0; m < 12; m++) {
    const seasonMonth =
      m + 1 >= (data.season.startMonth || 4) && m + 1 <= (data.season.endMonth || 10);
    if (!seasonMonth && !opts.showAll) continue;
    months.push(m);
  }
  const monthNames = [
    "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
    "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
  ];
  const dow = ["P", "Ú", "S", "Č", "P", "S", "N"];
  const showNames = opts.showNames !== false;

  el.innerHTML = months
    .map((m) => {
      const cells = monthGrid(year, m);
      const weeks = [];
      for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
      const head = `<div class="dow"><span></span>${dow.map((d) => `<span>${d}</span>`).join("")}</div>`;
      const body = studios
        .map((st) => {
          const stays = staysInYear(data, year, st.id);
          return weeks
            .map((week) => {
              const weekDates = week.map((d) =>
                d ? `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null
              );
              const days = week
                .map((d, idx) => {
                  if (!d) return `<span class="day off"></span>`;
                  const date = weekDates[idx];
                  const stay = stays.find((s) => date >= s.start && date <= s.end);
                  const busy = Boolean(stay);
                  const season = inSeason(data, date);
                  const sel = selected && selected.studio === st.id && selected.dates?.includes(date);
                  const role = stay ? stayRole(stay, date) : "";
                  const cls = [
                    "day",
                    season ? "in" : "off",
                    busy ? "busy" : "",
                    role,
                    sel ? "sel" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  let mark = "";
                  if (role === "arrive") mark = `<span class="mark">příjezd</span>`;
                  else if (role === "depart") mark = `<span class="mark">odjezd</span>`;
                  else if (role === "both") mark = `<span class="mark">příj. / odj.</span>`;
                  const title = stay
                    ? `${stay.note || "Obsazeno"} · příjezd ${fmtDate(stay.start)} · odjezd ${fmtDate(stay.end)}`
                    : season
                      ? "Volno"
                      : "Mimo sezónu";
                  return `<button type="button" class="${cls}" data-date="${date}" data-studio="${st.id}" title="${title}" ${!season && !interactive ? "disabled" : ""}><span class="num">${d}</span>${mark}</button>`;
                })
                .join("");

              const labels = [];
              if (showNames) {
                stays.forEach((stay) => {
                  if (!stay.note) return;
                  let from = -1;
                  let to = -1;
                  weekDates.forEach((date, idx) => {
                    if (!date) return;
                    if (date >= stay.start && date <= stay.end) {
                      if (from < 0) from = idx;
                      to = idx;
                    }
                  });
                  if (from < 0) return;
                  labels.push(
                    `<span class="stay-label" style="grid-column:${from + 1} / ${to + 2}">${stay.note}</span>`
                  );
                });
              }
              return `<div class="days"><div class="lab">${st.label}</div><div class="week-track">${days}${labels.join("")}</div></div>`;
            })
            .join("");
        })
        .join("");
      return `<article class="month"><h3>${monthNames[m]} ${year}</h3>${head}${body}</article>`;
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
