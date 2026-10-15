# OLED Night privacy policy

_Last updated: October 15, 2026_

OLED Night is a browser extension that recolors web pages locally. Sharing a bug report is an optional, explicit action.

**Automatic collection:** none. OLED Night has no analytics, advertising or tracking. A Cloudflare-hosted reporting service is contacted only when you explicitly submit a report. Optional public bug reports and browser-account syncing are described below.

**Browsing history:** OLED Night does not record or save a log of the pages you visit. Firefox's optional browsing-activity permission covers sharing the current site's domain in a bug report, only after you preview it and choose Submit issue. It does not enable history tracking. Per-site settings store your chosen preferences for a domain, not visits or page URLs. GitHub retains submitted public issues according to its own policies. Temporary service records are described below.

**What it stores:** your settings (on/off, appearance, brightness, contrast, schedule and per-site choices). They are kept in your browser's sync storage, so your browser can sync them between your signed-in browsers. The developer cannot see them.

**Page content:** to recolor a page, OLED Night reads element colors locally. Recoloring does not upload page text or entered values. Optional computed-color diagnostics and explicit local report downloads are described below.

**Diagnostic reports:** "Report a broken site" first shows a preview and an optional description field. Choosing "Submit issue" sends the current domain, extension version, mode, brightness/contrast settings, element counts and computed contrast colors/ratios through our Cloudflare-hosted service directly to a public GitHub issue. No GitHub account is required. Automatically collected page text, field values, URL paths/query strings, selectors/identifiers, frame origins, browser identifiers and screenshots are excluded. Any description you type is included; do not include personal information. The developer and automated development tools can read submitted public issues to reproduce, test and fix bugs. Firefox requests optional browsingActivity and technicalAndInteraction consent before sharing. Declining or unavailable consent blocks sharing only; dark mode keeps working. You can revoke consent in Firefox add-on settings.

**Reporting service:** Cloudflare receives your network address to deliver the request. The service uses a secret-salted daily address hash for abuse limits; it does not store raw addresses, report bodies or browsing histories. Request hashes, daily counters and created issue links expire within 49 hours. These temporary records prevent duplicate submissions and limit abuse. Application request logging is disabled. GitHub retains the submitted public issue until it is removed under GitHub's policies. Recoloring never contacts this service.

**Full local report:** "Save full report locally" downloads the original diagnostics to your computer. This file can contain short page text snippets and element identifiers. No screenshot is captured; field contents are omitted. It is not uploaded by the extension. Review it before sharing it yourself.

**Permissions:** OLED Night runs on every site because recoloring pages is its purpose. The `storage` permission saves your settings, `activeTab` identifies the current site for the popup and keyboard shortcut, and `scripting` lets the popup check whether the current tab can be reached. No code is injected into the page's own scripts.

**Changes:** if this policy ever changes, the new version will be published with the extension update.

**Contact:** questions about this policy can be sent to the developer through https://github.com/bc1224/oled-night/issues.

Diagnostic contrast checks include form controls, but their contents are omitted. Passwords and entered form values are not read for the report.
