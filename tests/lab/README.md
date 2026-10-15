# OLED Night test lab

Public gallery: https://bc1224.github.io/oled-night/lab/

46 synthetic cases cover the component matrix and previous site failures. The current gallery is built from the same committed fixtures used by the browser regressions. It contains no copied accounts or private report uploads.

## Every reported bug becomes a regression

For each reported rendering failure, reconstruct the relevant markup and states using synthetic text and artwork. Add that fixture to this public gallery and run its behavioral assertions against the packaged extension in Chrome and Firefox. Prove the assertion fails on the affected old runtime before fixing it. Include Automatic mode on native dark pages, the triggering hover/focus or dynamic update, media preservation and disable restoration where relevant. A gallery example without executable assertions is not complete regression coverage. Keep private reports, mail and broker account content out of fixtures and release assets.

The email-newsletter and native-banner cases reproduce dark newsletter text and light tour text on a white onboarding banner. Both are included in the required component checks in Automatic and Recolor modes; explicit Deepen keeps native light content. The fixtures model the reported symptoms, not authenticated Gmail or Robinhood sessions.

The booking-form case checks primary filled-value ink, distinct readable placeholders, focus, masked icons, named colored logos, disabled fields, ordinary-image preservation and native restoration. It contains only fake guest information.

Cold-shadow coverage attaches roots after the host has already been processed, then checks resting controls before pointer/focus input. Both engines must discover the roots without waiting for interaction. The performance workload includes 400 custom hosts that never attach roots. The report-preview case and popup regression check consent, public-data exclusions and cancel behavior; raw reports are never published in this lab.

## Run

The **Mail-style animated updates** case (`/lab/#paint-updates`) and **Checkout** case (`/lab/#checkout`) reproduce resource and payment-control regressions using fake data. The mail page has a manual frame measurement and component mount/remove controls. CI performs three counterbalanced native/active animation runs in each browser: median frame throughput ≥70% of native, p95 gap ≤max(34ms, native×1.5), and no active frame gap ≥150ms. Chrome additionally requires at most 2.25 style passes per animation tick and under 8ms script work per tick. After one warm-up, five mount/remove cycles must grow collected JS heap by less than 1MiB and collected DOM node count by fewer than 512. Both browsers must release all 160 detached shadow roots within 80ms on each of six cycles. These resource checks are part of the required lab commands, so failing them blocks website and extension deployment. Heap figures describe the disposable renderer, not total browser process RAM or every real site.

Checkout assertions cover monochrome SVG/raster payment icons, preserved brand colors and imagery, enabled input contrast, native restoration, desktop/mobile layout and height animation without pale opening frames. No payment is submitted. Reporting assertions verify the disclosure, Cancel, explicit Send and duplicate-click handling without contacting GitHub.

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

The large inbox case also checks that private row paint variables do not inherit into every descendant. Only element paint is isolated; the theme controls continue to inherit. Generated text and placeholders explicitly inherit their own paint values, with readability covered in both browsers. This prevents duplicate inherited style data without changing the browser's native text inheritance. The public case exposes frame pacing, sustained updates and six component mount/remove cycles; its optional heap reading is approximate and does not force GC. Chrome runs the large frame, script, style and collected-memory gates at both 1,200px and 390px viewport widths. Firefox separately verifies its desktop viewport and runs the same frame and detached-root budgets.

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

The CVS synthetic regression runs separately as `node tests/lab/run-cvs.mjs` and exits nonzero on any failed expectation. Explicit late-root ordering made the old runtime fail all 15 pale-hover expectations. Version 0.6.40 also tests stylesheet edits queued in later event microtasks: Chrome samples deferred native hover and Firefox samples native focus. These edits have no DOM mutation for MutationObserver to see. Interaction styles are read at the frame boundary after handlers; ordinary mutation batches retain their pre-paint microtask path. Failures remain visible beside the live receipt and separate from the component total. Website deployment may publish this evidence, but the **CVS extension release gate** fails the overall Tests workflow if the synthetic regression fails. The exact-source store gate requires that overall workflow to pass; publishing the tester cannot authorize a failing binary release.

The original churn benchmark now uses the same seeded row mutations in three fresh, counterbalanced active/native pairs. Median throughput must remain at least 70% of native throughput; any active stall at or above 150 ms fails. Every pair is logged. This reduces scheduling noise without relaxing either budget or automatically retrying a failing run. Tests on a branch supersede older tests on that same branch; npm downloads are cached, and jobs have a bounded timeout.

