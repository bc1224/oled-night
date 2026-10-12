# Sponsored image overlay contrast — 0.6.34

## Cause and fix

The Ralphs report identifies 0.6.33, normal recoloring, and image dimming disabled. Live DOM inspection found transparent, absolutely positioned text above a deeply wrapped responsive image. The shared backdrop resolver recognized only direct image siblings or their first child, so it applied the surrounding page's light foreground to text authored black for a yellow creative. Merely skipping recoloring would still inherit that light foreground.

0.6.34 recognizes nested image/video underlays with a local walk capped at 48 nodes, caches candidates within each processing batch, and requires actual image/overlay coverage. It pins authored text ink and preserves matching SVG CTA ink over imagery. Captions below images and opaque panels over images continue to recolor. There are no domain-specific rules, new observers, permissions, image filters, or pixel/network reads.

## Verification

- New nested bright/dark creative fixture reproduced four failures before the fix. Final focused Chrome run: 46/46.
- Final serial full Chrome suite: 235/235. Firefox: 90/90. All 11 unit files passed; Firefox lint had zero errors, warnings, and notices.
- Desktop and mobile screenshots inspected: dark ink and CTA arrow on yellow, white ink on dark blue, readable captions and opaque panels.
- An overlapping Chrome/Firefox run failed the existing churn timing gate (65 versus 119 frames). The unchanged gate passed serially: 83 versus 116 frames, worst extension frame 33 ms versus page-only 42 ms. Both logs were retained; the gate was not weakened.
- Existing YouTube, ratings, icons, dropdowns, streaming, protected autofill overlays, settings, and efficiency checks passed.

Local evidence: `D:\Temp\oled-0634-overlays-red.log`, `oled-0634-overlays-final.log`, `oled-0634-chrome-final.log`, `oled-0634-chrome-serial.log`, `oled-0634-firefox-final.log`, `oled-0634-units.log`, `oled-0634-lint.log`, `oled-0634-desktop.png`, and `oled-0634-mobile.png`.

## Boundaries and release

The existing personal Chrome tab supplied the actual Ralphs component structure on 0.6.33. Candidate live-site navigation in isolated Chrome failed with `ERR_HTTP2_PROTOCOL_ERROR`; candidate rendering is confirmed on controlled fixtures, not on the live rotated ad. Mozilla's connected developer dashboard returned `ERR_INTERNET_DISCONNECTED`. Store and owner-install receipts are recorded in `STORE_SUBMISSION.md` after release. Companion theme remains 1.0.3.
