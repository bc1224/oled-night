# OLED Night test lab

Public gallery: https://bc1224.github.io/oled-night/lab/

43 synthetic cases cover the component matrix and previous site failures. The current gallery is built from the same committed fixtures used by the browser regressions. It contains no copied accounts or private report uploads.

## Every reported bug becomes a regression

For each reported rendering failure, reconstruct the relevant markup and states using synthetic text and artwork. Add that fixture to this public gallery and run its behavioral assertions against the packaged extension in Chrome and Firefox. Prove the assertion fails on the affected old runtime before fixing it. Include Automatic mode on native dark pages, the triggering hover/focus or dynamic update, media preservation and disable restoration where relevant. A gallery example without executable assertions is not complete regression coverage. Keep private reports, mail and broker account content out of fixtures and release assets.

The email-newsletter and native-banner cases reproduce dark newsletter text and light tour text on a white onboarding banner. Both are included in the required component checks in Automatic and Recolor modes; explicit Deepen keeps native light content. The fixtures model the reported symptoms, not authenticated Gmail or Robinhood sessions.

The booking-form case checks primary filled-value ink, distinct readable placeholders, focus, masked icons, named colored logos, disabled fields, ordinary-image preservation and native restoration. It contains only fake guest information.

Cold-shadow coverage attaches roots after the host has already been processed, then checks resting controls before pointer/focus input. Both engines must discover the roots without waiting for interaction. The performance workload includes 400 custom hosts that never attach roots. The report-preview case and popup regression check consent, public-data exclusions and cancel behavior; raw reports are never published in this lab.

## Run

```sh
npm ci
npm run package
npm run test:lab:chrome
npm run test:lab:firefox
npm run build:lab
node tools/lab-report.mjs
node tests/lab/run-cvs.mjs
node tests/lab/live-smoke.mjs --cvs
node tools/live-report.mjs
```

Both adapters load the packaged extension into disposable browser profiles. Their temporary loopback servers are owned by the test process and closed at exit; no persistent watcher or helper is installed. Chrome uses a fresh debugging pipe; this never attaches to everyday Chrome or changes its extension.

Chrome checks light/dark originals, desktop/mobile rendering, real pointer hover, nested focus, toggles, modals, dynamic content, and extension disable/re-enable. Firefox runs the shared state and timing workload with the Firefox package. Existing Chrome/Firefox regressions remain required alongside the matrix. The repeated state assertions are checks, **not a count of distinct components or sites**.

Text checks use 4.5:1 contrast (3:1 for disabled examples); data fills use 3:1 against their track. The 1.25:1 boundary threshold is a regression heuristic, not a WCAG conformance claim. Transparent solid backgrounds are composited over their ancestors. Image/gradient backdrops, text shadows and closed roots need their targeted regressions or visual review.

CSS samples check animated navigation stays dark; completed-frame hover samples and resting screenshots provide additional evidence. These are not a recording of every displayed frame. The synthetic menu budget is 250 ms per sample, median overhead under 80 ms versus the same page with the extension off, and content-update event-loop stalls below 120 ms absolute / +80 ms versus native. These budgets detect regressions on the test machine; they do not promise every website opens in that time.

## Reviewed screenshots

Baselines live under `baselines/win32` and `baselines/linux`. Default test runs compare against them and fail if missing or if over 0.5% of pixels differ (per-pixel threshold 0.15). Dimensions must match. A large light/dark regression is tested against the comparator itself.

For a deliberate visual change, run `node tests/lab/run-chrome.mjs --candidates`, or dispatch **Screenshot candidates** for Linux (**Tests** with `candidates=true` also works). Review the candidate PNGs and behavioral results, then copy approved images into the matching baseline directory. Candidate runs cannot deploy, produce a public passing receipt, or satisfy the store gate. CI never regenerates its approved baselines.

## Adding a reproduction

```sh
node tools/capture-component.mjs --url https://public.example/ --selector .navigation-item
```

