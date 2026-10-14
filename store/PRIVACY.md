# OLED Night privacy policy

_Last updated: October 14, 2026_

OLED Night is a browser extension that makes web pages dark. It is built to work entirely inside your browser.

**Automatic collection:** none. OLED Night has no servers, analytics, advertising or tracking. Optional public bug reports and browser-account syncing are described below.

**What it stores:** your settings (on/off, appearance, brightness, contrast, schedule and per-site choices). They are kept in your browser's sync storage, so your browser can sync them between your signed-in browsers. The developer cannot see them.

**Page content:** to recolor a page, OLED Night reads the colors of the elements on it, inside your browser. It does not save or transmit page content.

**Diagnostic reports:** "Report a broken site" first shows a preview. If you choose "Open GitHub draft", the domain, extension version, mode, brightness/contrast settings, element counts and computed contrast colors/ratios are sent to GitHub in an issue draft. Page text, field values, URL paths/query strings, selectors/identifiers, frame origins, browser identifiers and screenshots are excluded. The issue becomes public only when you submit it on GitHub. The developer and automated development tools can read submitted public issues to reproduce, test and fix bugs. Do not add private information to your description.

**Full local report:** "Save full report locally" downloads the original diagnostics to your computer. This file can contain short page text snippets and element identifiers. No screenshot is captured; field contents are omitted. It is not uploaded by the extension. Review it before sharing it yourself.

**Permissions:** OLED Night runs on every site because recoloring pages is its purpose. The `storage` permission saves your settings, `activeTab` identifies the current site for the popup and keyboard shortcut, and `scripting` lets the popup check whether the current tab can be reached. No code is injected into the page's own scripts.

**Changes:** if this policy ever changes, the new version will be published with the extension update.

**Contact:** questions about this policy can be sent to the developer through https://github.com/bc1224/oled-night/issues.

Diagnostic contrast checks include form controls, but their contents are omitted. Passwords and entered form values are not read for the report.