The **Large updates** gallery case also runs the unchanged seeded workload over 2,500 fake inbox rows in Chrome and Firefox. It checks offscreen paint retention, viewport refresh, new text, replaced inline styles, late layout-rule fallback and detached queue cleanup. Ordinary already-styled offscreen rows can retain their current dark paint until IntersectionObserver reports them near the viewport. Layout/generated rules, media, custom elements, uncertain sheets and new content remain eager; a jump may briefly retain the previous dark shade, never remove its overrides. Pending work is capped at 2,048 branches and observation at 4,096 containers, without a polling timer. Chrome additionally enforces at most 2.25 style passes and less than 8ms script work per update. The existing animation-frame, collected heap and detached-shadow tests remain mandatory. These fixtures do not prove authenticated Gmail performance.

In a complete simple stylesheet scope, a repeated container's selection class can update just its background when the old and new surfaces are opaque, neutral and light, and every descendant keeps the exact same mapped ink tier. New text retains native measurement unless a complete non-animated scope proves it is an ordinary unstyled leaf inheriting a correctly mapped parent. Content in closed slots always retains measurement. Snapshots belong to at most 4,096 retained containers; they are not shared across rows. Geometry observation is sampled once, then retained for at most 64 branches with postponed paint; overflow is repainted eagerly. Descendant edits invalidate ink proofs before processing the entire mutation delivery, including a simultaneous selection change. Each snapshot retains at most two neutral-background proofs. CSSOM fingerprints invalidate them after stylesheet edits. Descendant selectors, generated paint, conditional/unreadable/large sheets, animations, inline styles and changed text tiers retain native measurement; moving paint also disables offscreen retention. The executable case checks the fast path, CSSOM invalidation, descendant rules and animated fallback. Removing a plain text leaf releases only its own pending ownership; detached component subtrees still trigger immediate cleanup.

Saved Bitwarden credential filling, real CAPTCHA completion, image-backed hero text and authenticated pages still need targeted live QA. The lab reduces manual work; it cannot guarantee compatibility with every changing website.

The large-inbox case also checks pointer crossings over plain rows and conservative repaint in uncertain scopes. Chrome frame measurements keep a real pointer over the moving inbox. Component cleanup includes rows emptied in one mutation delivery and removed in a later delivery, so a subtree sweep cannot hide retained row shells. Both browsers assert that extension-owned row counts return to their starting value; the public cleanup button runs the same lifecycle.

Nested CSS and content beneath custom/slot/part boundaries retain native measurement. The fixture checks newly inserted text in a nested rule and a closed slot, and a page style write arriving after an extension background write. Color-only shorthand defaults are compared with each browser's own serialization; this allows the same bounded optimization in Firefox without admitting images or other paint/layout declarations.

Document-only selection and inherited-ink proofs also reject ordinary closed hosts. This checks root presence without inspecting or styling an unknown root, and caches that boolean only within a delivery. If that check is unavailable, the proof fails closed. Later explicit dark ink on a streamed leaf is checked separately. The closed-slot cases include ordinary hosts, custom hosts and selection ink.

The companion theme remains 1.0.3. Extension changes require the full release gates and separate store submission receipts.

Proven neutral selection changes can use shared background declarations instead of mutating inline CSS on every update. The palette is primed before updates and capped at 128 declarations; unknown paint falls back to normal measurement and inline writes. It retains the same stylesheet, closed-root and ink proofs. Tests check distinct resting/selected paint, later page writes, framework removal, native restoration on disable and the palette bound. Memory and frame budgets remain unchanged.

The frame-created navigation case also focuses a transparent link inside an animation callback. Both browsers inspect its completed current frame, before another callback can repair it. They also check native-dark focus that replaces light ink while its background stays overridden. Exposed interaction paint is repaired at the current microtask checkpoint and its changed path is checked once more at the next frame boundary for later CSSOM edits. Leaf controls with both background and ink protected retain one coalesced pass. This retains the deferred-CSSOM hover/focus and mutation-coalescing checks and avoids waiting a frame to darken native focus paint.

Idle observer ownership is sampled after two rendering opportunities following re-enable, allowing initial one-shot geometry delivery. A fixed timer alone can expire during the synchronous scan. The 64 idle/pending observation limit and all frame, heap and cleanup budgets remain unchanged.
