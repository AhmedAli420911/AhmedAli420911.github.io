// Persistent submission guard: one Durable Object instance per key.
//   "ip:<address>"      counts recent submissions from one visitor (rate limit)
//   "msg:<fingerprint>" remembers whether an identical request was delivered
// State lives in Durable Object storage, so every Worker isolate, location and
// deployment sees the same answer. Each instance handles one request at a time,
// which also makes concurrent duplicate submissions safe. An alarm deletes the
// state 24 hours after the last use; IP addresses are never stored (the
// instance name is hashed by idFromName and not persisted).

export const RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };
export const DELIVERY = { pendingMs: 2 * 60 * 1000, sentMs: 24 * 60 * 60 * 1000 };
export const RETENTION_MS = 24 * 60 * 60 * 1000;

export class GuardState {
  constructor(storage) {
    this.storage = storage;
  }

  async hit(now, { limit, windowMs } = RATE_LIMIT) {
    const recent = ((await this.storage.get("hits")) || []).filter((at) => now - at < windowMs);
    if (recent.length >= limit) {
      await this.storage.put("hits", recent);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000)) };
    }
    recent.push(now);
    await this.storage.put("hits", recent);
    return { allowed: true };
  }

  // "reserved": caller should send now. "pending": another request is sending
  // this message. "sent": it was already delivered recently.
  async reserve(now, { pendingMs, sentMs } = DELIVERY) {
    const delivery = await this.storage.get("delivery");
    if (delivery?.state === "sent" && now - delivery.at < sentMs) return "sent";
    if (delivery?.state === "pending" && now - delivery.at < pendingMs) return "pending";
    await this.storage.put("delivery", { state: "pending", at: now });
    return "reserved";
  }

  async complete(now) {
    await this.storage.put("delivery", { state: "sent", at: now });
  }

  // Delivery failed: let the visitor retry straight away.
  async release() {
    await this.storage.delete("delivery");
  }
}

export class InquiryGuard {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = new GuardState(ctx.storage);
  }

  async fetch(request) {
    const { op } = await request.json();
    const now = Date.now();
    let result;
    if (op === "hit") result = await this.state.hit(now);
    else if (op === "reserve") result = { status: await this.state.reserve(now) };
    else if (op === "complete") result = (await this.state.complete(now), { ok: true });
    else if (op === "release") result = (await this.state.release(), { ok: true });
    else return new Response("Unknown operation", { status: 400 });
    await this.ctx.storage.setAlarm(now + RETENTION_MS);
    return Response.json(result);
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

export async function guardCall(namespace, name, op) {
  const stub = namespace.get(namespace.idFromName(name));
  const response = await stub.fetch("https://inquiry-guard/", { method: "POST", body: JSON.stringify({ op }) });
  if (!response.ok) throw new Error(`inquiry guard ${op} failed with HTTP ${response.status}`);
  return response.json();
}
