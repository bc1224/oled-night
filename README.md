# OLED Night

A Manifest V3 Chrome extension that produces true-black dark pages without applying a blanket filter to images, video, canvas, SVG, or embedded media.

Current version: **0.5.1**. YouTube uses a protected native-dark profile: OLED Night paints only direct shell surfaces and text variables, never replaces YouTube's structural background tokens, and never traverses or restyles the player, thumbnails, guide, recommendations, comments, or other hydrated components.

## Features

- Global on/off switch in the extension popup
- Per-site `On`, `Off`, or `Use global` override
- OLED Black, Soft Dark, and automatic appearance modes
- Text brightness and surface contrast controls
- Live slider preview with synchronized persistence
- Distinctive transparent OLED Night toolbar identity at 16, 32, 48, and 128 px
- Semantic recoloring that preserves colored controls and media
- Dynamic-page support via `MutationObserver`
- Site-override management page

## Load locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Pin **OLED Night**. Its popup contains both the global switch and current-site control.

Chrome internal pages and the Chrome Web Store do not allow content-script styling. Reload already-open website tabs once after first installing the extension.

## Validate

Run `node tests/color-utils.test.js` and `node tests/youtube-safe-mode.test.js`, then syntax-check scripts with `node --check`.
