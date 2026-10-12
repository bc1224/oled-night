# YouTube inline paint audit — 0.6.33

## Report and cause

The newest [issue #1 comment](https://github.com/bc1224/oled-night/issues/1#issuecomment-6117786196) reports unreadable expanded descriptions. On the actual [PCMag video](https://www.youtube.com/watch?v=Uh3fnIgjVMo), YouTube's Light renderer supplies `rgb(19,19,19)` directly on attributed spans. Those values bypass the native dark palette used by OLED Night. The signed-in browser baseline also exposed black literal SVG paint in the animated like button.

CSS now maps known neutral attributed ink to the configured foreground. Highlight backgrounds and their nested ink remain paired, authored hues remain unchanged, and chapter links use native dark blue. The unpressed like animation receives visible paint; masks, accent paths and pressed inverse buttons stay native. Live QA additionally caught a light search-button background with a pale icon; the button now uses YouTube's dark surface token.

An initial highlight exemption was too broad: any ancestor style containing the word `background` disabled the text rule. Live QA caught this before release. The exemption is now confined to backgrounds within the attributed text, and the fixture includes an ancestor background custom property and a nested highlight.

## Verification

- Red reproduction: the new description/icon fixture fails against the previous runtime. A separate ancestor-background fixture reproduced four failures in the first candidate. Search/button and chapter-link assertions also failed before their fixes.
- Final local Chrome: **227 passed, zero failed**; Firefox: **85/85 passed**. All **11 unit test files** passed. Firefox package validation: zero errors, notices or warnings. Archives have no reserved metadata folders.
- Broad checks cover menus, focus/hover churn, forms, borders, cards, sprites, SVGs, ratings/progress, frames, captcha exemptions, protected autofill overlays, shadows, media, settings and popup controls.
- Actual public YouTube in a fresh Chrome profile loaded **0.6.33**: expanded neutral description paint changed from `rgb(19,19,19)` to `rgb(224,224,224)`; search button background became `rgb(39,39,39)` with `rgb(224,224,224)` ink. Live probe plus focused fixture: **41 passed, zero failed**. Desktop and 390-pixel fixture screenshots inspected; player geometry and colors preserved. The user's native Dark preference was restored after baseline inspection.
- Evidence stays local: `D:\Temp\oled-chrome-0633-release.log`, `oled-firefox-0633-release.log`, `oled-0633-live-final.log`, `oled-0633-live-youtube.png`, `oled-0633-desktop.png`, `oled-0633-mobile.png`. Private browsing/account data is absent from release assets.

## Limits and rollout

No body observer, page traversal, interaction handler, permission or generic recoloring change was added. This release retains 0.6.32's interaction optimizations; it does not establish that every site's intermittent delay is eliminated. The companion theme remains 1.0.3.

The personal Chrome MCP lists unpacked extensions only. At this audit it listed the theme, and reloading the previously verified OLED Night ID returned “not found.” That does not establish that the user's store-installed extension is missing, and no local update is claimed. Firefox developer-page navigation returned `ERR_INTERNET_DISCONNECTED`; store receipts and any remaining blocker are recorded in `STORE_SUBMISSION.md` after release work.
