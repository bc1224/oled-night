# Surface and state audit — 0.6.35

## Causes

The reported failures exposed shared rendering assumptions, rather than only bad site selectors:

| Boundary | Failure | Correction |
| --- | --- | --- |
| Native measurement across shadow roots | A transparent shadow wrapper containing marked controls escaped measurement during large ancestor updates. The engine read its own black override as native paint, then alternated removing and restoring it. | Measure marked descendants at shadow boundaries before deciding paint. |
| Interaction state scope | A row's hover selector changes sibling cells; rereading only the event path updates one cell while the others transition to white. | Treat HTML and ARIA rows as local state groups, including nested controls. Never promote the entire table/results layout. |
| Local surface versus document polarity | A native dark document can contain a light control state. Document-wide crush mode preserved that white state. | Recolor bright interactive regions and their text together from their original backdrop. Preserve explicit Deepen blacks only and ordinary content. |
| Media and inherited foreground | Full-bleed media can follow text, load late, or use a picture with many source children. Native ink was missed or inherited page recoloring. | Bound sibling-media discovery, ignore picture metadata in fanout, repair dependent copy when media becomes ready, and preserve native ink/logos over imagery. |
| Color guards versus layout motion | Suppressing all transitions also suppressed menu height/opacity animation. | Suppress paint transitions while retaining geometry/opacity timing, then remove temporary guards. |
| Page chrome versus raised panels | Translucent full-width menus retained light/gray paint. | Paint neutral navigation opaque black; retain distinct raised cards and borders. |

## Policy and limits

- CSS page canvas/navigation is black. Cards and controls can retain a subtle raised surface so their boundaries remain visible.
- Photos, videos, canvases, swatches, chart data, password-manager overlays and verification widgets have separate preservation rules. Blackening every painted pixel would conflict with preserving this content.
- Apple's iPhone Duo pale backdrop is baked into `hero_iphone_duo_announce__fh4u8yzndpe2_largetall_2x.jpg`. It remains pale; surrounding UI is dark and original dark text is readable. No image color replacement/filter was added.
- A version badge is insufficient proof that an already-running unpacked extension loaded changed files. Reload and verify actual paint after an update.
- This release repairs the shared boundaries above. It does not establish correctness for every custom selector, closed component or image composition on every website.

## Evidence

- Responsive-picture regression: red 59/61; green 61/61 (`D:/Temp/oled-0635-picture-red.log`, `picture-green.log`).
- Large shadow-update regression: red 61/62; green 62/62 (`D:/Temp/oled-0635-shadow-red.log`, `shadow-green.log`). Six ancestor updates, 24 sampled frames, three controls.
- Actual Apple Ads public CSS reproduces a row hover selector setting every sibling body cell's background. Isolated real-extension hover test failed with white sibling cells, then passed for every sampled frame (`D:/Temp/oled-0635-states-red.log`, `states-green.log`).
- Native dark hover test failed white background/dark text, then passed dark backgrounds with light text (`D:/Temp/oled-0635-dark-states-red.log`, `dark-states-green.log`).
- The first broad variant failed ordinary-content and explicit-deepen preservation tests. The final version limits light-region correction to interactive UI. Initial full-suite failures and a churn gate failure are retained in `D:/Temp/oled-0635-chrome-final.log`; no thresholds were weakened.
- Final Chrome: 253/253; units: all 11 files. Heavy updates: 85 extension ticks versus 119 page-only ticks; worst interval 34 ms. This is a controlled throughput gate, not a guarantee of every site's input latency. Logs `D:/Temp/oled-0635-chrome-final2.log`, `oled-0635-unit-final.log`.
- Final Firefox: 96/96, lint zero errors/notices/warnings (`D:/Temp/oled-0635-firefox-final.log`, `oled-0635-lint-final.log`). Exact-source CI [38465607917](https://github.com/bc1224/oled-night/actions/runs/38465607917) passed 254 Chrome checks (additional system-theme branch), 96 Firefox checks, all 11 unit files and clean lint.
- Exact clean staged package on public Apple: 10/10 checks; native readable HomeView/iPhone Duo ink, unfiltered logos, black navigation, and zero white frames across 95 frames during a 700 ms menu observation. See `D:/Temp/oled-0635-live-apple-final.log` and `oled-0635-apple-{hero,duo,menu}.png`. Fresh isolated profile, no sign-in. The screenshots retain pale backdrops inside unchanged media.
- Connected Reddit smoke check opened comment search with one engine sheet. The alternating-control failure is proved by the isolated shadow regression; live oscillation was not reproduced.
- The connected owner browser still showed white Ads sibling cells after a page refresh. Its reload MCP lacked a debugging connection, and browser policy blocked the extension management page. Owner installation of the final edits is not claimed.

## Reporting privacy

The current report is downloaded locally. It contains short page-text snippets and element identifiers; publishing it unchanged as a public GitHub issue can disclose private page content. A future issue flow should preview a sanitized report and let the user choose submission. Issue text must remain untrusted, and generated fixes need tests/review before release. No reporting endpoint or unattended issue-to-deployment automation was added here.
