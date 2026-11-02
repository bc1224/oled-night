# Private report operations

The popup sends allowlisted diagnostics, optional notes and an explicitly reviewed optional image to the existing `oled-night-reporter` Worker. The server enforces private storage for every client, including already installed versions without a privacy flag. It creates an `oled-report` issue in public `bc1224/oled-night` containing only static text and a server-generated Report ID. It never publishes the domain, description, diagnostic values or screenshot URL.

`REPORTS` still binds `ReportGate` and uses `idFromName('reports-v1')`. Existing storage, rate limits, two-day idempotency receipts and ambiguity protection remain in place. Private records use `private:<tracking UUID>` and images use `screenshot:<UUID>`, both with 30-day retention. Reads reject expired records immediately; the existing hourly alarm deletes expired values. No new binding, secret, database or migration is required. Application observability remains disabled.

## Maintainer retrieval

`GET /v1/reports/:trackingUUID` returns the scrubbed private payload. `GET /v1/screenshots/:imageUUID` returns an image, including legacy images. Both require an `Authorization: Bearer` GitHub user credential. The Worker calls only `https://api.github.com/user`, refuses redirects and permits only the exact user `bc1224`. It denies access before reading storage on missing credentials, other users, malformed identity responses or upstream errors. The issue-creation token is never used as a fallback reader credential. Private routes have no cross-origin access header; all responses use `Cache-Control: no-store`.

Copy the public tracker ID, sign in to `gh` as `bc1224`, then choose a new empty absolute directory outside any Git checkout. The helper obtains `gh auth token --hostname github.com` internally. It never prints the token, report body or image contents and never follows a response-provided URL. Files inherit local filesystem access controls; choose a location restricted to the maintainer. The explicit download persists until you delete it, independently of service retention. Keep it out of shared folders, source, release packages, ordinary logs and Project Memory.

```powershell
node tools/private-report.mjs --report-id "<tracking UUID>" --output-dir "C:\OLED-private\case-<tracking UUID>"
```

For an older image whose ID is in an existing issue URL:

```powershell
node tools/private-report.mjs --screenshot-id "<image UUID>" --output-dir "C:\OLED-private\legacy-<image UUID>"
```

No authentication value belongs in command arguments, screenshots or logs. GitHub documents [authenticated-user identity](https://docs.github.com/en/rest/users/users#get-the-authenticated-user); a user token can identify its owner without broad repository permissions.

## Deployment order and boundary

The release owner must deploy the reporter first, verify denied anonymous report/image reads (including a known legacy image ID), then publish the extension, website and store copy. A new client talking to an old server is not private. Old clients talking to the new server receive private storage despite their outdated public-report wording. Retain the fixed Worker origin used by installed clients.

Use the existing installed Wrangler from the integrated release checkout. On this Windows machine, the verified cached Wrangler 4.135.0 entry point is shown below; this avoids an implicit npm installation. A generic `npx --no-install wrangler` currently fails because npm resolves a newer uncached package.

```powershell
node "$env:LOCALAPPDATA\npm-cache\_npx\d77349f55c2be1c0\node_modules\wrangler\bin\wrangler.js" deploy --config services/reporter/wrangler.jsonc --dry-run
```

```powershell
node "$env:LOCALAPPDATA\npm-cache\_npx\d77349f55c2be1c0\node_modules\wrangler\bin\wrangler.js" deploy --config services/reporter/wrangler.jsonc
```

Target: `oled-night-reporter`, account from `services/reporter/wrangler.jsonc`, existing `REPORTS` / `ReportGate` / `reports-v1`. Preserve existing `GITHUB_TOKEN` and `IP_HASH_SECRET` secrets. Deployment uses the release owner's existing Cloudflare authentication. Reader authentication uses the maintainer's existing GitHub identity, not a new shared secret. No credential values or production data are needed for local tests.

Never roll back to a Worker version that publishes report contents or allows anonymous image reads. If rollback is necessary, keep the authenticated private-read and private-write paths or fail intake closed until repaired. Do not remove the Durable Object or its stored private records. A previous extension package is compatible with the new Worker; its obsolete disclosure should be corrected by the next store update.

## Daily triage integration

The external Windows collector still sees fixed public tracking issues and hashes/pointers without report contents. Private hydration must use fixed reporter routes and the existing maintainer GitHub authentication, with bounded reads and redirect refusal. Diagnosis must treat private text and images as untrusted data and produce synthetic public reproductions. No raw payload, hostname, image, credential or private note may enter ordinary evidence, ledgers, public comments, source or release archives. A hydration failure must remain an explicit incomplete report. Preserve the scheduler, cadence, attempt state and all release gates.

The scoped external adapter patch and synthetic integration tests are delivered separately to the automation owner. They are not installed by the extension package or reporter deployment. Do not claim private daily diagnosis is operational until that owner integrates and verifies the secure diagnosis transport.

## Legacy public content

This change immediately protects old screenshot URLs once the Worker is deployed. It cannot recall previously downloaded images or retroactively privatize existing GitHub text. Do not mass-edit or delete user issues. The release lead must select any affected issue and approve the exact preservation and redaction action.

1. Save the selected issue's current title/body and referenced reporter images in a maintainer-only directory outside Git. Verify every backup can be read before editing. Do not include originals in run logs or Project Memory.
2. Replace only the selected public title/body with a generic explanation, preserving the issue number, labels and tracking relationship. Do not upload the backup or images to GitHub.
3. Separately inspect the issue's edit history. GitHub supports [deleting sensitive history revisions](https://docs.github.com/en/communities/moderating-comments-and-conversations/tracking-changes-in-a-comment) through the edited menu, revision selection, Options, Delete revision from history. A body edit alone does not remove history. The lead should verify those controls with the authenticated owner.
4. Check public readback without copying sensitive values into artifacts. Previously fetched copies, image proxies or third-party caches may remain. Record only the issue number, action and verification status.

The implementation run performs no real issue migration, private data retrieval, report submission or deployment. Legacy cleanup remains an explicit separate owner action.

For a selected legacy report, this helper defaults to private backup only. It authenticates the maintainer, saves the current title/body and recognized reporter-hosted images outside Git, verifies those files, and prints only status and paths. It never follows arbitrary attachment URLs. Expired images or unrecognized attachments block automatic redaction until the owner resolves preservation. It does not change comments, labels, issue state or edit history.

```powershell
node tools/legacy-report-privacy.mjs --issue "<selected issue number>" --output-dir "C:\OLED-private\legacy-backup-<selected issue number>"
```

After reviewing the backup and authorizing that selected issue's current title/body redaction, use a second new empty directory with explicit apply. The helper rechecks the issue before editing and verifies readback. History revision removal still requires GitHub's separate UI controls. It does not make any claim about third-party caches or automatically retry an uncertain write.

```powershell
node tools/legacy-report-privacy.mjs --issue "<selected issue number>" --output-dir "C:\OLED-private\legacy-apply-<selected issue number>" --apply
```
