# Nested component interaction audit — 0.6.36

## Cause and repair

CVS navigation is implemented with nested open shadow roots and constructed stylesheets. Its subtle links have transparent resting backgrounds and a pale `rgb(227, 241, 255)` hover background. When the pointer moves between children inside one root, browsers retarget both event endpoints to the same host outside that root and suppress the outer event path. OLED Night only listened on document, so the first link updated and later links escaped recoloring.

A real-pointer nested-component regression failed before the repair: second and third links retained the pale native background with light extension ink. The shared engine now listens inside each managed shadow root. A weak event set prevents composed events from being processed again by nested listeners. Existing bounded control/ancestor scans and native-select exclusions remain intact. Disable and detached-root cleanup remove listeners; reenable installs them again. No site-specific CVS CSS or new polling was added.

## Evidence

- Chrome regression: pointer moves first → second → third → first; keyboard focus between links; native colors restored on disable; internal handling restored on reenable.
- Firefox regression: keyboard focus across nested links and disable/reenable behavior.
- Live public CVS in a fresh isolated Chrome profile: six successive visible header links stayed dark with readable ink. Log `D:\Temp\oled-0636-live-cvs.log`, screenshot `D:\Temp\oled-0636-cvs.png`. This does not prove the owner's existing Chrome instance has reloaded.
- Earlier Chrome run caught the stale runtime version stamp during the version bump; it was corrected and the complete final suite rerun. Keep that failed log as evidence, not a passing release gate.
- The local final run passed 256/257 checks but missed the churn tick-rate target (60 extension ticks versus 110 page-only; longest gap 42 ms). A sequential focused comparison passed the unchanged threshold for both 0.6.35 (93/107 ticks, 33 ms longest gap) and 0.6.36 (108/103 ticks, 26 ms). This suggests timing variation, not proof that the failure can never recur. The exact source's complete CI suite must pass before release. The separate quick benchmark is synthetic and reports one sample per variant, not a reliable speedup claim.
- Exact-source CI [38476973035](https://github.com/bc1224/oled-night/actions/runs/38476973035) passed 258 Chrome checks, 99 Firefox checks, all 11 unit files and lint with zero findings. Final staged Chrome package passed 5/5 live CVS hover checks (`D:\Temp\oled-0636-live-cvs-final.log`). No performance threshold was weakened.
- Seven release asset digests verified. Chrome submitted 0.6.36 and returned PENDING_REVIEW in run 38477509918. Firefox approved version 6574479/file 5118614; public API confirms 0.6.36 is public, and reviewer source attachment is present. Full package details and remaining owner-browser limits are in `STORE_SUBMISSION.md`.

## Boundaries

No new permissions, network requests, telemetry or photo processing. Theme remains 1.0.3. The change covers managed shadow trees and does not guarantee every site's visual behavior. Future QA must exercise movement between sibling controls inside components, rather than checking only the first entry from outside.
