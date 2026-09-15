// Same-origin System Review endpoint. Validates on the server, then asks Resend
// to email the request to the business mailbox. Reports {"accepted":true} only
// after Resend confirms it accepted the message for delivery.
import { guardCall } from "./guard.mjs";

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

const unavailable = () =>
  json(503, { accepted: false, error: "The contact form is temporarily unavailable. Your request has not been sent." });

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

// The message is a pure function of the submission: an identical resubmission
// produces an identical body, which Resend's idempotency key requires. The
// receive time is already on the email itself.
export function buildEmail(values, env) {
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
    "",
    "Reply to this email to respond to the sender directly.",
  ].join("\n");
  const html = `<p><strong>New System Review request from servicecaptureco.com</strong></p>`
    + `<table cellpadding="4">${rows.map(([label, value]) => `<tr><td><strong>${label}</strong></td><td>${escapeHtml(value)}</td></tr>`).join("")}</table>`
    + `<p><strong>Biggest inquiry-handling problem</strong></p><p style="white-space:pre-wrap">${escapeHtml(values.problem)}</p>`
    + `<p>Consent: ${escapeHtml(CONSENT_TEXT)}</p>`
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

export async function handleInquiry(request, env, { send = fetch } = {}) {
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
  // Without the persistent guard there is no rate limit or duplicate protection: refuse rather than run unprotected.
  if (!env.INQUIRY_GUARD) return unavailable();

  let rate;
  try {
    rate = await guardCall(env.INQUIRY_GUARD, `ip:${request.headers.get("CF-Connecting-IP") || "unknown"}`, "hit");
  } catch {
    console.error("inquiry: rate-limit guard unavailable");
    return unavailable();
  }
  if (!rate.allowed) {
    return json(429, { accepted: false, error: "Too many requests. Please wait a few minutes and try again." }, { "Retry-After": String(rate.retryAfterSeconds) });
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
  if (!env.RESEND_API_KEY || !env.INQUIRY_TO || !env.INQUIRY_FROM) return unavailable();

  const fingerprint = await sha256Hex(`${values.email.toLowerCase()}\n${values.company}\n${values.problem}`);
  const deliveryKey = `msg:${fingerprint}`;
  let reservation;
  try {
    reservation = await guardCall(env.INQUIRY_GUARD, deliveryKey, "reserve");
  } catch {
    console.error("inquiry: duplicate guard unavailable");
    return unavailable();
  }
  // Already delivered within 24 hours: the original request was accepted, so say so without sending again.
  if (reservation.status === "sent") return json(200, { accepted: true, duplicate: true });
  if (reservation.status === "pending") {
    return json(409, { accepted: false, error: "This request is already being sent. Please wait a moment before trying again." });
  }

  const failed = async (logMessage) => {
    console.error(logMessage);
    await guardCall(env.INQUIRY_GUARD, deliveryKey, "release").catch(() => {});
    return json(502, { accepted: false, error: "The request could not be delivered. Please try again later." });
  };

  let upstream;
  try {
    upstream = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        // Second line of defence if a crash separates sending from recording it.
        "Idempotency-Key": `inquiry-${fingerprint}`,
      },
      body: JSON.stringify(buildEmail(values, env)),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return failed("inquiry: email provider unreachable");
  }
  const result = await upstream.json().catch(() => null);
  if (!upstream.ok || !result || typeof result.id !== "string") {
    // Status only: never log the visitor's details.
    return failed(`inquiry: email provider rejected the message (HTTP ${upstream.status})`);
  }
  await guardCall(env.INQUIRY_GUARD, deliveryKey, "complete").catch(() => console.error("inquiry: delivered but could not record it"));
  return json(200, { accepted: true });
}
