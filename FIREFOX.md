# Firefox desktop

Install [OLED Night from Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/oled-night/) for a signed extension and automatic updates. Firefox desktop 142 or newer is required. The Firefox extension shares its darkening engine and settings UI with Chrome. The companion Chrome theme is a separate product and does not work in Firefox.

## What is included

- Automatic dark mode, full recolor, deepen blacks, invert and per-site Off controls.
- Per-site text brightness, surface contrast and optional image dimming, plus a global pause that preserves saved rules.
- Scheduling, settings backup and customizable global/site keyboard shortcuts. The popup shows the keys actually assigned by Firefox.
- Optional private broken-site reports with previewed diagnostics, notes and a screenshot you explicitly capture, paste, drop or select. Nothing is uploaded until Submit report. Only a generic tracking issue is public, with no GitHub sign-in needed to submit.
- Readable dark logo lettering and protected media, native ChatGPT colors, and native-color protection on Figma.

Some pages restrict extensions, and some sites need another mode or a site exception. Figma keeps its native colors even when explicitly enabled. Firefox Android is not supported.

## Temporary installation for development

1. Download or clone this repository. Install Node.js 22 or newer.
2. Run `node tools/package.mjs` from the repository folder. Packaging needs no npm dependencies.
3. In Firefox, open `about:debugging#/runtime/this-firefox`.
4. Choose **Load Temporary Add-on**, then select `dist/firefox/manifest.json`.
5. Open a normal website, pin OLED Night, and grant website access if Firefox asks.

The unsigned [Firefox ZIP](https://github.com/bc1224/oled-night/releases/latest/download/oled-night-firefox.zip) from GitHub is for this temporary installation. Firefox removes temporary add-ons when it restarts. Use the Mozilla Add-ons listing for normal installation and updates. A GitHub release can be newer than the version approved by Mozilla.

## Privacy and permissions

The extension has no automatic analytics, ads, background tracking or browsing-history log. Settings use browser storage and can sync through your browser profile.

Firefox's optional browsing-activity and technical-data consent covers the current domain and scrubbed diagnostics in a report you choose to submit. Optional website-content consent covers a screenshot you explicitly include. Declining keeps dark mode working. Clipboard access is optional and requested only for the explicit paste action.

Notes, diagnostics and images are private to the maintainer for up to 30 days. The public tracking issue contains no domain, details or screenshot link. Anything you manually post in public GitHub issues or comments is public. See the [privacy policy](store/PRIVACY.md) for service retention, screenshot access and local report downloads.

## Development checks

```sh
npm ci
node tools/package.mjs
npm run lint:firefox
npm run test:firefox
```

The tests use temporary browser profiles and local fixtures, not your browsing profile or real accounts. Set `FIREFOX_PATH` if needed. See [STORE_SUBMISSION.md](STORE_SUBMISSION.md) for signed-release submission and metadata updates. Store review and public rollout are separate from publishing a GitHub release.
