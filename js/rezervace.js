let DATA = null;
let YEAR = typeof seasonYear === "function" ? seasonYear() : new Date().getFullYear();
let picks = { baucis: [], filemon: [] };
let activeStudio = "baucis";
let deliveryPending = false;
let inquiryValid = false;
let deliveryAttempt = null;
let deliveryReceipt = null;
let deliveryNotice = null;
let disabledDuringDelivery = [];

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
      if (deliveryPending || busy || !inSeason(DATA, date) || isPastDate(date)) return;
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
  if (deliveryPending) return;
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
  inquiryValid = !bad && ok.length > 0;

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
  updateDeliveryUi();
}

function inquiryChannel() {
  return document.querySelector("[name=via]:checked")?.value === "wa" ? "whatsapp" : "email";
}

function inquiryPayload() {
  const choices = ["baucis", "filemon"].map((studio) => ({ ...studioChoice(studio), studio }));
  const ok = choices.filter((s) => s.status === "ok");
  if (!ok.length || choices.some((s) => s.status !== "ok" && s.status !== "empty")) return null;
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const message = document.getElementById("msg").value.trim();
  const lines = ok.map((s) =>
    `${t("mail_studio", { label: s.label })}\n${t("mail_in", { date: fmtDate(s.start) })}\n${t("mail_out", { date: fmtDate(s.end) })}\n${t("mail_nights", { n: s.nights })}`
  );
  const text = `${t("mail_hello")}\n\n${lines.join("\n\n")}\n\n${t("mail_name", { v: name })}\n${t("mail_phone", { v: phone })}\n${t("mail_email", { v: email })}\n${message ? t("mail_msg", { v: message }) : ""}`;
  const payload = {
    subject: INQUIRY_DELIVERY?.email.subject || t("mail_subject"), text, name, phone, email, message,
    botcheck: document.getElementById("inquiry-botcheck")?.checked === true,
    stays: ok.map((s) => ({ studio: s.studio, arrival: s.start, departure: s.end, nights: s.nights })),
  };
  if (INQUIRY_DELIVERY) payload.whatsappText = whatsappInquiryText(payload);
  return payload;
}

function inquiryIdentity(channel, payload) {
  return payload ? JSON.stringify([channel, payload.name, payload.phone, payload.email, payload.message, payload.stays]) : "";
}

