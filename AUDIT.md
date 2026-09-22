# OLED Night 0.6.10 audit — September 22, 2026

Scope: content rendering and interaction/mutation lifecycle, popup/options/settings, diagnostic privacy, background registration, Chrome/Firefox packaging, and Chrome theme palette. This is a code and regression audit, not a guarantee for every website.

## Changes

- Frameworks could remove field styles while the cache still considered them applied. Revalidate the actual marker/properties before skipping writes and repair removed overrides.
- FlightAware and Amazon used a high-specificity important selected-row/accordion rules that defeated the shared override. Raise generic rule specificity, while keeping intended Apple/Gmail/RES profile precedence and measurement exclusions.
- New sections waited for an idle callback, sometimes after a white frame. Batch before the next paint instead, with a timer fallback for hidden documents.
- Separate site sliders/on-off from global defaults. Merge pending slider patches and serialize saves so a quick second adjustment cannot discard the first. Explain what sliders change and when native-dark colors are preserved.
- Figma is off by default; explicit on/recolor/invert also use native-color protection with no recoloring stylesheet, DOM traversal or mutation observer. Color-critical canvas, controls and swatches retain original colors. It is deliberately not forced black.
- Preserve native color inputs and identifiable picker/swatch subtrees on other sites. Unlabeled custom color controls cannot all be recognized.
- Sanitize malformed imported settings, numeric bounds, mode names and schedules.
- Diagnostic contrast checks include fields and text-fill, omit field/editable contents, and ignore transparent icon text. Ordinary visible text snippets remain limited to 30 characters; reports stay local unless the user shares them.

## Review boundaries

Chrome theme 1.0.2 is declarative and has no scripts or permissions. Seven configured text/background pairs meet 4.5:1. Chrome controls native tab separators/outline behavior, so palette tests do not prove every browser/OS rendering.

Runtime packaging uses explicit file allowlists; diagnostic reports, test profiles and benchmarks are excluded. Firefox has its own generated manifest. No new permissions or telemetry were added.

Live Maps and FlightAware evidence established the symptoms and FlightAware selector. Regressions reproduce the shared failure patterns in isolated browsers; the release has not been installed into the user's live tabs. Refresh existing tabs after updating. Autofill coverage uses simulated native states, not saved credentials. Inline-important site styles and unusual drawing/custom controls can still need reports. No universal no-flash claim: browser navigation paint and late CSS remain outside some content-script timing paths.

Performance: see PERFORMANCE.md and raw benchmark JSON. OLED Night was approximately twice the browser CPU cost of Dark Reader on the synthetic high-churn case; do not market it as lighter. Figma native-color protection avoids recoloring work.

Validation: all unit suites passed; Chrome 95/95; Firefox 42/42; Firefox lint zero errors, warnings or notices. Bounded color-cache correctness includes eviction and mutable-input coverage.
