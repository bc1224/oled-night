# Store submission without a file picker

`node tools/submit-stores.mjs --status` checks package files and reports which credential names are configured. It never prints credential values. With credentials set, `--amo`, `--chrome`, or `--both` submits the current manifest version directly through the store APIs. Releases after this workflow is installed trigger `.github/workflows/submit-stores.yml`; the workflow skips a store until that store's GitHub secrets are configured. To submit an earlier release, dispatch the workflow with its tag.

## One-time Mozilla setup

Create an API key and secret in [Mozilla API Credentials](https://addons.mozilla.org/en-US/developers/addon/api/key/). Store them as GitHub Actions secrets `AMO_API_KEY` and `AMO_API_SECRET` in `bc1224/oled-night`. Do not paste the secret into an issue, chat, or repository file. Mozilla's [external API authentication](https://mozilla.github.io/addons-server/topics/api/auth.html) uses these to sign short-lived JWTs. The uploader sends `dist/oled-night-firefox-<version>.zip` as a listed version of the existing `oled-night` add-on, then includes `dist/oled-night-source-<version>.zip` for review.

## One-time Chrome setup

Follow Google's [Chrome Web Store API setup](https://developer.chrome.com/docs/webstore/using-api): enable the API in a Google Cloud project, configure OAuth consent, create an OAuth client, authorize the `https://www.googleapis.com/auth/chromewebstore` scope using the account that owns OLED Night, and get the publisher ID and refresh token. Store `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, and `CWS_PUBLISHER_ID` as GitHub Actions secrets. The uploader sends `dist/oled-night-<version>.zip` to Chrome Web Store API v2 and submits it for review with warnings treated as blocking. The existing extension item ID is embedded in the uploader; the companion theme is a separate item and is not resubmitted for extension-only changes.

## Current release

Version **0.6.29** fixes issue #1: YouTube's white masthead and dark titles with its native Light theme. It reads native dark color declarations, including renamed tokens, without changing YouTube's saved theme or traversing player components. It includes the global shortcut from 0.6.28. No new permissions; theme 1.0.2 is unchanged.

- Source/tag: `d4ce59bc4cab77acb751e49494ce30f9d25c112b`, [v0.6.29 release](https://github.com/bc1224/oled-night/releases/tag/v0.6.29), all seven versioned/stable assets and reviewer source published.
- [Tests 37865243894](https://github.com/bc1224/oled-night/actions/runs/37865243894) passed: 194 Chrome checks, 74 Firefox checks, all units, Firefox lint 0 errors/warnings. Local Chrome passed 193 checks; CI includes an additional system-theme branch. [Pages deployment 37865243210](https://github.com/bc1224/oled-night/actions/runs/37865243210) succeeded.
- Firefox: [version 6556956](https://addons.mozilla.org/en-US/developers/addon/oled-night/versions/6556956), file `5101095`, was submitted with source and approved on October 9 UTC (October 8 Pacific). The version page confirms the source attachment `/firefox/downloads/source/6556956` and listed version 0.6.29. Mozilla's upload validation had no errors or warnings.
- Chrome: [store workflow 37865627282](https://github.com/bc1224/oled-night/actions/runs/37865627282) failed at the upload endpoint with HTTP 400. **0.6.29 is not confirmed uploaded or submitted to Chrome.** The previous 0.6.28 submission was pending review; whether that caused this rejection is unverified. Browser access to the developer console was refused, and access was requested before further dashboard work. Do not claim Chrome 0.6.29 is pending review until a successful submission receipt exists.
- Verification boundary: the reported failure was reproduced on live YouTube with installed 0.6.27, and the relevant old source was unchanged in 0.6.28. The new fix passed controlled Chrome/Firefox fixtures using observed YouTube CSS patterns; it has not yet been verified on live YouTube with the store-updated package.

## Previous release: 0.6.28

Version **0.6.28** implements the global activation shortcut from issue #2. **Alt+Shift+E** and the popup master switch pause or resume OLED Night everywhere while preserving site rules, tuning, appearance and schedule. **Alt+Shift+D** remains site-specific. No new permissions; theme 1.0.2 is unchanged.

- Source/tag: `1e1a0ad1fadc157adceecdcfc986a58b8b64dc5b`, [v0.6.28 release](https://github.com/bc1224/oled-night/releases/tag/v0.6.28), seven assets including stable download aliases and reviewer source.
- [Tests 37863436639](https://github.com/bc1224/oled-night/actions/runs/37863436639) passed: 183 Chrome checks, 70 Firefox checks, units and Firefox lint. Local Chrome passed 182 checks (the system-color-scheme branch adds one check on CI). [Pages deployment](https://github.com/bc1224/oled-night/actions/runs/37863436043) passed and the live website documents the global shortcut.
- Chrome: [store workflow 37863823670](https://github.com/bc1224/oled-night/actions/runs/37863823670) uploaded and submitted 0.6.28; the API reported `PENDING_REVIEW` on October 9 UTC (October 8 Pacific).
- Firefox: [version 6556930](https://addons.mozilla.org/en-US/developers/addon/oled-night/versions/6556930) was uploaded and submitted through the developer dashboard with release notes, reproducible-build notes and source archive. Validation reported no errors or warnings; version status is **Awaiting Review**. AMO API credentials remain absent, so the workflow's Mozilla skip is expected.
- [Issue #2 reply](https://github.com/bc1224/oled-night/issues/2#issuecomment-6071615865) confirms the implementation and pending store rollout. Store publication remains subject to review; do not resubmit this version merely because publication is pending.

## Previous release and credential setup

Version 0.6.27 is tagged and published on [GitHub Releases](https://github.com/bc1224/oled-night/releases/tag/v0.6.27). The release includes Chrome, Firefox, and Mozilla source ZIPs, plus stable download aliases. It keeps light cards distinct from the black page, preserves authored outlines and colored gradients, and leaves transparent embeds transparent. The reported Amazon sort delay remains unresolved. The companion Chrome theme remains version 1.0.2 and does not need another store upload.

As of October 1, [Firefox 0.6.27 is approved and listed on Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/oled-night/). The Firefox ZIP and source archive were uploaded through the Mozilla developer dashboard; [version management](https://addons.mozilla.org/en-US/developers/addon/oled-night/versions/6533105) shows the source attachment and approved listed version. Chrome 0.6.27 was submitted through [the successful store workflow](https://github.com/bc1224/oled-night/actions/runs/36937944066); the Chrome Web Store API reported `PENDING_REVIEW`. Chrome approval and publication are still pending. Google Cloud OAuth is in production, and the four Chrome GitHub Actions secrets are configured with a production refresh token. The older OAuth client secret is disabled.

Mozilla API credentials are still not configured in GitHub Actions. A fresh email confirmation was opened, but Mozilla rate limited key generation. Future automated Firefox submissions need `AMO_API_KEY` and `AMO_API_SECRET`; the dashboard upload completed this version without them. Local Chrome and Firefox checks are documented in [the audit](AUDIT-2026-10-01.md).

For future releases, once the Mozilla secrets are configured, run `gh workflow run submit-stores.yml --repo bc1224/oled-night -f tag=<release-tag> -f store=amo` to submit Firefox only. The workflow rebuilds packages from that exact tag, so no manual ZIP selection is needed. Do not rerun it for v0.6.27, which is already listed.
