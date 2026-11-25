// Adaptér pouze předává poptávku. Nezapisuje ani nepotvrzuje rezervaci termínu.
function inquiryDeliveryEndpoint(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch (_) {
    return null;
  }
}

function deliveryMode(channel) {
  if (typeof INQUIRY_DELIVERY === "undefined" || !INQUIRY_DELIVERY) return "unavailable";
  const config = INQUIRY_DELIVERY[channel];
  if (!config || !inquiryDeliveryEndpoint(config.endpoint)) return "manual";
  if (channel === "email" && config.provider === "formsubmit" && config.activated === true) return "direct";
  if (channel === "whatsapp" && config.provider === "webhook") return "direct";
  return "manual";
}

function inquiryDeliveryError(code) {
  const error = new Error(`Inquiry delivery: ${code}`);
  error.code = code;
  return error;
}

function inquiryActivationRequired(body) {
  if (body.activation_required === true || body.activated === false || body.verified === false) return true;
  const message = typeof body.message === "string" ? body.message : "";
  // Dokumentace AJAX neudává úplné schéma odpovědí. Aktivační zprávu nikdy
  // nepovažujeme za úspěšné odeslání, ani když současně obsahuje success:true.
  return /\bactivat\w*\b|\bactived\b|\bunverified\b|\bnot\s+(?:yet\s+)?verified\b|\b(?:verify|confirm)\w*\b.{0,60}\b(?:email|e-mail|form|address)\b|\b(?:email|e-mail|form|address)\b.{0,60}\b(?:verification|confirmation)\b/i.test(message);
}

async function sendInquiry(channel, payload) {
  if (deliveryMode(channel) !== "direct") throw inquiryDeliveryError("not_configured");
  if (!payload || typeof payload.text !== "string" || !payload.text.trim() ||
      typeof payload.email !== "string" || !payload.email.trim() ||
      typeof payload.requestId !== "string" || !payload.requestId.trim()) {
    throw inquiryDeliveryError("rejected");
  }

  const config = INQUIRY_DELIVERY[channel];
  const endpoint = inquiryDeliveryEndpoint(config.endpoint);
  const body = channel === "email" ? {
    _subject: payload.subject,
    _replyto: payload.email,
    _template: "table",
    _url: "https://jiriflos-eng.github.io/filabau/rezervace.html",
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    message: payload.text,
    request_id: payload.requestId,
    _honey: "",
  } : {
    subject: payload.subject,
    text: payload.whatsappText || payload.text,
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    message: payload.message,
    stays: (payload.stays || []).map((stay) => ({
      studio: stay.studio,
      arrival: stay.arrival,
      departure: stay.departure,
      nights: stay.nights,
    })),
    requestId: payload.requestId,
  };
  const controller = new AbortController();
  const configuredTimeout = Number(INQUIRY_DELIVERY.timeoutMs);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 20000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "omit",
      cache: "no-store",
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    // A gateway/server failure can occur after the upstream accepted a message.
    const httpError = response.status >= 400 && response.status < 500 && response.status !== 408
      ? "rejected" : "unconfirmed";
    let result;
    try {
      result = await response.json();
    } catch (_) {
      throw inquiryDeliveryError(response.ok ? "unconfirmed" : httpError);
    }
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw inquiryDeliveryError(response.ok ? "unconfirmed" : httpError);
    }
    if (channel === "email" && inquiryActivationRequired(result)) {
      throw inquiryDeliveryError("activation_required");
    }
    if (!response.ok) throw inquiryDeliveryError(httpError);

    if (channel === "email") {
      if (result.success === true || result.success === "true") return { accepted: true };
      if (result.success === false || result.success === "false") throw inquiryDeliveryError("rejected");
    } else {
      if (result.accepted === true && typeof result.messageId === "string" && result.messageId.trim()) {
        return { accepted: true };
      }
      if (result.accepted === false) throw inquiryDeliveryError("rejected");
    }
    throw inquiryDeliveryError("unconfirmed");
  } catch (error) {
    if (["not_configured", "activation_required", "unconfirmed", "rejected"].includes(error?.code)) throw error;
    // Síťová chyba či timeout mohou nastat i po přijetí požadavku službou.
    // Proto žádný automatický opakovaný pokus a žádné tvrzení o doručení.
    throw inquiryDeliveryError("unconfirmed");
  } finally {
    clearTimeout(timer);
  }
}
