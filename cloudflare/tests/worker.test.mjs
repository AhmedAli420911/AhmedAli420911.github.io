import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker, { canonicalRedirect, InquiryGuard } from "../src/worker.mjs";
import { handleInquiry, buildEmail, validateInquiry, CONSENT_TEXT, MAX_BODY_BYTES } from "../src/inquiry.mjs";
import { GuardState, RATE_LIMIT, DELIVERY } from "../src/guard.mjs";
import { SITE_CSP, DEMO_CSP } from "../src/headers.mjs";

const ORIGIN = "https://servicecaptureco.com";

// Durable Object storage stand-in. Only this persists between calls; a fresh
// InquiryGuard object is built for every call, as a new isolate or deployment would.
function fakeStorage() {
  const data = new Map();
  return {
    data,
    alarm: null,
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : undefined; },
    async put(key, value) { data.set(key, structuredClone(value)); },
    async delete(key) { data.delete(key); },
    async deleteAll() { data.clear(); },
    async setAlarm(at) { this.alarm = at; },
  };
}

// Durable Object namespace stand-in: one storage per name, calls to the same
// name run one at a time (as a single Durable Object instance does).
function fakeNamespace() {
  const storages = new Map();
  const queues = new Map();
  return {
    storages,
    idFromName: (name) => name,
    get: (id) => ({
      fetch(url, init) {
        if (!storages.has(id)) storages.set(id, fakeStorage());
        const run = (queues.get(id) || Promise.resolve()).then(() => new InquiryGuard({ storage: storages.get(id) }).fetch(new Request(url, init)));
        queues.set(id, run.catch(() => {}));
        return run;
      },
    }),
  };
}

const envWith = (overrides = {}) => ({
  CANONICAL_ORIGIN: ORIGIN,
  INQUIRY_TO: "inbox@example.test",
  INQUIRY_FROM: "Service Capture Co. Website <notifications@forms.servicecaptureco.com>",
  RESEND_API_KEY: "test-key",
  HSTS: "off",
  INQUIRY_GUARD: fakeNamespace(),
  ...overrides,
});
const valid = { fullName: "Fictional Owner", email: "owner@example.com", company: "Test HVAC", problem: "Calls arrive while\nthe office is busy.", consent: true, consentText: CONSENT_TEXT, hp: "" };
const post = (body, headers = {}) => new Request(`${ORIGIN}/api/review`, {
  method: "POST",
  headers: { Origin: ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const resendOk = () => {
  const calls = [];
  const send = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ id: `email_${calls.length}` }), { status: 200 }); };
  return { calls, send };
};

test("http, www and foreign hosts redirect permanently to the canonical origin", () => {
  const env = envWith();
  for (const input of ["http://servicecaptureco.com/privacy/?a=1", "https://www.servicecaptureco.com/privacy/?a=1", "http://www.servicecaptureco.com/privacy/?a=1", "https://service-capture-co.example.workers.dev/privacy/?a=1"]) {
    const response = canonicalRedirect(new URL(input), env);
    assert.equal(response.status, 301, input);
    assert.equal(response.headers.get("Location"), `${ORIGIN}/privacy/?a=1`, input);
  }
  assert.equal(canonicalRedirect(new URL(`${ORIGIN}/privacy/`), env), null);
  assert.equal(canonicalRedirect(new URL("http://localhost:8787/"), env), null);
});

test("pages get security headers; the demo gets its own CSP; HSTS only when switched on", async () => {
  const env = envWith({ ASSETS: { fetch: async () => new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } }) } });
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
  const env = envWith({ ASSETS: { fetch: async () => new Response("not found", { status: 404 }) } });
  assert.equal((await worker.fetch(new Request(`${ORIGIN}/missing/`), env)).status, 404);
});

test("a valid inquiry is emailed with Reply-To set to the visitor and a non-spoofed From", async () => {
  const { calls, send } = resendOk();
  const response = await handleInquiry(post(valid), envWith(), { send });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-key");
  assert.match(calls[0].init.headers["Idempotency-Key"], /^inquiry-[0-9a-f]{64}$/);
  const email = JSON.parse(calls[0].init.body);
  assert.deepEqual(email.to, ["inbox@example.test"]);
  assert.equal(email.from, "Service Capture Co. Website <notifications@forms.servicecaptureco.com>");
  assert.equal(email.reply_to, "owner@example.com");
  assert.doesNotMatch(email.from, /owner@example\.com/);
  assert.match(email.text, /Calls arrive while\nthe office is busy\./);
});

