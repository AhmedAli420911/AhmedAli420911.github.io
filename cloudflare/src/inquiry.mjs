// Same-origin System Review endpoint. Validates on the server, then asks Resend
// to email the request to the business mailbox. Reports {"accepted":true} only
// after Resend confirms it accepted the message for delivery.
export const CONSENT_TEXT = "I agree that Service Capture Co. may contact me about this request.";
export const MAX_BODY_BYTES = 16 * 1024;
const LIMITS = { fullName: 200, email: 200, company: 200, problem: 3000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// C0 controls except tab, LF and CR, plus DEL.
const CONTROL = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders },
  });
}

function clean(key, value) {
  if (typeof value !== "string") return "";
  const stripped = value.replace(CONTROL, "");
  // Only the free-text problem may span lines; header-bound fields may not.
  return (key === "problem" ? stripped : stripped.replace(/[\r\n\t]+/g, " ")).trim();
}

export function validateInquiry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { values: {}, errors: { form: "Invalid request." }, trapped: false };
  }
  const values = {};
  const errors = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    const value = clean(key, input[key]);
    if (!value) errors[key] = "This field is required.";
    else if (value.length > max) errors[key] = "Please shorten this value.";
    else values[key] = value;
  }
  if (values.email && (!EMAIL.test(values.email) || /[,;<>"]/.test(values.email))) {
    errors.email = "Enter a valid business email address.";
    delete values.email;
  }
  if (input.consent !== true || input.consentText !== CONSENT_TEXT) {
    errors.consent = "Please agree to be contacted about this request.";
  }
  const trapped = typeof input.hp === "string" && input.hp.trim() !== "";
  return { values, errors, trapped };
}

export function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function buildEmail(values, env, receivedAt = new Date()) {
  const when = receivedAt.toISOString();
  const rows = [["Name", values.fullName], ["Business email", values.email], ["Company", values.company]];
  const text = [
    "New System Review request from servicecaptureco.com",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Biggest inquiry-handling problem:",
    values.problem,
    "",
    `Consent: ${CONSENT_TEXT}`,
    `Received: ${when}`,
    "",
    "Reply to this email to respond to the sender directly.",
  ].join("\n");
  const html = `<p><strong>New System Review request from servicecaptureco.com</strong></p>`
    + `<table cellpadding="4">${rows.map(([label, value]) => `<tr><td><strong>${label}</strong></td><td>${escapeHtml(value)}</td></tr>`).join("")}</table>`
    + `<p><strong>Biggest inquiry-handling problem</strong></p><p style="white-space:pre-wrap">${escapeHtml(values.problem)}</p>`
    + `<p>Consent: ${escapeHtml(CONSENT_TEXT)}<br>Received: ${when}</p>`
    + `<p>Reply to this email to respond to the sender directly.</p>`;
  return {
    from: env.INQUIRY_FROM,
    to: [env.INQUIRY_TO],
    // The visitor is the reply target, never the sender: From stays our own authenticated address.
    reply_to: values.email,
    subject: `System Review request — ${values.company}`.slice(0, 200),
    text,
    html,
  };
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleInquiry(request, env, { send = fetch, now = () => new Date() } = {}) {
  if (request.method !== "POST") return json(405, { accepted: false, error: "Method not allowed." }, { Allow: "POST" });
  if (request.headers.get("Origin") !== env.CANONICAL_ORIGIN) {
    return json(403, { accepted: false, error: "Requests must be sent from the Service Capture Co. website." });
  }
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return json(415, { accepted: false, error: "Unsupported request format." });
  }
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) {
    return json(413, { accepted: false, error: "The request is too large." });
  }
  if (env.REVIEW_RATE_LIMIT) {
    const { success } = await env.REVIEW_RATE_LIMIT.limit({ key: request.headers.get("CF-Connecting-IP") || "unknown" });
    if (!success) return json(429, { accepted: false, error: "Too many requests. Please wait a minute and try again." });
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json(413, { accepted: false, error: "The request is too large." });
  let input;
  try { input = JSON.parse(raw); } catch { return json(400, { accepted: false, error: "Invalid request." }); }

  const { values, errors, trapped } = validateInquiry(input);
  // Filled honeypot: answer like a success so automated senders learn nothing, but send nothing.
  if (trapped) return json(200, { accepted: true });
  if (Object.keys(errors).length) {
    return json(422, { accepted: false, error: "Please check the highlighted fields and try again.", errors });
  }
  if (!env.RESEND_API_KEY || !env.INQUIRY_TO || !env.INQUIRY_FROM) {
    return json(503, { accepted: false, error: "The contact form is temporarily unavailable. Your request has not been sent." });
  }

  // Identical resubmissions within Resend's 24-hour idempotency window are delivered once.
  const fingerprint = await sha256Hex(`${values.email.toLowerCase()}\n${values.company}\n${values.problem}`);
  let upstream;
  try {
    upstream = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `inquiry-${fingerprint}`,
      },
      body: JSON.stringify(buildEmail(values, env, now())),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    console.error("inquiry: email provider unreachable");
    return json(502, { accepted: false, error: "The request could not be delivered. Please try again later." });
  }
  const result = await upstream.json().catch(() => null);
  if (!upstream.ok || !result || typeof result.id !== "string") {
    // Status only: never log the visitor's details.
    console.error(`inquiry: email provider rejected the message (HTTP ${upstream.status})`);
    return json(502, { accepted: false, error: "The request could not be delivered. Please try again later." });
  }
  return json(200, { accepted: true });
}
