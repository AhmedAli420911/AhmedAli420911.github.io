import test from "node:test";
import assert from "node:assert/strict";
import worker, { canonicalRedirect } from "../src/worker.mjs";
import { handleInquiry, buildEmail, validateInquiry, CONSENT_TEXT, MAX_BODY_BYTES } from "../src/inquiry.mjs";
import { SITE_CSP, DEMO_CSP } from "../src/headers.mjs";

const ORIGIN = "https://servicecaptureco.com";
const baseEnv = {
  CANONICAL_ORIGIN: ORIGIN,
  INQUIRY_TO: "inbox@example.test",
  INQUIRY_FROM: "Service Capture Co. Website <hello@servicecaptureco.com>",
  RESEND_API_KEY: "test-key",
  HSTS: "off",
};
const valid = { fullName: "Fictional Owner", email: "owner@example.com", company: "Test HVAC", problem: "Calls arrive while\nthe office is busy.", consent: true, consentText: CONSENT_TEXT, hp: "" };
const post = (body, headers = {}) => new Request(`${ORIGIN}/api/review`, {
  method: "POST",
  headers: { Origin: ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const resendOk = () => {
  const calls = [];
  const send = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ id: "email_123" }), { status: 200 }); };
  return { calls, send };
};

test("http, www and foreign hosts redirect permanently to the canonical origin", () => {
  for (const input of ["http://servicecaptureco.com/privacy/?a=1", "https://www.servicecaptureco.com/privacy/?a=1", "http://www.servicecaptureco.com/privacy/?a=1", "https://service-capture-co.example.workers.dev/privacy/?a=1"]) {
    const response = canonicalRedirect(new URL(input), baseEnv);
    assert.equal(response.status, 301, input);
    assert.equal(response.headers.get("Location"), `${ORIGIN}/privacy/?a=1`, input);
  }
  assert.equal(canonicalRedirect(new URL(`${ORIGIN}/privacy/`), baseEnv), null);
  assert.equal(canonicalRedirect(new URL("http://localhost:8787/"), baseEnv), null);
});

test("pages get security headers; the demo gets its own CSP; HSTS only when switched on", async () => {
  const env = { ...baseEnv, ASSETS: { fetch: async () => new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } }) } };
  const page = await worker.fetch(new Request(`${ORIGIN}/`), env);
  assert.equal(page.headers.get("Content-Security-Policy"), SITE_CSP);
  assert.equal(page.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(page.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(page.headers.get("Permissions-Policy"), /camera=\(\)/);
  assert.equal(page.headers.get("Strict-Transport-Security"), null);
  assert.doesNotMatch(SITE_CSP, /script-src[^;]*unsafe-inline/);
  const demo = await worker.fetch(new Request(`${ORIGIN}/demo/`), env);
  assert.equal(demo.headers.get("Content-Security-Policy"), DEMO_CSP);
  const hsts = await worker.fetch(new Request(`${ORIGIN}/`), { ...env, HSTS: "on" });
  assert.match(hsts.headers.get("Strict-Transport-Security"), /max-age=31536000/);
});

test("unknown pages keep the 404 status from the asset layer", async () => {
  const env = { ...baseEnv, ASSETS: { fetch: async () => new Response("not found", { status: 404 }) } };
  assert.equal((await worker.fetch(new Request(`${ORIGIN}/missing/`), env)).status, 404);
});

test("a valid inquiry is emailed with Reply-To set to the visitor and a non-spoofed From", async () => {
  const { calls, send } = resendOk();
  const response = await handleInquiry(post(valid), baseEnv, { send, now: () => new Date("2026-09-14T12:00:00Z") });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-key");
  assert.match(calls[0].init.headers["Idempotency-Key"], /^inquiry-[0-9a-f]{64}$/);
  const email = JSON.parse(calls[0].init.body);
  assert.deepEqual(email.to, ["inbox@example.test"]);
  assert.equal(email.from, baseEnv.INQUIRY_FROM);
  assert.equal(email.reply_to, "owner@example.com");
  assert.doesNotMatch(email.from, /owner@example\.com/);
  assert.match(email.text, /Calls arrive while\nthe office is busy\./);
});

