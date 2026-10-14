# Mixed content and form regression audit: 0.6.39

## Cause and changes

Automatic mode treated most native dark pages as a single dark surface. Plain white content islands could escape background mapping while their ink changed. Dark authored newsletter text could also remain dark inside an already-dark reader. The engine now pairs neutral content panels with their local ink and repairs unreadable neutral ink on solid dark backdrops. Explicit Deepen mode preserves native light panels. Image-backed creatives, readable native text and colored status indicators retain their existing behavior.

Enabled form values now use primary text brightness, including WebKit text fill. Placeholders and disabled fields retain separate treatment. Compact logo detection now includes CSS identifiers and semantic logo labels; colored logos gain a light edge without color inversion. Ordinary photos remain unfiltered.

## Reproduction and tests

The packaged 0.6.38 extension failed the synthetic newsletter, onboarding banner and booking-form reproductions. The public audit itself also had a reproduced false pass: it checked `color` while WebKit painted a different `-webkit-text-fill-color`. Its unit regression now checks the actual painted ink. Filled values at 5.97:1 were technically contrasting but still muted; the new primary-value check detects that distinction.

The public lab contains 40 synthetic cases, including `email-newsletter`, `native-banner` and `booking-form`. Both browser adapters run their rendered behavior checks. Coverage includes Automatic, explicit Recolor and Deepen where applicable, mobile and desktop Chrome, dynamic text insertion, functional controls, focus outlines, placeholders, masked icons, logo edges, media preservation and restoring original rendering when disabled. Every new user-reported bug must acquire a synthetic case and an executable regression, with an old-version failure where reproducible.

Focused command: `node tests/lab/run-mixed-surfaces.mjs`. Full gates: unit tests, original Chrome and Firefox regressions, Firefox lint, both lab adapters, reviewed visual baselines and CVS synthetic/live checks. No test thresholds or visual baselines were relaxed.

Local evidence is retained under `D:/Temp/oled-0639-*.log`, including red failures, green reproductions and final suite results. Exact source CI and store receipts are recorded in `STORE_SUBMISSION.md` after release.

## Evidence limits

These are minimal synthetic models of the reported symptoms, not copies of private email, brokerage or booking pages. The attached reports identified installed 0.6.36 on Robinhood and SynXis. SynXis's report showed no low-contrast audit findings; the primary-value regression explains why a gray value could pass a minimum contrast check. Actual authenticated Gmail/SynXis behavior and the owner's installed Chrome version remain unverified: the Chrome debugging bridge rejected the current connection as incompatible. A rebuilt local folder does not prove that the running owner extension reloaded.

The report-to-GitHub-to-Codex pipeline remains unimplemented. Local diagnostic reports can contain page text and identifiers, so raw reports must not be published automatically. The user's decision on scrubbed issue review versus explicitly authorized gated automatic releases is pending. This does not block the interactive bug-fix release already authorized.

No new permissions. The separate theme remains 1.0.3 and is not resubmitted.
