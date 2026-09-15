# Deploying Service Capture Co.

The production site is **https://servicecaptureco.com**, served by the
Cloudflare Worker in `cloudflare/`. The Worker serves the static export in
`production/` and the same-origin inquiry endpoint `/api/review`.

## Deploy

```sh
cd agency-source
corepack pnpm install --frozen-lockfile
npm test                 # builds the static export, runs agency + Worker tests
npm run lint
npx tsc --noEmit
npm run deploy:site      # sync out/production -> ../production, then wrangler deploy
```

`wrangler deploy` uses `cloudflare/wrangler.jsonc`. Rollback: `npx wrangler
rollback --config ../cloudflare/wrangler.jsonc` restores the previous version.

## What the Worker does

- 301 redirects `http://`, `www.servicecaptureco.com` and any other host to
  `https://servicecaptureco.com`. `workers_dev` and preview URLs are off, so no
  duplicate copy exists on `*.workers.dev`.
- Security headers on every response: Content-Security-Policy (a separate
  policy for the unchanged EverWarm demo), X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, X-Frame-Options and, since HTTPS was
  confirmed, Strict-Transport-Security.
- `/api/review` validates and sanitizes on the server, requires consent, checks
  Origin, content type and size, drops honeypot submissions silently, rate-limits
  each visitor to 5 requests per 10 minutes and delivers each unique message once
  within 24 hours. Rate limiting and duplicate protection live in the
  `InquiryGuard` Durable Object, so they hold across isolates, locations and
  deployments.
- Each accepted inquiry is emailed through Resend from
  `notifications@forms.servicecaptureco.com` to the business mailbox with
  Reply-To set to the visitor. `{"accepted": true}` is returned only after Resend
  confirms it accepted the message.

## Configuration

| Where | What |
|---|---|
| `agency-source/config/site.ts` | Public values shipped to the browser: domain, `hello@` address, phone, form endpoint. Never secrets. |
| `cloudflare/wrangler.jsonc` `vars` | Server-side, non-secret: canonical origin, recipient mailbox, sender address, HSTS switch. |
| Worker secret `RESEND_API_KEY` | Resend key with Sending access restricted to `forms.servicecaptureco.com`. Set with `npx wrangler secret put RESEND_API_KEY --config ../cloudflare/wrangler.jsonc`; never commit it. |

## DNS (Cloudflare)

Google Workspace owns the root domain's mail. Keep these untouched:

- 5 Google MX records on `servicecaptureco.com`
- `v=spf1 include:_spf.google.com ~all` (the only SPF record on the root)
- `google-site-verification=…`

Added for the launch:

| Type | Name | Purpose |
|---|---|---|
| Worker custom domain | `servicecaptureco.com` | Website |
| Worker custom domain | `www.servicecaptureco.com` | Redirects to the root |
| MX | `send.forms` → `feedback-smtp.us-east-1.amazonses.com` (10) | Resend return path / bounces |
| TXT | `send.forms` → `v=spf1 include:amazonses.com ~all` | SPF for the form sender |
| TXT | `resend._domainkey.forms` → Resend DKIM public key | DKIM for the form sender |

Cloudflare Email Routing stays disabled, and Cloudflare RUM (Web Analytics
auto-injection) is disabled because the site uses no analytics.

## GitHub Pages

`ahmedali420911.github.io` no longer hosts a copy of the site. Its workflow
publishes only a redirect page to https://servicecaptureco.com.