test("the email body is identical for identical submissions, as Resend idempotency requires", () => {
  const { values } = validateInquiry(valid);
  assert.deepEqual(buildEmail(values, envWith()), buildEmail(values, envWith()));
});

test("a duplicate submission is delivered once and still confirmed to the visitor", async () => {
  const env = envWith();
  const { calls, send } = resendOk();
  const first = await handleInquiry(post(valid), env, { send });
  const second = await handleInquiry(post(valid), env, { send });
  assert.equal((await first.json()).accepted, true);
  assert.equal((await second.json()).accepted, true);
  assert.equal(calls.length, 1);
});

test("concurrent duplicate submissions send exactly one email", async () => {
  const env = envWith();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const calls = [];
  const send = async () => { calls.push(1); await gate; return new Response(JSON.stringify({ id: "email_1" }), { status: 200 }); };
  const pending = [handleInquiry(post(valid), env, { send }), handleInquiry(post(valid), env, { send })];
  await new Promise((resolve) => setTimeout(resolve, 20));
  release();
  const statuses = (await Promise.all(pending)).map((response) => response.status).sort();
  assert.equal(calls.length, 1);
  assert.deepEqual(statuses, [200, 409]);
});

test("duplicate protection survives a new isolate or deployment because it lives in Durable Object storage", async () => {
  const storage = fakeStorage();
  const before = new GuardState(storage);
  assert.equal(await before.reserve(1_000), "reserved");
  await before.complete(2_000);
  // A brand-new object over the same storage stands in for a new isolate or a redeploy.
  const after = new GuardState(storage);
  assert.equal(await after.reserve(3_000), "sent");
  assert.equal(await after.reserve(2_000 + DELIVERY.sentMs + 1), "reserved");
});

test("a failed delivery releases the reservation so the visitor can retry", async () => {
  const env = envWith();
  const failing = async () => new Response(JSON.stringify({ message: "temporary" }), { status: 500 });
  assert.equal((await handleInquiry(post(valid), env, { send: failing })).status, 502);
  const { calls, send } = resendOk();
  const retry = await handleInquiry(post(valid), env, { send });
  assert.equal(retry.status, 200);
  assert.equal(calls.length, 1);
});

test("a stuck pending reservation expires", async () => {
  const state = new GuardState(fakeStorage());
  assert.equal(await state.reserve(0), "reserved");
  assert.equal(await state.reserve(DELIVERY.pendingMs - 1), "pending");
  assert.equal(await state.reserve(DELIVERY.pendingMs + 1), "reserved");
});

test("rate limiting allows the configured number per window, then recovers", async () => {
  const state = new GuardState(fakeStorage());
  for (let i = 0; i < RATE_LIMIT.limit; i++) assert.equal((await state.hit(i)).allowed, true);
  const blocked = await state.hit(RATE_LIMIT.limit);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.equal((await state.hit(RATE_LIMIT.windowMs + 10)).allowed, true);
});

test("the endpoint rate-limits per visitor with Retry-After, shared across isolates", async () => {
  const env = envWith();
  const { calls, send } = resendOk();
  for (let i = 0; i < RATE_LIMIT.limit; i++) {
    // Distinct problems so each is a new message rather than a duplicate.
    assert.equal((await handleInquiry(post({ ...valid, problem: `Scenario ${i}` }), env, { send })).status, 200);
  }
  const limited = await handleInquiry(post({ ...valid, problem: "One too many" }), env, { send });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("Retry-After")) > 0);
  assert.match((await limited.json()).error, /Too many requests/);
  const otherVisitor = await handleInquiry(post({ ...valid, problem: "Another visitor" }, { "CF-Connecting-IP": "198.51.100.4" }), env, { send });
  assert.equal(otherVisitor.status, 200);
  assert.equal(calls.length, RATE_LIMIT.limit + 1);
});

test("guard state expires through its alarm", async () => {
  const storage = fakeStorage();
  const guard = new InquiryGuard({ storage });
  await guard.fetch(new Request("https://inquiry-guard/", { method: "POST", body: JSON.stringify({ op: "hit" }) }));
  assert.ok(storage.alarm > Date.now());
  assert.ok(storage.data.size > 0);
  await guard.alarm();
  assert.equal(storage.data.size, 0);
});

