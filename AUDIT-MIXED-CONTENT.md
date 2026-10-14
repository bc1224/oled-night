# Mixed content and form regression audit: 0.6.39

## Cause and changes

Automatic mode treated most native dark pages as a single dark surface. Plain white content islands could escape background mapping while their ink changed. Dark authored newsletter text could also remain dark inside an already-dark reader. The engine now pairs neutral content panels with their local ink and repairs unreadable neutral ink on solid dark backdrops. Explicit Deepen mode preserves native light panels. Image-backed creatives, readable native text and colored status indicators retain their existing behavior.

Enabled form values now use primary text brightness, including WebKit text fill. Placeholders and disabled fields retain separate treatment. Compact logo detection now includes CSS identifiers and semantic logo labels; colored logos gain a light edge without color inversion. Ordinary photos remain unfiltered.

## Reproduction and tests

The packaged 0.6.38 extension failed the synthetic newsletter, onboarding banner and booking-form reproductions. The public audit itself also had a reproduced false pass: it checked `color` while WebKit painted a different `-webkit-text-fill-color`. Its unit regression now checks the actual painted ink. Filled values at 5.97:1 were technically contrasting but still muted; the new primary-value check detects that distinction.

The public lab contains 43 synthetic cases, including `email-newsletter`, `native-banner` and `booking-form`. Both browser adapters run their rendered behavior checks. Coverage includes Automatic, explicit Recolor and Deepen where applicable, mobile and desktop Chrome, dynamic text insertion, functional controls, focus outlines, placeholders, masked icons, logo edges, media preservation and restoring original rendering when disabled. Every new user-reported bug must acquire a synthetic case and an executable regression, with an old-version failure where reproducible.

Focused command: `node tests/lab/run-mixed-surfaces.mjs`. Full gates: unit tests, original Chrome and Firefox regressions, Firefox lint, both lab adapters, reviewed visual baselines and CVS synthetic/live checks. No test thresholds or visual baselines were relaxed.

Local evidence is retained under `D:/Temp/oled-0639-*.log`, including red failures, green reproductions and final suite results. Exact source CI and store receipts are recorded in `STORE_SUBMISSION.md` after release.

## Evidence limits

These are minimal synthetic models of the reported symptoms, not copies of private email, brokerage or booking pages. The attached reports identified installed 0.6.36 on Robinhood and SynXis. SynXis's report showed no low-contrast audit findings; the primary-value regression explains why a gray value could pass a minimum contrast check. Actual authenticated Gmail/SynXis behavior and the owner's installed Chrome version remain unverified: the Chrome debugging bridge rejected the current connection as incompatible. A rebuilt local folder does not prove that the running owner extension reloaded.

The owner explicitly authorized gated automatic releases. Public reporting now previews allowlisted diagnostics and opens a GitHub draft after consent; the reporter submits it on GitHub. Raw reports stay local. The automatic-release contract requires reproduced failure, synthetic regression, independent read-only review, exact-source CI and store API receipts. The owner approved the configured read-only gpt-6-luna reviewer. The hourly automation requires its independent acceptance before any release. End-to-end autonomous repair/release is not yet demonstrated.

No new website access permissions. Firefox declares optional domain/technical reporting and requests native consent before opening a draft; decline/unavailable consent fails closed without disabling dark mode. The separate theme remains 1.0.3 and is not resubmitted.

## Cold-root and performance investigation

Linux CI exposed resting nested controls that had no OLED marker until pointer input. Late attachShadow does not produce a light-DOM mutation; bounded custom-host discovery now checks 16 hosts per visible frame without page-wide style/layout reads. Both adapters assert late-root readability before input. The initial exact-source CI failure is retained (38509605509); diagnostic Linux run 38510328372 confirmed unstyled controls rather than a text-fill mismatch.

A local churn gate failed at 65 percent native throughput. Focused CPU profiles also reproduced a 67 percent result on the pre-discovery runtime with zero custom hosts, so discovery alone does not explain that result. Trials of computed-style handle reuse and inline-property write suppression did not establish an improvement and were discarded. The bounded optimization instead skips empty before/after reads only when a complete small readable authored scope has no matching selectors. It rescans every batch; imported, unreadable, large, slotted and exported-part scopes retain conservative reads. New CSSOM/adopted-sheet regressions protect later generated labels. Original 70 percent throughput and 150 ms stall budgets remain unchanged. Final-source CI remains mandatory.
