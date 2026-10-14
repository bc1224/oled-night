# OLED Night privacy policy

_Last updated: October 14, 2026_

OLED Night is a browser extension that recolors web pages locally. Sharing a bug report is an optional, explicit action.

**Automatic collection:** none. OLED Night has no servers, analytics, advertising or tracking. Optional public bug reports and browser-account syncing are described below.

**Browsing history:** OLED Night does not record or save a log of the pages you visit. Firefox's optional browsing-activity permission covers sharing the current site's domain in a bug report, only after you preview it and choose to open a GitHub draft. It does not enable history tracking. Per-site settings store your chosen preferences for a domain, not visits or page URLs. GitHub retains drafts and reports according to its own policies; submitted issues are public. OLED Night has no separate report database.

**What it stores:** your settings (on/off, appearance, brightness, contrast, schedule and per-site choices). They are kept in your browser's sync storage, so your browser can sync them between your signed-in browsers. The developer cannot see them.

**Page content:** to recolor a page, OLED Night reads element colors locally. Recoloring does not upload page text or entered values. Optional computed-color diagnostics and explicit local report downloads are described below.

**Diagnostic reports:** "Report a broken site" first shows a preview. If you choose "Open GitHub draft", the domain, extension version, mode, brightness/contrast settings, element counts and computed contrast colors/ratios are sent to GitHub in an issue draft. Page text, field values, URL paths/query strings, selectors/identifiers, frame origins, browser identifiers and screenshots are excluded. The issue becomes public only when you submit it on GitHub. The developer and automated development tools can read submitted public issues to reproduce, test and fix bugs. Do not add private information to your description. Firefox requests optional browsingActivity and technicalAndInteraction consent for this domain/diagnostic sharing before opening the draft. Declining or unavailable consent blocks sharing only; dark mode keeps working. You can revoke consent in Firefox add-on settings.

**Full local report:** "Save full report locally" downloads the original diagnostics to your computer. This file can contain short page text snippets and element identifiers. No screenshot is captured; field contents are omitted. It is not uploaded by the extension. Review it before sharing it yourself.

**Permissions:** OLED Night runs on every site because recoloring pages is its purpose. The `storage` permission saves your settings, `activeTab` identifies the current site for the popup and keyboard shortcut, and `scripting` lets the popup check whether the current tab can be reached. No code is injected into the page's own scripts.

**Changes:** if this policy ever changes, the new version will be published with the extension update.

**Contact:** questions about this policy can be sent to the developer through https://github.com/bc1224/oled-night/issues.

Diagnostic contrast checks include form controls, but their contents are omitted. Passwords and entered form values are not read for the report.
