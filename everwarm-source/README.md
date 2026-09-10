# EverWarm Home Comfort — HVAC Inquiry Capture System

EverWarm is fictional. Use invented test information only. This working demo
preserves the homeowner website and shows four intake channels: Website Form,
After-Hours AI, Missed-Call Recovery, and Manual Entry.

## Open the standalone demo

On Windows, right-click the downloaded ZIP and choose **Extract All**. Open the
extracted `EverWarm-Demo.html` with Chrome or Edge. You can also download the
standalone HTML directly and use **Open with → Chrome / Edge**. Do not open a
`.tsx` source file to run the demo. No terminal commands are needed for the HTML.


Open `EverWarm-Demo.html` in a modern browser. The image, styles, and JavaScript
are embedded; no installation, server, or internet connection is required.
Use **View Business Workflow** in the top banner for the owner-facing view.
Pages use hash navigation, without personal information in the URL.

## What to try

1. Submit the short homeowner form using a fictional name, phone, location, and
   selected service. Email is optional; choosing email as the preferred contact
   method requires an email address. Additional details are collapsible.
2. Follow the confirmation to the tracker. Website inquiries begin as Website
   Form, Standard urgency, and New status.
3. Open the business workflow and choose **Simulate After-Hours Call**. Select
   one of four fictional scenarios and a capture route. Advance the prewritten
   conversation or complete its remaining steps. Completion creates exactly one
   inquiry, with a summary, full transcript, team, callback task, and disclosure
   status. **Open This Inquiry in Tracker** opens that exact record. Starting a
   fresh simulation can create another record.
4. Try missed-call recovery and manual staff entry from the source cards.
5. Search and combine source, status, and urgency filters. Open an inquiry to
   update status, request type, urgency, team, callback status, next action, or
   internal notes. Refresh to check persistence. Delete an inquiry or use
   **Reset Demo Data** to restore the three fictional channel examples.

The simulator uses scripted text only. No call is placed or recorded. There is
no live AI, SMS, email, staff notification, CRM, payment, booking, or dispatch
integration. Urgent scenarios provide the supplied safety boundary and route to
human follow-up; they never diagnose equipment or promise emergency service.

## Browser storage and migration

Records are stored in localStorage under `everwarm-inquiries-v2`, in a versioned
object. Older records under `everwarm-demo-leads-v1` receive safe defaults for
new fields while retaining their original IDs, creation times, status, notes,
and activity. The old key is retained until an explicit demo reset.
Malformed stored data is not silently overwritten. If storage is unavailable,
the demo continues in memory and explains that changes will be lost on refresh.

Storage belongs to the current browser and origin. Browsers differ in their
handling of local HTML files; moving or renaming the file can result in separate
storage. Migration cannot transfer records across browser profiles or origins.
There is no authentication or server database for inquiries. This demo is not
suitable for real customer information. Sample numbers use fictional 555
numbers; the retained hero image is an illustrative AI-generated technician.

## Run and edit the source

The `source/` directory in the ZIP contains the complete React/Vinext project.
The existing architecture, dependency versions, and hosting configuration are
preserved. Use Node.js 22.13 or later.

```sh
npm ci
npm run dev
npm test
npm run lint
node scripts/build-offline.mjs
```

`npm test` runs the production build and all test files. `npm run build` runs
the build alone. The standalone builder produces `deliverables/EverWarm-Demo.html`
from the same page and components as the source app.

Key files: `app/page.tsx`, `app/globals.css`, `lib/inquiries.ts`, and
`components/everwarm/`. The two obsolete starter tests have been replaced with
EverWarm domain/storage tests and tests against the actual rendered build.

## Standalone startup repair

Fixed a confirmed React #130 startup failure caused by the standalone bundler
resolving `next/image` differently from the working Vinext application. The
offline build now uses the same Vinext image compatibility module and explicitly
provides its build-time configuration. A regression test renders the homeowner
page through the actual offline bundler settings, including the image component.
The regenerated HTML was opened in the browser and its call flow was checked.

## Lint repairs

Browser-local records now use a cached external store subscribed through React's
`useSyncExternalStore`, keeping storage access out of rendering and eliminating
synchronous state updates from effects. Hash navigation uses the same subscription
pattern, including direct links and the skip-to-content target. Navigation actions
use the location API; next-action drafts reset through a record/value key. Icon
pairs have explicit Lucide types, and the unused import is removed.

The existing compressed WebP is rendered through the framework Image component.
It remains `unoptimized` deliberately: the source must work without an image
optimization service, and the standalone build embeds the image as a data URL.
No lint rules, exclusions, or inline suppressions were added or changed.

Six regression tests cover initial storage subscriptions, SSR snapshots,
persistence, corrupt-data protection, blocked storage, reset cleanup failures,
and hash navigation. Earlier browser checks below describe the prior feature
verification; this lint repair was verified by the full automated suite.

## Validation

- Production build and all 25 automated tests passed.
- `npm run lint` passed with zero ESLint errors and zero warnings. The ESLint
  configuration, package scripts, dependencies, and lockfile are unchanged.
- Coverage includes required homeowner fields, optional email, website source
  defaults, all four scripted scenarios in both call-source modes, manual entry,
  safe legacy migration, blocked writes, corrupt data protection, combined
  filtering, unique IDs, timestamps, persistence, notes, and reset seeds.
- Manually exercised form → confirmation → tracker; after-hours and missed-call
  simulation → summary → exact inquiry; source/urgency filters; manual entry;
  status and notes; refresh persistence; and reset.
- Inspected layouts at approximately 375, 768, and 1440 pixels. No page-level
  horizontal overflow was observed; mobile navigation and stacked tracker cards
  were checked. The mobile standalone summary was also inspected.
- Standalone simulation succeeded with storage blocked in a sandboxed frame,
  displayed the memory-only warning, and opened the new inquiry in the tracker.
- No application console errors were observed; browser-extension metadata
  errors were unrelated to the app.
- An additional standalone TypeScript check reports existing Cloudflare ambient
  type gaps (`cloudflare:workers`, `Fetcher`, and `D1Database`) in the starter
  server files. These do not block the production build or test suite.

## Real implementation requirements

A real installation requires client-selected calling software, phone numbers,
CRM subscriptions, credentials, routing and escalation rules, staff handover,
and approved privacy, recording, consent, and retention language. The owner
workflow lists the proposed implementation scope. No compliance or business
performance guarantees are made.

No website has been published. Site registration previously failed because the
project owner was not linked to an account; the hosting configuration remains
unchanged. The standalone HTML can be opened directly without that service.