The tool uses an anonymous profile. It exports only an allowlist of computed appearance/layout properties and synthetic labels, with rest/hover/focus snapshots. It omits source text, passwords, IDs, attributes, scripts, links and original images. It rejects whole-page selectors and components over 300 elements. Outputs stay in ignored `dist/captures`; they are never published automatically. Review them and reconstruct the relevant interaction CSS/JavaScript before adding a committed fixture and an expectation that first reproduces the failure. Snapshots alone cannot reproduce hydration, site code or authentication.

Add cases to `catalog.mjs`. Public build requires a Git checkout and copies only tracked website files, checked-in HTML/SVG fixtures, the matrix and audit code. Untracked captures are excluded; unexpected files in an existing output directory stop the build, so use a fresh directory rather than publishing stale output. Each catalog entry states its coverage and limitation. Historical cases without matrix annotations show a note; they do not receive a generic passing contrast badge.

## Release / live evidence

Main-branch **Tests** must pass unit tests, the existing browser suites, Firefox lint, the new matrix, timing budgets and reviewed visuals. Only then can the website deploy. Store submission requires a successful main-branch test run for the exact tagged SHA and a retained lab evidence artifact. A previous policy without lab evidence is insufficient.

`npm run test:lab:live` (or **Live site smoke**) checks anonymous Apple, CVS, Amazon and Reddit navigation in a fresh Chrome profile. It saves hostnames and result summaries, never page text, account data or cookies. This is a small smoke test, not a full-site audit. The live gate requires at least two distinct reachable sites and rejects any observed pale hover or an inactive extension on a ready page. Provider challenges and unavailable controls remain explicitly unverified and never count toward that minimum. Extension submissions run it before upload; the companion theme does not run extension-only smoke checks.

### CVS intermittent hover coverage

Open the **CVS · repeated navigation hover** case (`/lab/#cvs-hover`). The automated scenario explicitly waits for an empty host to be scanned before attaching two nested roots. Chrome runs 5 hydration cycles × 3 real sibling moves, checking actual `:hover`, text contrast and 24 completed-frame CSS samples per move. Sampling is armed **before** native pointer input. An injected pale hover proves the monitor can fail. Firefox additionally runs 30 native-focus checks over late roots and replaced sheets in light/dark originals. Version 0.6.37 fixes the reproducible missed-root discovery: first interaction installs scoped listeners/styles and scans the new component before the next paint. This is a general engine correction; the fixture is synthetic, not an exact saved CVS page.

Every Tests run performs a separate anonymous `node tests/lab/live-smoke.mjs --cvs`: 5 rounds over up to 5 visible navigation targets with the same entry sampler. The gallery publishes an exact-source/time live receipt with PASS-this-run, FAIL or UNVERIFIED. Earlier failures remain recorded; passing synthetic coverage cannot guarantee every live page state. CSS sampling is not a pixel/video proof of every rendered frame. A failing live check exits nonzero and blocks extension store upload through the live submission gate. The gallery identifies the 0.6.37 engine fix while retaining failing and unavailable receipts.

The CVS synthetic regression runs separately as `node tests/lab/run-cvs.mjs` and exits nonzero on any failed expectation. Explicit late-root ordering made the old runtime fail all 15 pale-hover expectations; the fix passes all 33 checks. Failures remain visible beside the live receipt and separate from the component total. Website deployment may publish this evidence, but the **CVS extension release gate** fails the overall Tests workflow if the synthetic regression fails. The exact-source store gate requires that overall workflow to pass; publishing the tester cannot authorize a failing binary release.

The original churn benchmark now uses the same seeded row mutations in three fresh, counterbalanced active/native pairs. Median throughput must remain at least 70% of native throughput; any active stall at or above 150 ms fails. Every pair is logged. This reduces scheduling noise without relaxing either budget or automatically retrying a failing run. Tests on a branch supersede older tests on that same branch; npm downloads are cached, and jobs have a bounded timeout.

Saved Bitwarden credential filling, real CAPTCHA completion, image-backed hero text and authenticated pages still need targeted live QA. The lab reduces manual work; it cannot guarantee compatibility with every changing website.

The companion theme remains 1.0.3. Extension changes require the full release gates and separate store submission receipts.
