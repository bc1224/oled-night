# Store submission without a file picker

`node tools/submit-stores.mjs --status` checks package files and reports which credential names are configured. It never prints credential values. With credentials set, `--amo`, `--chrome`, or `--both` submits the current manifest version directly through the store APIs. Releases after this workflow is installed trigger `.github/workflows/submit-stores.yml`; the workflow skips a store until that store's GitHub secrets are configured. To submit an earlier release, dispatch the workflow with its tag.

## One-time Mozilla setup

Create an API key and secret in [Mozilla API Credentials](https://addons.mozilla.org/en-US/developers/addon/api/key/). Store them as GitHub Actions secrets `AMO_API_KEY` and `AMO_API_SECRET` in `bc1224/oled-night`. Do not paste the secret into an issue, chat, or repository file. Mozilla's [external API authentication](https://mozilla.github.io/addons-server/topics/api/auth.html) uses these to sign short-lived JWTs. The uploader sends `dist/oled-night-firefox-<version>.zip` as a listed version of the existing `oled-night` add-on, then includes `dist/oled-night-source-<version>.zip` for review.

## One-time Chrome setup

Follow Google's [Chrome Web Store API setup](https://developer.chrome.com/docs/webstore/using-api): enable the API in a Google Cloud project, configure OAuth consent, create an OAuth client, authorize the `https://www.googleapis.com/auth/chromewebstore` scope using the account that owns OLED Night, and get the publisher ID and refresh token. Store `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, and `CWS_PUBLISHER_ID` as GitHub Actions secrets. The uploader sends `dist/oled-night-<version>.zip` to Chrome Web Store API v2 and submits it for review with warnings treated as blocking. The existing extension item ID is embedded in the uploader; the companion theme is a separate item and is not resubmitted for extension-only changes.

## Current release

Version 0.6.20 is available on [GitHub Releases](https://github.com/bc1224/oled-night/releases/tag/v0.6.20). Once credentials are configured, run `gh workflow run submit-stores.yml --repo bc1224/oled-night -f tag=v0.6.20` from an authenticated `gh` session, or ask Codex to run it. The workflow will build the packages from the tag and submit them; no manual ZIP selection is needed.

Version 0.6.21 is packaged locally with the Amazon image and dropdown fixes but has not been tagged, published, or submitted to either store. Its Chrome extension file is `dist/oled-night-0.6.21.zip`; its Firefox add-on file is `dist/oled-night-firefox-0.6.21.zip`. Mozilla also needs `dist/oled-night-source-0.6.21.zip` for source review. The companion Chrome theme remains version 1.0.2 and does not need another upload. Once the six GitHub secrets above are set and 0.6.21 is released, dispatch the store workflow with `tag=v0.6.21` to submit both add-ons without file pickers.
