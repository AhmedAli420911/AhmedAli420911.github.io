# Verification results — Service Capture Co. revision

Verified 10 September 2026 against the supplied Service-Capture-Co-Complete-Project(1).zip. The existing agency was modified. No website was published, domain purchased, paid service connected or real integration created.

## Final command results

| Check | Result |
|---|---|
| `npm run build` | PASS — framework production build regenerated, exit 0 |
| `npm test` | PASS — 22 tests, 0 failures, 0 skipped; static and standalone outputs rebuilt first |
| `npm run lint` | PASS — no ESLint errors or warnings, exit 0 |
| `./node_modules/.bin/tsc --noEmit` | PASS — no TypeScript diagnostics, exit 0 |
| `npm run build:preview` | PASS — static export and standalone preview regenerated, exit 0 |

Exact final logs are included in `agency-source/verification/`. Dependencies, lockfile, ESLint rules and TypeScript configuration were preserved. Shell script executable permissions were restored after ZIP extraction. No rules were disabled, weakened or suppressed. The initial supported builder helper passed with a proxy-environment notice; the final build ran without proxy environment variables and produced no warning. Vinext prints its existing informational route-classification limitation; the explicit static export contains every requested route.

## Automated checks actually performed

- Required five-field state, individual validation, invalid email and maximum lengths; preparation schema accepts only four text fields, with consent left to the visitor.
- Invalid submissions and unconfigured endpoints never reach the supplied transport.
- JSON payload includes only fullName, email, company, problem, consent and consentText, even if an older caller supplies removed fields.
- Explicit boolean accepted:true is required on a successful HTTP response. HTTP errors, empty/HTML/invalid/unacknowledged responses, network errors and timeouts cannot produce success.
- Credentials omitted and redirects rejected. Pending guard, disabled fieldset, error preservation and success-only reset were also reviewed in the existing component code.
- Every internal navigation URL and section anchor in all six rendered agency pages resolves, including the custom 404's home link; demo fragments are separately checked for system-demo.
- Both primary hosted demo links use /demo/#system-demo and safe new-tab attributes. Executing the actual standalone opener with controlled browser primitives confirms blob URL + #system-demo and unchanged blob contents.
- All numeric agency font-size declarations are at least 12px. Main explanation, control, workflow and mobile-input overrides were inspected.
- Pricing limits, support details and new FAQs are present. Legal pages remain explicitly marked for professional review. No empty contact links, inactive analytics scripts or fabricated structured data are emitted.
- Standalone JavaScript parses, has no unresolved Node globals, and contains no external script or stylesheet references. The package integrity check additionally verifies no external image, stylesheet or script assets are required.
- Production and embedded EverWarm bytes match the supplied standalone SHA-256 exactly:
  `beb3ce38181426458a36a27fcc60af9604c44dc015ca0e71f7e68e4f0bc6acc8`

## Browser checks actually performed

- Reviewed desktop, 375px mobile and 768px tablet appearance; workflow text, mobile pricing, form, navigation and legal notices were inspected. Homepage and Privacy measured without horizontal overflow at 375px, 768px and 1440px iframe widths. With a 15px scrollbar their measured client/scroll widths were respectively 360/360, 753/753 and 1425/1425. These are CSS viewport checks, not physical-device tests.
- Desktop rendered text audit found no visible text below 12px. Mobile form inputs measured 16px; privacy review-notice copy measured 16px at all three widths.
- Empty form submission displayed five associated errors and focused fullName. Invalid email displayed its field error. Valid fictional details with consent produced the honest not-connected/not-sent message; entered information was preserved. The standalone also displayed the required-field errors.
- Mobile menu opened, followed a review link, and closed with Escape from a navigation link, returning focus to its toggle. Visible focus measured 3px. FAQ opened with Enter and retained a visible 3px outline.
- Homepage and Interactive Demo guide buttons each opened a tab at /demo/#system-demo with the business-owner heading. From there after-hours simulation, missed-call recovery, manual-entry dialog, inquiry tracker and return to the fictional homeowner website were opened. Fictional/no-live-action warnings remain visible.
- The self-contained preview rendered, its Privacy, Terms and Accessibility navigation worked, and its button opened an embedded blob tab ending in #system-demo, with the EverWarm business-workflow title.
- Inspected agency, hosted EverWarm and standalone console logs: no application errors were observed. Browser-extension metadata errors were present and are unrelated to the application.

## Limitations and launch checks

Browser automation intermittently timed out while inspecting iframe documents and some navigation transitions. Homepage and Privacy width measurements and the visual checks listed above completed; separate numeric overflow measurements for every other route did not complete. No claim is made of exhaustive browser/device or assistive-technology coverage. The skip-link focus inspection did not complete, though its target and visible-focus CSS were checked in source and generated navigation tests.

The embedded blob tab's URL/title and unchanged content were verified; interactions inside that blob tab were not automated. Equivalent interactions were exercised on the identical hosted demo. OS-level double-click behavior and mobile download/file-preview apps were not testable here; extract the ZIP and open START-HERE.html in a normal browser. Popup settings may require opening the separate EverWarm-Demo.html instead.

The optional WebMCP preparation schema and registration code were reviewed and its schema tested; real browser tool registration/execution was not tested. Accepted responses and failures were controlled transport tests, not live form delivery. Pending/duplicate prevention and success-only form clearing were preserved and source-reviewed, not exercised against a real endpoint. Verify delivery, CORS, server validation, abuse protection and true acceptance after an endpoint is selected. No external integration was connected for testing.

The supplied EverWarm source and its earlier validation history are preserved unchanged. Its independent dependency installation/build/test suite was not rerun in this agency-only revision; this revision specifically preserves its HTML byte-for-byte.

Before public launch, supply real domain/contact details, mailing address and a tested form endpoint; optionally supply a calendar. Approve providers, retention/deletion practices, consent approach and professional review of legal drafts. Analytics remains inactive. Final client scope and integration compatibility require the System Review and client approval.