function inquiryRequestId() {
  if (globalThis.crypto?.randomUUID) return `FB-${globalThis.crypto.randomUUID()}`;
  return `FB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function showDeliveryNotice(kind, textKey, payload, identity) {
  deliveryNotice = { kind, textKey, payload, identity };
  const box = document.getElementById("delivery-status");
  box.hidden = false;
  box.dataset.state = kind;
  document.getElementById("delivery-message").textContent = t(textKey);
  const reference = document.getElementById("delivery-reference");
  reference.textContent = payload.requestId ? t("delivery_reference", { id: payload.requestId }) : "";
  reference.hidden = !payload.requestId;
  const contact = document.getElementById("delivery-contact");
  contact.hidden = !["error", "manual"].includes(kind);
  document.getElementById("fallback-wa").href = whatsappLink(payload.whatsappText + (payload.requestId ? `\n\n${t("delivery_reference", { id: payload.requestId })}` : ""));
}

function updateDeliveryUi() {
  if (!INQUIRY_DELIVERY) {
    document.getElementById("send").disabled = true;
    document.getElementById("delivery-hint").textContent = t("delivery_config_error");
    return;
  }
  const channel = inquiryChannel();
  const direct = deliveryMode(channel) === "direct";
  const payload = inquiryPayload();
  const identity = inquiryIdentity(channel, payload);
  const accepted = deliveryReceipt?.identity === identity && Boolean(identity);
  const button = document.getElementById("send");
  button.disabled = deliveryPending || !inquiryValid || accepted;
  button.textContent = t(deliveryPending ? "send_pending" : accepted ? "send_done" : direct ? "send_direct" : channel === "whatsapp" ? "send_wa" : "send_mail");
  document.getElementById("delivery-hint").textContent = t(
    direct ? (channel === "email" ? "delivery_email" : "delivery_wa") : (channel === "email" ? "delivery_mail_manual" : "delivery_wa_manual"),
    { phone: `+${INQUIRY_DELIVERY.whatsapp.phone}` }
  );
  if (!deliveryPending && deliveryNotice && deliveryNotice.identity !== identity) {
    deliveryNotice = null;
    document.getElementById("delivery-status").hidden = true;
  }
  if (accepted && !deliveryPending && !deliveryNotice) {
    showDeliveryNotice("success", "delivery_success", deliveryReceipt.payload, identity);
  }
}

function setDeliveryPending(pending) {
  deliveryPending = pending;
  const form = document.getElementById("form");
  form.setAttribute("aria-busy", String(pending));
  if (pending) {
    disabledDuringDelivery = [...form.querySelectorAll("input, textarea, select, button"),
      document.getElementById("year"), document.getElementById("guide-reset")]
      .filter((el) => el && el.id !== "send")
      .map((el) => ({ el, disabled: el.disabled }));
    disabledDuringDelivery.forEach(({ el }) => { el.disabled = true; });
  } else {
    disabledDuringDelivery.forEach(({ el, disabled }) => { el.disabled = disabled; });
    disabledDuringDelivery = [];
  }
  document.getElementById("cal").inert = pending;
  updateDeliveryUi();
}

async function submitInquiry(e) {
  e.preventDefault();
  if (deliveryPending || !INQUIRY_DELIVERY) return;
  const form = document.getElementById("form");
  if (!form.reportValidity()) return;
  const payload = inquiryPayload();
  if (!payload) return;
  const channel = inquiryChannel();
  if (payload.botcheck || (channel === "email" && deliveryMode(channel) !== "direct")) return;
  const identity = inquiryIdentity(channel, payload);
  if (deliveryReceipt?.identity === identity) return;

  if (deliveryMode(channel) !== "direct") {
    showDeliveryNotice("manual", channel === "whatsapp" ? "delivery_wa_opened" : "delivery_mail_opened", payload, identity);
    if (channel === "whatsapp") window.open(whatsappLink(payload.whatsappText), "_blank", "noopener,noreferrer");
    // E-mail never opens a local mail client.
    return;
  }

  // Reuse the reference for an explicit retry of the same request; never retry automatically.
  const requestId = deliveryAttempt?.identity === identity ? deliveryAttempt.requestId : inquiryRequestId();
  deliveryAttempt = { identity, requestId };
  const snapshot = { ...payload, requestId };
  setDeliveryPending(true);
  showDeliveryNotice("pending", "delivery_pending", snapshot, identity);
  try {
    const result = await sendInquiry(channel, snapshot);
    if (result?.accepted !== true) throw inquiryDeliveryError("unconfirmed");
    deliveryReceipt = { identity, payload: snapshot };
    showDeliveryNotice("success", "delivery_success", snapshot, identity);
  } catch (error) {
    const key = ["not_configured", "activation_required"].includes(error?.code) ? "delivery_activation"
      : error?.code === "rejected" ? "delivery_rejected" : "delivery_unconfirmed";
    showDeliveryNotice("error", key, snapshot, identity);
  } finally {
    setDeliveryPending(false);
    document.getElementById("delivery-status").focus({ preventScroll: true });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const [bookings] = await Promise.all([loadBookings(), loadInquiryConfig()]);
  DATA = bookings;
  YEAR = seasonYear();
  if (INQUIRY_DELIVERY) {
    const phone = document.getElementById("delivery-phone");
    phone.textContent = "+" + INQUIRY_DELIVERY.whatsapp.phone;
    phone.href = "tel:+" + INQUIRY_DELIVERY.whatsapp.phone;
  }
  document.getElementById("guide-reset")?.addEventListener("click", (e) => clearPick(e.currentTarget.dataset.studio));
  document.getElementById("guide-form")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("form").scrollIntoView({ block: "start", behavior: "smooth" });
    document.getElementById("name").focus({ preventScroll: true });
  });
  document.getElementById("year").addEventListener("change", (e) => {
    if (deliveryPending) return;
    YEAR = Number(e.target.value);
    picks = { baucis: [], filemon: [] };
    paint();
    jumpToRelevantMonth(document.getElementById("cal"));
  });
  const form = document.getElementById("form");
  const emailOption = form.querySelector('[name="via"][value="mail"]');
  const emailReady = deliveryMode("email") === "direct";
  emailOption.disabled = !emailReady;
  if (emailReady) emailOption.checked = true;
  else form.querySelector('[name="via"][value="wa"]').checked = true;
  form.addEventListener("input", updateDeliveryUi);
  form.addEventListener("change", updateDeliveryUi);
  form.addEventListener("submit", submitInquiry);
  paint();
  jumpToRelevantMonth(document.getElementById("cal"));
});
