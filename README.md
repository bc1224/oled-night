<p align="center"><img src="assets/icon-128.png" width="96" alt=""></p>

<h1 align="center">OLED Night</h1>

<p align="center"><b>True-black dark mode for every website, without breaking it.</b><br>
Free and open-source Chrome extension · readable text · images untouched · per-site control</p>

<p align="center">
  <a href="https://github.com/bc1224/oled-night/releases/latest/download/oled-night.zip"><b>Download</b></a> ·
  <a href="https://bc1224.github.io/oled-night/">Website</a> ·
  <a href="INSTALL.md">Install guide</a> ·
  <a href="https://github.com/bc1224/oled-night/issues">Report a site</a>
</p>

![Before and after OLED Night on an email inbox](store/images/screenshot-1-before-after.png)

## Why
On an OLED screen, true black means the pixels are off. I wanted every site that dark, including the many sites with no dark mode of their own. Existing dark modes either left everything grey or broke pages: unreadable text, white boxes and gradients, blank chart fills, a white flash on every load, and lag in busy apps. OLED Night fixes those one real site at a time, and a test suite that runs the real extension keeps them fixed.

## Features
- **True `#000` black backgrounds.** Cards and panels keep a subtle lift so layouts stay readable.
- **Images untouched.** Photos, video and art keep their colors. Image dimming is optional.
- **Readable text, with emphasis kept.** Primary, secondary and muted text stay distinct, and Gmail's read and unread emails stay easy to tell apart.
- **Respects dark sites.** On a site that's already dark, it only deepens its greys to true black.
- **Modern web apps.** Charts, web components, embedded chat widgets and frames, and modern CSS colors (`oklch`, `lab`, `color()`).
- **No white flash, and no lag.** Pages go black before they draw, and updates are batched.
- **Per-site modes:** automatic, full recolor, deepen blacks only, invert (canvas apps), or off. Each site can also have its own brightness, contrast and image dimming.
- **Schedule, keyboard shortcut (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>), settings backup, and a "report a broken site" button.**
- **Private.** No servers, no analytics, no tracking. See the [privacy policy](store/PRIVACY.md).

## Install
Download [`oled-night.zip`](https://github.com/bc1224/oled-night/releases/latest/download/oled-night.zip), unzip it into a folder you'll keep, open `chrome://extensions`, turn on **Developer mode**, and click **Load unpacked** on that folder. Full steps, including Edge and updating, are in [INSTALL.md](INSTALL.md). A Chrome Web Store listing is coming.

## Using it
Click the toolbar icon on any site:

<img src="store/images/screenshot-2-popup.png" alt="The OLED Night popup" width="720">

| Site mode | What it does |
|---|---|
| Use global | Follows the main switch |
| On (automatic) | Recolors light sites; on dark sites, only deepens their blacks |
| Full recolor | Always recolors, even if the site looks dark |
| Deepen blacks only | Only pushes the darkest greys to true black |
| Invert | For canvas apps (Sheets, Figma): flips the page, then flips images back |
| Off | Never touches the site |

If a site still looks wrong, click **Report a broken site** in the popup and [open an issue](https://github.com/bc1224/oled-night/issues/new) with the saved file and a screenshot.

## How it works
OLED Night doesn't run one filter over the whole page. It works out a color for each element on its own: backgrounds, text, borders, SVG icons, chart fills, gradients, shadows and `::before`/`::after`. It keeps each text's original emphasis and remembers what was originally behind it. Every update reads all the styles it needs first and writes the changes after, so a batch costs a single style recalculation. Brightness and contrast are CSS variables, so moving a slider never re-scans the page.

| File | Role |
|---|---|
| `settings.js` | Shared settings model: defaults, site modes, per-site tuning, schedule |
| `color-utils.js` | Color parsing (every CSS color syntax) and mapping rules |
| `content.js` | Page engine: batched recoloring, change tracking, shadow roots, invert mode, reports |
| `background.js` | Keyboard shortcut and the experimental closed-component option |
| `popup.*`, `options.*` | Toolbar popup and settings page |
| `docs/` | The project website (GitHub Pages) |

## Development
No build step. Load the folder with **Load unpacked**, then:
```
for t in tests/*.test.js; do node "$t"; done   # unit tests
node tests/e2e/run.mjs                          # real extension in headless Chrome, 43 checks
node tools/package.mjs                          # dist/oled-night-<version>.zip
node tools/store-assets.mjs                     # Web Store screenshots
```
See [CONTRIBUTING.md](CONTRIBUTING.md). Web Store submission notes are in [store/LISTING.md](store/LISTING.md).

## License
[MIT](LICENSE)
