# OLED Night

A Manifest V3 Chrome extension that makes web pages true black by recoloring elements rather than applying a blanket filter. Photos, video and artwork keep their real colors.

Current version: **0.6.1**. To install it or share it, see [INSTALL.md](INSTALL.md). To publish it on the Chrome Web Store, see [store/LISTING.md](store/LISTING.md).

## What it does
- **Light pages:** recolors backgrounds, gradients, shadows, pseudo-elements, borders (colored ones keep their hue), SVG icons and chart fills. Text keeps its primary, secondary or muted emphasis.
- **Already-dark pages:** only pushes the darkest greys to true black (the "deepen" mode).
- **Web components, frames, and modern CSS colors** (`oklch`, `lab`, `color(srgb …)`) are handled. With the experimental option on, "closed" components are too.
- **No white flash:** runs at `document_start` with an early black sheet.
- **Per-site:** mode (automatic, full recolor, deepen, invert, off), brightness, contrast and image dimming.
- **Schedule, keyboard shortcut (Alt+Shift+D), settings export and import, and a diagnostic report** for broken sites.
- **YouTube** uses a protected profile that never walks its DOM.

## Layout
| File | Role |
|---|---|
| `settings.js` | Shared settings model: defaults, site modes, per-site tuning, schedule |
| `color-utils.js` | Color parsing (all CSS color syntaxes) and mapping rules |
| `content.js` | Page engine: batched read-then-write recoloring, mutation tracking, shadow roots, invert mode, reports |
| `background.js` | Keyboard shortcut; registers `shadow-open.js` when the experimental option is on |
| `popup.*`, `options.*` | Toolbar popup and settings page |
| `tools/package.mjs` | Builds `dist/oled-night-<version>.zip` |
| `tools/store-assets.mjs` | Renders the Web Store screenshots and promo tile |

Performance notes: every pass reads all computed styles first, then writes, so a batch costs a single style recalculation. Overrides are switched off only inside the affected subtrees while re-reading. Brightness and contrast are root CSS variables, so the sliders never re-scan the page.

## Test
```
node tests/color-utils.test.js
node tests/color-effects.test.js
node tests/settings.test.js
node tests/popup-live-controls.test.js
node tests/youtube-safe-mode.test.js
node tests/e2e/run.mjs
```
`tests/e2e/run.mjs` loads the real extension into a throwaway headless Chrome and checks 43 behaviors against the pages in `tests/e2e/site/`: light and dark sites, Gmail read/unread, charts, frames, web components, streaming, slow loads, every site mode, schedule, per-site settings, performance and the popup. Set `CHROME_PATH` if Chrome isn't in a standard location, and `EXT_PATH` to test an unzipped release.

## Release
1. Bump `version` in `manifest.json`, and the version string in `content.js` and in the README.
2. Run the tests above.
3. `node tools/package.mjs`, then upload the zip, or send it along with INSTALL.md.
