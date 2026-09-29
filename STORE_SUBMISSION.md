# Store submission without a file picker

`node tools/submit-stores.mjs --status` checks package files and reports which credential names are configured. It never prints credential values. With credentials set, `--amo`, `--chrome`, or `--both` submits the current manifest version directly through the store APIs. Releases after this workflow is installed trigger `.github/workflows/submit-stores.yml`; the workflow skips a store until that store's GitHub secrets are configured. To submit an earlier release, dispatch the workflow with its tag.

## One-time Mozilla setup

Create an API key and secret in [Mozilla API Credentials](https://addons.mozilla.org/en-US/developers/addon/api/key/). Store them as GitHub Actions secrets `AMO_API_KEY` and `AMO_API_SECRET` in `bc1224/oled-night`. Do not paste the secret into an issue, chat, or repository file. Mozilla's [external API authentication](https://mozilla.github.io/addons-server/topics/api/auth.html) uses these to sign short-lived JWTs. The uploader sends `dist/oled-night-firefox-<version>.zip` as a listed version of the existing `oled-night` add-on, then includes `dist/oled-night-source-<version>.zip` for review.

## One-time Chrome setup

Follow Google's [Chrome Web Store API setup](https://developer.chrome.com/docs/webstore/using-api): enable the API in a Google Cloud project, configure OAuth consent, create an OAuth client, authorize the `https://www.googleapis.com/auth/chromewebstore` scope using the account that owns OLED Night, and get the publisher ID and refresh token. Store `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, and `CWS_PUBLISHER_ID` as GitHub Actions secrets. The uploader sends `dist/oled-night-<version>.zip` to Chrome Web Store API v2 and submits it for review with warnings treated as blocking. The existing extension item ID is embedded in the uploader; the companion theme is a separate item and is not resubmitted for extension-only changes.

## Current release

Version 0.6.24 is tagged and published on [GitHub Releases](https://github.com/bc1224/oled-night/releases/tag/v0.6.24). The release includes Chrome, Firefox, and Mozilla source ZIPs. It restores stylesheet overrides that dynamic web components replace and improves small faded icon contrast on newly darkened surfaces. The companion Chrome theme remains version 1.0.2 and does not need another upload.

On September 29, 2026, `dist/oled-night-firefox-0.6.24.zip` and `dist/oled-night-source-0.6.24.zip` were uploaded through the Mozilla Developer Hub. [Firefox version 0.6.24](https://addons.mozilla.org/en-US/developers/addon/oled-night/versions/6525572) was submitted for review with 0 errors and 0 warnings. Version 0.6.23 is approved and remains the listed version until Mozilla publishes 0.6.24.

Chrome Web Store 0.6.24 has **not** been submitted. Codex browser control rejected the developer console with `Not allowed`, and no GitHub store secrets were configured when checked. To submit Chrome through the API, configure the four `CWS_*` secrets above, then run `gh workflow run submit-stores.yml --repo bc1224/oled-night -f tag=v0.6.24`. The workflow rebuilds packages from that tag; no manual ZIP selection is needed. The two `AMO_*` secrets are optional for this version because its Mozilla submission is already complete.