test("without the persistent guard, or if it fails, the endpoint refuses instead of running unprotected", async () => {
  const { calls, send } = resendOk();
  assert.equal((await handleInquiry(post(valid), envWith({ INQUIRY_GUARD: undefined }), { send })).status, 503);
  const broken = { idFromName: (name) => name, get: () => ({ fetch: async () => new Response("boom", { status: 500 }) }) };
  assert.equal((await handleInquiry(post(valid), envWith({ INQUIRY_GUARD: broken }), { send })).status, 503);
  assert.equal(calls.length, 0);
});

test("submitted HTML is escaped and header fields cannot carry line breaks", () => {
  const { values } = validateInquiry({ ...valid, fullName: "Eve\r\nBcc: x@evil.test", company: "<script>alert(1)</script>" });
  const email = buildEmail(values, envWith());
  assert.doesNotMatch(email.subject, /[\r\n]/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(values.fullName, /[\r\n]/);
});

test("the honeypot answers like success but sends nothing", async () => {
  const { calls, send } = resendOk();
  const response = await handleInquiry(post({ ...valid, hp: "https://spam.example" }), envWith(), { send });
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(calls.length, 0);
});

test("missing consent, empty fields, bad email and oversize values are rejected before sending", async () => {
  const { calls, send } = resendOk();
  for (const body of [{ ...valid, consent: false }, { ...valid, consentText: "yes" }, { ...valid, fullName: "  " }, { ...valid, email: "not-an-email" }, { ...valid, email: "a@b.co, c@d.co" }, { ...valid, problem: "a".repeat(3001) }, { ...valid, company: "a".repeat(201) }]) {
    // A fresh guard per case keeps the rate limit out of this test.
    const response = await handleInquiry(post(body), envWith(), { send });
    assert.equal(response.status, 422, JSON.stringify(body).slice(0, 80));
    assert.equal((await response.json()).accepted, false);
  }
  assert.equal(calls.length, 0);
});

test("wrong method, foreign origin, wrong content type, oversize body and bad JSON are refused", async () => {
  const { calls, send } = resendOk();
  assert.equal((await handleInquiry(new Request(`${ORIGIN}/api/review`), envWith(), { send })).status, 405);
  assert.equal((await handleInquiry(post(valid, { Origin: "https://evil.example" }), envWith(), { send })).status, 403);
  assert.equal((await handleInquiry(post(valid, { "Content-Type": "text/plain" }), envWith(), { send })).status, 415);
  assert.equal((await handleInquiry(post("x".repeat(MAX_BODY_BYTES + 1)), envWith(), { send })).status, 413);
  assert.equal((await handleInquiry(post("{not json"), envWith(), { send })).status, 400);
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
    const response = await handleInquiry(post(valid), envWith(), { send });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).accepted, false);
  }
  const unconfigured = await handleInquiry(post(valid), envWith({ RESEND_API_KEY: "" }), { send: resendOk().send });
  assert.equal(unconfigured.status, 503);
});

test("wrangler config: one public origin, persistent guard, forms sender, no secrets in vars", async () => {
  const source = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(source.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n"));
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.deepEqual(config.routes.map((route) => [route.pattern, route.custom_domain]), [["servicecaptureco.com", true], ["www.servicecaptureco.com", true]]);
  assert.equal(config.assets.run_worker_first, true);
  assert.deepEqual(config.durable_objects.bindings, [{ name: "INQUIRY_GUARD", class_name: "InquiryGuard" }]);
  assert.ok(config.migrations.some((migration) => migration.new_sqlite_classes?.includes("InquiryGuard")));
  assert.equal(config.ratelimits, undefined);
  assert.equal(config.vars.INQUIRY_FROM, "Service Capture Co. Website <notifications@forms.servicecaptureco.com>");
  assert.equal(config.vars.INQUIRY_TO, "ahmedali@servicecaptureco.com");
  assert.equal(config.vars.RESEND_API_KEY, undefined);
  assert.equal(config.vars.HSTS, "on");
  assert.doesNotMatch(source, /re_[A-Za-z0-9]{8,}/);
});
