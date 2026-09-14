import { handleInquiry } from "./inquiry.mjs";
import { withSecurityHeaders } from "./headers.mjs";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function canonicalRedirect(url, env) {
  const canonical = new URL(env.CANONICAL_ORIGIN);
  if (LOCAL_HOSTS.has(url.hostname)) return null;
  // http://, www. and any other hostname all collapse onto the one canonical origin.
  if (url.protocol !== "https:" || url.host !== canonical.host) {
    return new Response(null, { status: 301, headers: { Location: `${canonical.origin}${url.pathname}${url.search}` } });
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const redirect = canonicalRedirect(url, env);
    if (redirect) return withSecurityHeaders(redirect, url.pathname, env);
    const response = url.pathname === "/api/review" ? await handleInquiry(request, env) : await env.ASSETS.fetch(request);
    return withSecurityHeaders(response, url.pathname, env);
  },
};
