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
  if (channel === "email" && config.provider === "web3forms" && config.activated === true) return "direct";
  if (channel === "whatsapp" && config.provider === "webhook") return "direct";
  return "manual";
}

function inquiryDeliveryError(code) {
  const error = new Error(`Inquiry delivery: ${code}`);
  error.code = code;
  return error;
}

async function sendInquiry(channel, payload, { test = false } = {}) {
  const testAllowed = test === true && channel === "email" && INQUIRY_DELIVERY?.email?.provider === "web3forms" && !!INQUIRY_DELIVERY.email.accessKey;
  if (deliveryMode(channel) !== "direct" && !testAllowed) throw inquiryDeliveryError("not_configured");
  if (!payload || typeof payload.text !== "string" || !payload.text.trim() ||
      typeof payload.email !== "string" || !payload.email.trim() ||
      typeof payload.requestId !== "string" || !payload.requestId.trim()) {
    throw inquiryDeliveryError("rejected");
  }

  const config = INQUIRY_DELIVERY[channel];
  const endpoint = inquiryDeliveryEndpoint(config.endpoint);
  const body = channel === "email" ? {
    access_key: config.accessKey,
    subject: payload.subject,
    from_name: "Filemon a Baucis",
    replyto: payload.email,
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    message: payload.text,
    request_id: payload.requestId,
    botcheck: Boolean(payload.botcheck),
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
  if (payload.botcheck) throw inquiryDeliveryError("rejected");
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
    if (!response.ok) throw inquiryDeliveryError(httpError);

    if (channel === "email") {
      if (result.success === true && response.status === 200) return { accepted: true };
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
