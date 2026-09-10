# Service Capture Co.

A complete React / Vinext agency website for the HVAC Inquiry Capture System. It has not been published. No domain, paid service, analytics, authentication or database has been connected.

## Open the download — no installation needed

1. Download `Service-Capture-Co-Updated-Project.zip` and extract it first. On Windows: right-click → **Extract All**. On macOS: double-click the ZIP.
2. Open `START-HERE.html` in Chrome, Edge, Firefox or Safari.
3. Choose **Open agency preview**, or open `Service-Capture-Co-Preview.html` directly.
4. The standalone agency file contains its styles, JavaScript, legal pages and a copy of EverWarm. **Open the EverWarm Demo** opens its unchanged embedded demo in a separate tab at `#system-demo`, showing the business workflow first. If popups are blocked, use the separately included `EverWarm-Demo.html`.

Do not open `.tsx` files to run the website. If an HTML file opens as text, use **Open with → Chrome / Edge / Firefox / Safari**. On a phone, save the download to Files, extract the ZIP, and open the HTML in a browser; some built-in file previewers do not run interactive HTML. A desktop browser is the most reliable way to inspect these local files. The standalone preview intentionally cannot submit real requests, even after production configuration changes.

## Package contents

- `Service-Capture-Co-Preview.html`: self-contained agency preview, including legal navigation and embedded fictional demo.
- `EverWarm-Demo.html`: the corrected supplied standalone EverWarm demo, unchanged.
- `production/`: ready-to-host static production export. Upload this directory's contents to the root of a chosen static host when launch is authorized.
- `agency-source/`: complete editable React / Vinext project, tests, public demo and framework production build in `dist/`.
- `everwarm-source/`: complete supplied editable EverWarm project, including its standalone builder and existing tests.
- `EverWarm-START-HERE.md`: supplied EverWarm instructions and its earlier validation history.
- `QA-RESULTS.md`: results and practical testing limits for this agency build.

## Setup and editing

Use Node.js 22.13 or later and the pnpm version recorded in `package.json` (`packageManager`). Preserve `pnpm-lock.yaml`; this project adopted pnpm from the supported starter. No extra dependencies were added.

```sh
cd agency-source
corepack enable
pnpm install --frozen-lockfile
npm run dev
```

Open the local address printed by the development command. The editable code is:

- `components/service-capture/site.tsx`: shared shell, homepage and interactive-demo guide.
- `components/service-capture/content.ts`: offer, FAQs, stages and supporting copy.
- `components/service-capture/legal.tsx`: Privacy, Terms and Accessibility drafts.
- `components/service-capture/form.tsx`: accessible form UI and submission states.
- `components/service-capture/requests.ts`: validation and the endpoint contract.
- `app/globals.css`: responsive design, focus styles and reduced-motion support.
- `app/`: framework routes and custom not-found page.
- `public/demo/index.html`: unchanged supplied EverWarm standalone.
- `preview-entry.tsx`, `render-entry.tsx`, `scripts/build-preview.mjs`: portable preview and static export from the same React components.

The starter includes unused optional UI and platform helpers. They are not connected to the website. No authentication, database, dashboard or analytics is active. The existing ESLint configuration and vendored component rules were preserved; no rule was disabled or weakened to obtain a pass.

## One public configuration location

Edit **`config/site.ts`** and rebuild. All values in this file are public browser configuration. Never place secrets, API keys or credentials here.

| Value | What to supply / current behavior |
|---|---|
| `websiteDomain` | Your final absolute HTTPS origin, without a trailing path. Empty until chosen; no fabricated domain is emitted. |
| `businessEmail` | Valid business contact email. The email link is hidden when empty. |
| `businessPhone` | Real business telephone number, preferably international format. The telephone link is hidden when empty. |
| `mailingAddress` | Valid mailing address approved for public display. Hidden when empty. |
| `calendarUrl` | Optional HTTPS calendar URL. Until configured, every review CTA goes to the contact form. |
| `contactFormEndpoint` | HTTPS endpoint or same-origin absolute path such as `/api/review`. Empty by default: submissions show an honest error and do not send data. |
| `everWarmDemoUrl` | Defaults to `/demo/#system-demo`; keep it for the included production export. May be a valid HTTPS URL. |
| `analyticsId` | Reserved for a future reviewed analytics integration; empty and inactive. |
| `analyticsConsentApproach` | Reserved documentation of the approved consent approach. Supplying an ID alone never adds an analytics script. |

The domain config supplies the framework metadata base. No structured data with invented contact information, ratings, results or clients is present. The final deployment origin determines static page URLs.

## Contact-form connection

No secure native contact-form service is currently connected. Configure a selected secure form service or server endpoint later. The browser submits `POST` JSON containing `fullName`, `email`, `company`, `problem`, `consent` and `consentText`.

All five visible fields are required: full name, business email, company name, biggest inquiry-handling problem and contact consent. Website, phone, province/state, inquiry volume and software details are collected during the System Review, not sent by this first-contact form. Consent text is exactly: “I agree that Service Capture Co. may contact me about this request.” The WebMCP preparation schema accepts only the four text fields and never supplies consent.

