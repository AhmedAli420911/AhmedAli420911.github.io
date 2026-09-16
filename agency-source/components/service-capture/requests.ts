// Optional interest field: blank is always valid, and any other value must match this list.
export const serviceOptions = ["HVAC Website", "Website Growth & Care", "Inquiry Capture System", "Custom Workflow Automation", "Not Sure Yet"] as const;
export type ReviewRequest = { fullName: string; email: string; company: string; problem: string; service: string; consent: boolean };
export const emptyRequest: ReviewRequest = {fullName: "", email: "", company: "", problem: "", service: "", consent: false};
export const requestSchema = {type: "object", additionalProperties: false, properties: Object.fromEntries(Object.keys(emptyRequest).filter(key => key !== "consent").map(key => [key, key === "service" ? {type: "string", enum: [...serviceOptions, ""]} : {type: "string", maxLength: key === "problem" ? 3000 : 200}]))};
export function safeWebUrl(value: string, relative = false) {
  if (relative && /^\/(?!\/)[^\s\\]*$/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
export function validateRequest(values: ReviewRequest) {
  const errors: Record<string, string> = {};
  for (const key of ["fullName", "email", "company", "problem"] as const) {
    if (!values[key].trim()) errors[key] = "This field is required.";
  }
  for (const key of Object.keys(values) as (keyof ReviewRequest)[]) {
    const value = values[key];
    if (typeof value === "string" && value.length > (key === "problem" ? 3000 : 200)) errors[key] = "Please shorten this value.";
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Enter a valid business email address.";
  // The service field stays optional; only an unrecognised value is an error.
  if (values.service && !(serviceOptions as readonly string[]).includes(values.service.trim())) errors.service = "Choose one of the listed options.";
  if (values.consent !== true) errors.consent = "Please agree to be contacted about this request.";
  return errors;
}
export const consentStatement = "I agree that Service Capture Co. may contact me about this request.";
// honeypot carries the hidden trap field verbatim so the server can quietly drop
// automated submissions; people never see or fill it.
export async function submitRequest(values: ReviewRequest, endpoint: string, transport: typeof fetch = fetch, honeypot = "") {
  if (Object.keys(validateRequest(values)).length) throw new Error("Please complete all required fields and contact consent.");
  if (!endpoint) throw new Error("This form is not connected yet. Your request has not been sent. Please return once contact requests are available.");
  if (!safeWebUrl(endpoint, true)) throw new Error("The contact connection is unavailable. Your request has not been sent.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await transport(endpoint, {method: "POST", headers: {"Content-Type": "application/json", Accept: "application/json"}, credentials: "omit", redirect: "error", signal: controller.signal, body: JSON.stringify({fullName: values.fullName, email: values.email, company: values.company, problem: values.problem, service: values.service, consent: values.consent, consentText: consentStatement, hp: honeypot})});
    if (!response.ok) {
      // The same-origin endpoint explains rate limits and validation failures; anything else stays generic.
      const detail: unknown = await response.json().catch(() => null);
      const reason = detail && typeof detail === "object" && "error" in detail && typeof detail.error === "string" && detail.error.length <= 200 ? detail.error : "";
      throw new Error(reason || "The request could not be confirmed. Please try again later.");
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("accepted" in result) || result.accepted !== true) throw new Error("The service did not confirm receipt. Please try again later.");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("The connection timed out. Receipt could not be confirmed. Please try again later.");
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error("The service could not confirm receipt. Please check your connection and try again.");
    throw error;
  } finally {clearTimeout(timeout);}
}
