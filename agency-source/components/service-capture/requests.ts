export type ReviewRequest = { fullName: string; email: string; company: string; problem: string; consent: boolean };
export const emptyRequest: ReviewRequest = {fullName: "", email: "", company: "", problem: "", consent: false};
export const requestSchema = {type: "object", additionalProperties: false, properties: Object.fromEntries(Object.keys(emptyRequest).filter(key => key !== "consent").map(key => [key, {type: "string", maxLength: key === "problem" ? 3000 : 200}]))};
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
  if (values.consent !== true) errors.consent = "Please agree to be contacted about this request.";
  return errors;
}
export const consentStatement = "I agree that Service Capture Co. may contact me about this request.";
// A provider adapter is only needed when the endpoint cannot return this project's
// {"accepted":true} contract. The default ("") keeps the plain contract untouched.
export type SubmissionAdapter = {provider?: "" | "web3forms"; accessKey?: string};
function submissionPayload(values: ReviewRequest, adapter: SubmissionAdapter) {
  const base = {fullName: values.fullName, email: values.email, company: values.company, problem: values.problem, consent: values.consent, consentText: consentStatement};
  if (adapter.provider !== "web3forms") return base;
  // Web3Forms authenticates with a public access key in the body and mails the
  // remaining fields verbatim; subject and from_name only shape that email.
  return {...base, access_key: adapter.accessKey, subject: `System Review request — ${values.company}`, from_name: "Service Capture Co. website"};
}
function confirmsReceipt(result: unknown, adapter: SubmissionAdapter) {
  if (!result || typeof result !== "object") return false;
  const acknowledgement = adapter.provider === "web3forms" ? (result as {success?: unknown}).success : (result as {accepted?: unknown}).accepted;
  return acknowledgement === true;
}
export async function submitRequest(values: ReviewRequest, endpoint: string, transport: typeof fetch = fetch, adapter: SubmissionAdapter = {}) {
  if (Object.keys(validateRequest(values)).length) throw new Error("Please complete all required fields and contact consent.");
  if (!endpoint) throw new Error("This form is not connected yet. Your request has not been sent. Please return once contact requests are available.");
  // A provider selected without its key is not connected, however complete the rest looks.
  if (adapter.provider === "web3forms" && !adapter.accessKey) throw new Error("This form is not connected yet. Your request has not been sent. Please return once contact requests are available.");
  if (!safeWebUrl(endpoint, true)) throw new Error("The contact connection is unavailable. Your request has not been sent.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await transport(endpoint, {method: "POST", headers: {"Content-Type": "application/json", Accept: "application/json"}, credentials: "omit", redirect: "error", signal: controller.signal, body: JSON.stringify(submissionPayload(values, adapter))});
    if (!response.ok) throw new Error("The request could not be confirmed. Please try again later.");
    const result: unknown = await response.json();
    if (!confirmsReceipt(result, adapter)) throw new Error("The service did not confirm receipt. Please try again later.");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("The connection timed out. Receipt could not be confirmed. Please try again later.");
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error("The service could not confirm receipt. Please check your connection and try again.");
    throw error;
  } finally {clearTimeout(timeout);}
}