The endpoint must validate the request and consent on the server, apply request-size limits and abuse protection, restrict allowed browser origins, and durably accept or store the request before returning a 2xx JSON response:

```json
{ "accepted": true }
```

Use an adapter if a provider returns a different format. A generic 200 page, redirect, empty response, `{ "accepted": false }`, invalid JSON, network error or timeout will not produce a success message. The UI disables duplicate submission while pending, preserves the draft on error, and only clears it after confirmed acceptance. The browser omits credentials, rejects redirects and times out after 15 seconds. On a timeout, receipt is unknown; the form says so. Deduplication and a request identifier can be added server-side if required by the chosen provider.

For a cross-origin endpoint, configure CORS for the final website origin and permit `POST`, `Content-Type` and `Accept`. Keep mail/CRM credentials server-side. Before launch, test a real authorized submission through delivery and verify that the service's success response corresponds to actual receipt. Do not put a provider secret in this public config.

The form progressively supports an optional `prepare_system_review_request` WebMCP action in compatible browsers. It only stages visible fields, resets consent to unchecked and returns validation results. It never sends a request; the visitor reviews the form and submits. The form works normally without that browser feature.

## Build and checks

```sh
npm run build
npm test
npm run lint
pnpm exec tsc --noEmit
npm run build:preview
```

`npm run build` creates the supported framework production build in `dist/`. `npm test` regenerates the static/standalone outputs before running all 22 agency tests, so tests cannot silently use old rendered files. `npm run build:preview` writes:

- `out/production/` — all static pages and assets, including `/demo/index.html`.
- `out/Service-Capture-Co-Preview.html` — self-contained preview.

Copy freshly generated outputs into the ZIP when updating it. EverWarm is copied byte-for-byte to the production demo and embedded unchanged in the standalone. Its source has its own separate README and test commands; don't mix the two projects' dependencies.

## Deployment later

Nothing in the build commands publishes the site. When authorized, choose either:

1. **Static export (recommended for this agency site):** upload the contents of `out/production/` as the host's web root. Enable directory index files so `/privacy/`, `/terms/`, `/accessibility/`, `/interactive-demo/` and `/demo/` serve their `index.html`. Configure unknown routes to return `404.html` with HTTP 404. Do not redirect every unknown URL to the homepage. The contact endpoint is separately configured.
2. **Framework deployment:** use the built `dist/server/wrangler.json` with a compatible Workers deployment and its `dist/client` assets, or follow the supported Vinext hosting workflow. Keep `.openai/hosting.json` with no database or storage binding unless a later approved requirement needs one. No Site identity or live domain is registered in this package.

For a local static check, serve `out/production/` with a standard static server; opening its `index.html` directly is not the standalone preview because it uses root-relative assets. Use the dedicated preview HTML for double-click viewing.

Serve HTML, CSS and JavaScript with correct MIME types and HTTPS in production. Use appropriate security headers and provider-specific content security policy. The separately distributed standalone needs inline script/style and blob-window support; it is an evaluation artifact, not the recommended production entry point. Do not deploy temporary QA harnesses.

## Before public launch

Supply the domain, business email, optional business phone, valid mailing address, optional calendar URL, and a tested secure contact endpoint. Approve the actual hosting/form/email/calendar/CRM providers, processing locations, retention period and deletion procedure. Have Privacy, Terms, Accessibility and any applicable consent language reviewed professionally against actual operating practices. Confirm monitoring ownership, form delivery, spam protection and staff follow-up responsibility. Analytics is optional and must remain inactive until a provider, ID and consent approach are approved and implemented.

For real client systems, approve scripts, service area, routing, safety and human escalation rules, software selection and scheduling limits with that client. EverWarm remains fictional. It is never a customer, case study, business result or live HVAC service.

## Implementation scope

CAD $2,500 is one-time implementation of one inquiry-process review, one website form, one after-hours/unanswered-call workflow, up to six categories, one service-area/routing setup, up to three notification recipients, one compatible CRM/pipeline connection, approved customized scripts and FAQs, up to ten scripted tests, two pre-launch revision rounds, one handover session with documentation, and 30 days of support.

Support covers implementation fixes, minor scripts/categories/routing/notification adjustments and assistance using the delivered workflow. Extra forms, workflows, locations, integrations, major website development, new functionality and continued management after 30 days require a separate quote. Third-party software, phone numbers and usage charges are paid separately by the client. Integrations depend on compatibility, access, testing and client approval; final scope follows the System Review. Edit the shared scope and FAQ copy in `components/service-capture/content.ts`.

## This revision

Modified the supplied existing project. The agency design, routes, legal draft status and honest unconfigured form behavior remain. Typography now has a 12px minimum for secondary text, 14px for controls and workflow descriptions, and 16px inputs and main explanations. The primary demo URL and offline blob launcher start at the business workflow; the EverWarm HTML and its editable source remain unchanged. See `QA-RESULTS.md` for performed checks and limitations.
