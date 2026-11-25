// Public configuration is loaded from data/config.json. Never store credentials here.
let INQUIRY_DELIVERY = null;
let inquiryConfigPromise;
let inquiryConfigError = null;

function normalizeInquiryConfig(raw) {
  const email = raw?.email?.address?.trim();
  const phone = String(raw?.whatsapp?.phone ?? "").trim().replace(/[\s()-]/g, "").replace(/^(?:\+|00)/, "");
  if (typeof email !== "string" || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) throw Error("Invalid email address");
  if (!/^[1-9]\d{7,14}$/.test(phone)) throw Error("Invalid WhatsApp number");
  const wa = raw.whatsapp;
  if (![wa.template, wa.stayTemplate, wa.messageTemplate].every(v => typeof v === "string" && v.length)) throw Error("Missing WhatsApp templates");
  const required = (s, keys) => keys.every(k => s.includes("{" + k + "}"));
  if (!required(wa.template, ["stays","name","phone","email","messageBlock"]) || !required(wa.stayTemplate, ["studio","arrival","departure","nights"]) || !required(wa.messageTemplate, ["message"])) throw Error("Incomplete WhatsApp template");
  const accessKey = String(raw.email.accessKey || "").trim();
  if (raw.email.provider !== "web3forms" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accessKey)) throw Error("Invalid Web3Forms access key");
  return {
    email: { address: email, provider: "web3forms", activated: raw.email.activated === true, subject: typeof raw.email.subject === "string" ? raw.email.subject : "", accessKey, endpoint: "https://api.web3forms.com/submit" },
    whatsapp: { phone, provider: "webhook", endpoint: typeof wa.endpoint === "string" ? wa.endpoint : "", template: wa.template, stayTemplate: wa.stayTemplate, messageTemplate: wa.messageTemplate },
    timeoutMs: Number(raw.timeoutMs) || 20000
  };
}
function loadInquiryConfig() {
  if (!inquiryConfigPromise) inquiryConfigPromise = (async () => {
    try {
      const res = await fetch("data/config.json", { cache: "no-store" });
      if (!res.ok) throw Error("HTTP " + res.status);
      INQUIRY_DELIVERY = normalizeInquiryConfig(await res.json());
      return INQUIRY_DELIVERY;
    } catch (e) {
      inquiryConfigError = e;
      console.error("Filabau: nelze načíst konfiguraci poptávek", e);
      return null;
    }
  })();
  return inquiryConfigPromise;
}
function fillInquiryTemplate(template, values) {
  // One pass: text entered by a visitor is never interpreted as another placeholder.
  return template.replace(/\{([a-zA-Z]+)\}/g, (all, key) => Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : all);
}
function whatsappInquiryText(payload) {
  const c = INQUIRY_DELIVERY.whatsapp;
  const stays = payload.stays.map(s => fillInquiryTemplate(c.stayTemplate, {
    studio: s.studio === "filemon" ? "Filemon" : "Baucis",
    arrival: fmtDate(s.arrival), departure: fmtDate(s.departure), nights: s.nights
  })).join("\n\n");
  const messageBlock = payload.message ? fillInquiryTemplate(c.messageTemplate, {message: payload.message}) : "";
  return fillInquiryTemplate(c.template, {stays, name: payload.name, phone: payload.phone, email: payload.email, messageBlock});
}
