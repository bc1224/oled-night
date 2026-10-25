# Contributing

Bug reports and pull requests are welcome.

## Reporting a site that looks wrong
1. On the broken page, open the OLED Night popup and click **Report a broken site** to preview scrubbed diagnostics.
2. Add optional notes. If useful, choose **Screenshot this page**, paste, drop or select an image. Review it and choose **Use screenshot**.
3. Choose **Submit report** to create a public GitHub issue through the reporting service. No GitHub account is required. Firefox asks for optional sharing consent; declining keeps dark mode working. Nothing is uploaded before submission.

Automatic diagnostics omit page text, field values, URL paths, query strings, identifiers and cookies. Reports include the current domain, previewed diagnostics and any notes or screenshot you choose. Review them for private information: issues and attached images are public. Images are hosted for up to 30 days; GitHub may retain cached copies. See the [privacy policy](store/PRIVACY.md).

**Save full report locally** is a separate download. It can contain short visible text snippets and element identifiers. Review it before sharing; never attach private account data or screenshots of sensitive pages. Normal recoloring stays local, with no analytics or tracking.

## Working on the code
Unpacked development needs no build step. Use Node.js 22 or newer and Chrome; `npm ci` installs the browser test tooling. Runtime packages contain no npm dependencies.

1. Load the folder with **Load unpacked** at `chrome://extensions`.
2. After you edit, click the reload arrow on the extension card and refresh the tab.
3. Run the tests:
   ```
   for t in tests/*.test.js; do node "$t"; done
   node tests/e2e/run.mjs
   ```
   The end-to-end suite loads the real extension into a throwaway headless Chrome and checks every behavior against the pages in `tests/e2e/site/`. If you fix a site, add a small page that reproduces it there, plus a check in `tests/e2e/run.mjs`.
4. `node tools/package.mjs` builds the release zip.

Please keep changes focused, and explain what site or behavior they fix.

## Release downloads
Run `node tools/package.mjs` for a new release and publish the versioned Chrome extension, Firefox extension, companion theme and reviewer source ZIPs, plus stable aliases `oled-night.zip`, `oled-night-firefox.zip` and `oled-night-theme.zip`. The website and README follow GitHub's latest release through those aliases. Keep every published version's assets immutable and do not bump an unchanged theme. Exact-source tests and store submission requirements are in [STORE_SUBMISSION.md](STORE_SUBMISSION.md). Store submission, approval and installed-browser updates are separate steps.

## Firefox
Use the [Mozilla Add-ons listing](https://addons.mozilla.org/en-US/firefox/addon/oled-night/) for normal installation. See [FIREFOX.md](FIREFOX.md) for temporary development installs. Run Firefox lint and runtime checks in addition to Chrome checks when changing shared code. Do not present an unsigned Firefox ZIP as a permanent installer.