test("identical resubmissions share one idempotency key", async () => {
  const { calls, send } = resendOk();
  await handleInquiry(post(valid), baseEnv, { send });
  await handleInquiry(post(valid), baseEnv, { send });
  assert.equal(calls[0].init.headers["Idempotency-Key"], calls[1].init.headers["Idempotency-Key"]);
});

test("submitted HTML is escaped and header fields cannot carry line breaks", () => {
  const { values } = validateInquiry({ ...valid, fullName: "Eve\r\nBcc: x@evil.test", company: "<script>alert(1)</script>" });
  const email = buildEmail(values, baseEnv);
  assert.doesNotMatch(email.subject, /[\r\n]/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(values.fullName, /[\r\n]/);
});

test("the honeypot answers like success but sends nothing", async () => {
  const { calls, send } = resendOk();
  const response = await handleInquiry(post({ ...valid, hp: "https://spam.example" }), baseEnv, { send });
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(calls.length, 0);
});

test("missing consent, empty fields, bad email and oversize values are rejected before sending", async () => {
  const { calls, send } = resendOk();
  for (const body of [{ ...valid, consent: false }, { ...valid, consentText: "yes" }, { ...valid, fullName: "  " }, { ...valid, email: "not-an-email" }, { ...valid, email: "a@b.co, c@d.co" }, { ...valid, problem: "a".repeat(3001) }, { ...valid, company: "a".repeat(201) }]) {
    const response = await handleInquiry(post(body), baseEnv, { send });
    assert.equal(response.status, 422, JSON.stringify(body).slice(0, 80));
    assert.equal((await response.json()).accepted, false);
  }
  assert.equal(calls.length, 0);
});

test("wrong method, foreign origin, wrong content type, oversize body and bad JSON are refused", async () => {
  const { calls, send } = resendOk();
  assert.equal((await handleInquiry(new Request(`${ORIGIN}/api/review`), baseEnv, { send })).status, 405);
  assert.equal((await handleInquiry(post(valid, { Origin: "https://evil.example" }), baseEnv, { send })).status, 403);
  assert.equal((await handleInquiry(post(valid, { "Content-Type": "text/plain" }), baseEnv, { send })).status, 415);
  assert.equal((await handleInquiry(post("x".repeat(MAX_BODY_BYTES + 1)), baseEnv, { send })).status, 413);
  assert.equal((await handleInquiry(post("{not json"), baseEnv, { send })).status, 400);
  assert.equal(calls.length, 0);
});

test("rate-limited visitors get a 429 with a readable message", async () => {
  const { calls, send } = resendOk();
  const env = { ...baseEnv, REVIEW_RATE_LIMIT: { limit: async ({ key }) => ({ success: key !== "203.0.113.9" }) } };
  const response = await handleInquiry(post(valid), env, { send });
  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /Too many requests/);
  assert.equal(calls.length, 0);
});

test("success is never reported without a confirmed provider acceptance", async () => {
  const cases = [
    async () => new Response(JSON.stringify({ message: "invalid key" }), { status: 401 }),
    async () => new Response(JSON.stringify({ id: "email_1" }), { status: 500 }),
    async () => new Response("<html>ok</html>", { status: 200 }),
    async () => new Response("{}", { status: 200 }),
    async () => { throw new TypeError("network down"); },
  ];
  for (const send of cases) {
    const response = await handleInquiry(post(valid), baseEnv, { send });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).accepted, false);
  }
  const unconfigured = await handleInquiry(post(valid), { ...baseEnv, RESEND_API_KEY: "" }, { send: resendOk().send });
  assert.equal(unconfigured.status, 503);
});
