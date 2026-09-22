# Firefox desktop preview

OLED Night shares its darkening engine and settings UI between Chrome and Firefox. Firefox 142 or newer is required. This preview is not yet signed or listed on Mozilla Add-ons; it is not a permanent one-click install.

## Try it from the repo

1. Download or clone this repository. Install Node.js 22 or newer.
2. Run `node tools/package.mjs` from the repository folder (no npm dependencies needed for packaging).
3. In Firefox, open `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on**, then select `dist/firefox/manifest.json`.
5. Open a normal website and pin OLED Night from the Extensions menu. Grant website access if Firefox asks.

Firefox removes temporary add-ons when it restarts. Load it again to continue testing. Browser settings pages and Mozilla Add-ons pages restrict extensions.

You can also download the `oled-night-zip` artifact from a successful [Tests workflow](https://github.com/bc1224/oled-night/actions/workflows/test.yml), extract `oled-night-firefox.zip`, and select its manifest as above. GitHub may require sign-in to download artifacts.

## What is included

- The same darkening engine, per-site controls, schedule, settings backup and diagnostic JSON reports.
- Apple sign-in field and Reddit Enhancement Suite fixes.
- Optional closed-shadow component support (off by default).
- Firefox-specific shortcut instructions. The separate Chrome browser theme is not included.

## Development checks

```
npm ci
node tools/package.mjs
npm run lint:firefox
npm run test:firefox
```

The test runner uses Mozilla web-ext and a temporary headless Firefox profile, not your browsing profile. Set `FIREFOX_PATH` if Firefox is installed outside its standard location. Tests use local fixture pages; they do not log into real accounts.

## Permanent installation and distribution

A maintainer must submit `dist/oled-night-firefox-<version>.zip` to Mozilla for signing. The manifest declares a stable add-on ID and no data collection. Review the declarations when changing data handling.

After Mozilla approval, add the actual Add-ons listing URL to README and the website. Do not point an Install for Firefox button at the unsigned ZIP. A signed `.xpi` can also be attached to GitHub releases; self-distributed updates need their own update manifest if they are not served through the listed channel.

No Mozilla listing or approval is implied by this preview. Firefox Android and a Firefox browser theme are outside this port.
