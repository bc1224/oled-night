# Store submission without a file picker

`node tools/submit-stores.mjs --status` checks package files and reports which credential names are configured. It never prints credential values. With credentials set, `--amo`, `--chrome`, or `--both` submits the current manifest version directly through the store APIs. Releases after this workflow is installed trigger `.github/workflows/submit-stores.yml`; the workflow skips a store until that store's GitHub secrets are configured. To submit an earlier release, dispatch the workflow with its tag.

## One-time Mozilla setup

Create an API key and secret in [Mozilla API Credentials](https://addons.mozilla.org/en-US/developers/addon/api/key/). Store them as GitHub Actions secrets `AMO_API_KEY` and `AMO_API_SECRET` in `bc1224/oled-night`. Do not paste the secret into an issue, chat, or repository file. Mozilla's [external API authentication](https://mozilla.github.io/addons-server/topics/api/auth.html) uses these to sign short-lived JWTs. The uploader sends `dist/oled-night-firefox-<version>.zip` as a listed version of the existing `oled-night` add-on, then includes `dist/oled-night-source-<version>.zip` for review.

## One-time Chrome setup

Follow Google's [Chrome Web Store API setup](https://developer.chrome.com/docs/webstore/using-api): enable the API in a Google Cloud project, configure OAuth consent, create an OAuth client, authorize the `https://www.googleapis.com/auth/chromewebstore` scope using the account that owns OLED Night, and get the publisher ID and refresh token. Store `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, and `CWS_PUBLISHER_ID` as GitHub Actions secrets. The uploader sends `dist/oled-night-<version>.zip` to Chrome Web Store API v2 and submits it for review with warnings treated as blocking. The existing extension item ID is embedded in the uploader; the companion theme is a separate item and is not resubmitted for extension-only changes.

## Current release

Version 0.6.27 is tagged and published on [GitHub Releases](https://github.com/bc1224/oled-night/releases/tag/v0.6.27). The release includes Chrome, Firefox, and Mozilla source ZIPs, plus stable download aliases. It keeps light cards distinct from the black page, preserves authored outlines and colored gradients, and leaves transparent embeds transparent. The reported Amazon sort delay remains unresolved. The companion Chrome theme remains version 1.0.2 and does not need another store upload.

As of October 1, Firefox 0.6.24 is approved on Mozilla Add-ons. Chrome 0.6.27 was submitted through [the successful store workflow](https://github.com/bc1224/oled-night/actions/runs/36937944066); the Chrome Web Store API reported `PENDING_REVIEW`. Store approval and publication are still pending. Google Cloud OAuth is in production, and the four Chrome GitHub Actions secrets are configured with a production refresh token. The older OAuth client secret is disabled.

Firefox 0.6.27 has not yet been submitted. The workflow skipped Mozilla because `AMO_API_KEY` and `AMO_API_SECRET` are not configured. The Mozilla API Credentials page requires email confirmation before it offers key generation. Local Chrome and Firefox checks are documented in [the audit](AUDIT-2026-10-01.md).

Once the Mozilla secrets are configured, run `gh workflow run submit-stores.yml --repo bc1224/oled-night -f tag=v0.6.27 -f store=amo`. The workflow rebuilds packages from that exact tag and submits Firefox only, so it does not repeat the pending Chrome submission. No manual ZIP selection is needed. Verify the Mozilla receipt after the run rather than treating workflow success alone as store publication.
