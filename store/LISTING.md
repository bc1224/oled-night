# Chrome Web Store listing

Everything the Web Store dashboard asks for, ready to paste.

## Package
Upload `dist/oled-night-<version>.zip` (build it with `node tools/package.mjs`).

## Store listing tab

**Name:** OLED Night

**Summary** (132 characters max). The store shows the `description` from `manifest.json` here, so a new summary goes live with the next package:
> True-black dark mode for every site. Keeps images intact, readable text, per-site controls.

**Category:** Accessibility (alternative: Productivity)

**Language:** English

**Description:**

> OLED Night makes web pages true black while keeping text readable, images in their original colors and each site's controls within reach. Made for OLED displays, and useful on other screens too.
>
> LOCAL RECOLORING. NO BACKGROUND TRACKING.
> • The extension has no analytics, background telemetry, ads or OLED Night account.
> • OLED Night does not record or save your browsing history. Settings and per-site preferences use your browser's storage and can sync through your browser profile. The developer cannot see them.
> • Recoloring runs locally and does not upload page text or entered values.
>
> OPTIONAL PRIVATE BUG REPORTS
> • Choose Report a broken site to preview scrubbed technical diagnostics and add optional notes.
> • Use Screenshot this page, paste, drop or choose an image. Review it and choose Use screenshot. Nothing is uploaded until you choose Submit report.
> • The reporting service stores your domain, previewed diagnostics, notes and any screenshot privately for up to 30 days. Only the maintainer can retrieve them with GitHub authentication. No GitHub account is required to submit.
> • Automatic diagnostics exclude page text, entered values, URL paths, query strings, cookies and browser identifiers. Notes and screenshots can contain private information, so review them before submitting.
> • GitHub receives only a generic public tracking issue, with no domain, details, diagnostics or image link. Anything you manually add in GitHub issues or comments is public. Cloudflare retains scrubbed reports and images privately for up to 30 days, and abuse/deduplication records for up to 49 hours. Raw network addresses are not stored by the service.
> • Full diagnostic reports can be saved locally and reviewed before you share them yourself.
>
> WHAT IT DOES
> • True-black page backgrounds with distinct raised cards and panels.
> • Readable primary, secondary and muted text, plus dark logo lettering without an outside glow. Photos, video, artwork and bright brand accents stay protected.
> • Automatic dark mode, full recolor, deepen blacks only, invert for compatible canvas apps, or Off for each site.
> • Per-site text brightness, surface contrast and optional image dimming. All sites holds the defaults; saved site choices take priority.
> • Figma always keeps its native design colors, even when explicitly enabled. ChatGPT uses its native palette with OLED base surfaces for responsive streaming.
> • Scheduling and settings export/import.
> • Alt+Shift+E pauses or resumes OLED Night everywhere; Alt+Shift+D toggles the current site. Alternate shortcuts are Ctrl+Shift+9 and Ctrl+Shift+8 (Command instead of Ctrl on macOS). Customize them in your browser; the popup shows the assigned keys.
> • Handles modern CSS colors, web components, embedded frames and changing page content. Verification widgets are excluded from recoloring.
>
> Some pages restrict extensions, and some sites may need another mode or a site exception. The separate OLED Night Chrome theme darkens Chrome's own window; it is optional and does not work in Firefox.
>
> WHY IT ASKS FOR WEBSITE ACCESS
> Website access lets the extension read styles and recolor pages locally. Storage saves settings; activeTab identifies the current site for the popup and shortcuts; scripting checks whether the tab can be reached. Clipboard access is optional and used only for the explicit screenshot paste action.
>
> Free and open source under GPL-3.0.
> Source and support: https://github.com/bc1224/oled-night
> Privacy policy: https://github.com/bc1224/oled-night/blob/main/store/PRIVACY.md

**Graphic assets:**
- Store icon: `store/images/store-icon-128.png` (128x128, artwork padded to 96x96)
- Screenshots (1280x800): `store/images/screenshot-1-before-after.png`, `store/images/screenshot-2-popup.png`
- Small promo tile (440x280): `store/images/promo-small.png`

Regenerate the images with `node tools/store-assets.mjs`.

## Privacy tab

**Single purpose:**
> Makes web pages dark (true black) for comfortable reading, with per-site controls.

**Permission justifications:**
- `host_permissions: <all_urls>`: The extension reads styles locally to recolor pages. Full local diagnostic downloads may include short visible text snippets. Optional private bug reports share the previewed domain and technical diagnostics with the maintainer after explicit submission, plus notes or a screenshot the user chooses. Automatic diagnostics exclude page text and entered values. Screenshots and notes can contain personal information and are reviewed before submission.
- `clipboardRead` (optional): Reads an image only after the user chooses the screenshot paste action.
- `storage`: Saves the user's settings and per-site choices in Chrome sync storage.
- `activeTab`: Lets the popup and the keyboard shortcut identify the current site so its settings can be shown and changed.
- `scripting`: Lets the popup check whether the current tab can be reached (to offer a Reload button), and removes a page script that versions before 0.6.15 registered for the experimental "reach inside locked web components" setting. No code is injected into pages.

**Remote code:** No, the extension does not use remote code. All code ships in the package.

**Data usage:** Disclose Web history for the domain in optional bug reports and Website content for optional notes and screenshots. Explain that recoloring and full diagnostic downloads are local, while optional reports share the previewed domain, technical diagnostics and any notes or image privately with the maintainer for up to 30 days. Only a generic tracking issue is public. Confirm all three certifications (no selling, no unrelated use, no creditworthiness use). Keep dashboard disclosures consistent with the privacy policy; the upload API does not update these fields.

**Privacy policy URL:** Host `store/PRIVACY.md` somewhere public (for example a GitHub repo or gist, or your own site) and paste the link.

## Distribution tab
- Visibility: **Public** for the existing published extension. Preserve its current countries and distribution settings when changing copy.
- Regions: all.
