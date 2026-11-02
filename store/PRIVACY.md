# OLED Night privacy policy

_Last updated: October 25, 2026_

OLED Night is a browser extension that recolors web pages locally. Sharing a bug report is an optional, explicit action.

**Automatic collection:** none. OLED Night has no analytics, advertising or tracking. A Cloudflare-hosted reporting service is contacted only when you explicitly submit a report. Optional private bug reports and browser-account syncing are described below.

**Browsing history:** OLED Night does not record or save a log of the pages you visit. Firefox's optional browsing-activity permission covers sharing the current site's domain privately in a bug report, only after you preview it and choose Submit report. It does not enable history tracking. Per-site settings store your chosen preferences for a domain, not visits or page URLs. GitHub retains generic public tracking issues according to its own policies. Temporary service records are described below.

**What it stores:** your settings (on/off, appearance, brightness, contrast, schedule and per-site choices). They are kept in your browser's sync storage, so your browser can sync them between your signed-in browsers. The developer cannot see them.

**Page content:** to recolor a page, OLED Night reads element colors locally. Recoloring does not upload page text or entered values. Optional computed-color diagnostics and explicit local report downloads are described below.

**Referenced icons:** to check the contrast of small controls, OLED Night may reread an SVG asset that the page already references, from the same website origin. These requests use the site's existing session, do not follow redirects and are limited in number, size and duration. The asset is inspected locally without inserting its markup into the page. It is not sent to the developer or reporting service.

**Diagnostic reports:** "Report a broken site" first opens a confirmation with optional notes and an optional screenshot. Nothing is sent until you choose "Submit report". The current domain, extension version, mode, brightness/contrast settings, element counts and computed contrast colors/ratios are stored privately by our Cloudflare-hosted service. Notes you type and any image you explicitly include are private too. GitHub receives only a generic public title and tracking ID, with no hostname, report details, diagnostics or screenshot URL. No GitHub account is required to submit. Automatically collected page text, field values, URL paths/query strings, selectors/identifiers, frame origins and browser identifiers are excluded. Review the preview before sharing with the maintainer. Screenshots are never captured automatically; Screenshot this page captures only the visible area of the current tab. Clipboard reading occurs only after your paste action; Paste image requests optional clipboardRead permission. Clicking the thumbnail opens a larger local preview. Images are resized/re-encoded locally without filenames or original file metadata. Cancel or Remove discards the local image. The maintainer and development tools using the maintainer's GitHub authentication can retrieve the private contents to reproduce, test and fix bugs. Private contents must not be copied into public fixtures, commits, comments or ordinary logs. Firefox requests optional browsingActivity and technicalAndInteraction consent, plus websiteContent only when a screenshot is attached. Declining or unavailable consent blocks sharing only; dark mode keeps working. You can revoke consent in Firefox add-on settings.

**Reporting service:** Cloudflare receives your network address to deliver the request. The service uses a secret-salted daily address hash for abuse limits; it does not store raw addresses or browsing histories. Request hashes, daily counters and created issue links expire within 49 hours. Full scrubbed report contents and explicitly attached screenshots (up to 400 KiB after local preparation) are stored privately for up to 30 days. Report and screenshot reads require a GitHub credential verified directly with GitHub as the maintainer, bc1224. Missing credentials, other identities and authentication errors deny access before storage is read. This includes screenshot URLs issued by older versions. Credentials are not persisted or logged. Expiry prevents further reads and hourly cleanup removes expired records. Application request logging is disabled. GitHub retains the generic public tracking issue under its own policies. Recoloring never contacts this service.

**Public GitHub posts and older reports:** anything you manually write or upload in a public GitHub issue or comment is public. Use the extension's private report flow for report contents. Reports created before this privacy update may already have public text or cached images. Protecting an old screenshot URL does not remove copies previously downloaded elsewhere. Editing an old issue does not by itself remove its edit history; authorized maintainers can separately remove sensitive revisions through GitHub's history controls. Third-party copies may remain.

**Full local report:** "Save full report locally" downloads the original diagnostics to your computer. This file can contain short page text snippets and element identifiers. No screenshot is captured; field contents are omitted. It is not uploaded by the extension. Review it before sharing it yourself.

**Permissions:** OLED Night runs on every site because recoloring pages is its purpose. The `storage` permission saves your settings, `activeTab` identifies the current site for the popup and keyboard shortcut, and `scripting` lets the popup check whether the current tab can be reached. No code is injected into the page's own scripts.

**Project website:** the OLED Night website at https://bc1224.github.io/oled-night/ has no analytics scripts. The separate Archline Labs company website uses consent-based website analytics under https://archlinelabs.com/privacy/. Company-site analytics are not included in the extension and do not receive your extension browsing activity.

**Changes:** policy clarifications are published here. Changes to the extension's data handling are published with the extension update.

**Contact:** use the extension's Report a broken site flow to send details privately. General questions can be posted at https://github.com/bc1224/oled-night/issues, where posts and uploads are public.

Diagnostic contrast checks include form controls, but their contents are omitted. Passwords and entered form values are not read for the report.
