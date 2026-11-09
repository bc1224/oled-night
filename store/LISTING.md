# Chrome Web Store listing

Everything the Web Store dashboard asks for, ready to paste.

## Package
Upload `dist/oled-night-<version>.zip` (build it with `node tools/package.mjs`).

## Store listing tab

**Name:** OLED Night

**Summary** (132 characters max). The store shows the manifest `description` here. It is localized through `_locales/<lang>/messages.json` (`extDescription`), so a new summary goes live with the next package. English:
> True-black (#000000) dark mode for OLED screens. Readable text, untouched images, per-site controls. Free and open source.

**Category:** Accessibility (alternative: Productivity)

**Language:** English. Add German, Russian, Romanian and Spanish in the dashboard's language menu and paste the matching description from `store/listing-i18n/<lang>.txt` (de, ru, ro, es). The localized summary comes from the package automatically. These translations were written without a native-speaker review; have one skim them before publishing.

**Description:**

> OLED Night is a true-black dark mode for every website. Pages turn pure black instead of dark gray, so OLED and AMOLED screens can switch pixels off, while text stays crisp and photos and video keep their original colors.
>
> WHY OLED NIGHT
> • True black, not gray: page backgrounds go pure black, with subtly raised cards and panels so layouts stay easy to follow.
> • Images stay intact: photos, video, artwork, logos and brand accents are protected instead of inverted.
> • Readable text: primary, secondary and muted text are tuned for contrast on black, including dark logo lettering without a glow.
> • Built for modern sites: handles modern CSS colors, web components, embedded frames and pages that change as you scroll. Verification widgets are left untouched.
>
> CONTROL EVERY SITE
> • Choose a mode per site: Automatic, Full recolor, Deepen blacks only, Invert (for compatible canvas apps) or Off.
> • Per-site text brightness, surface contrast and optional image dimming. All sites holds your defaults; saved site choices take priority.
> • Schedule dark mode, and export or import your settings.
> • Shortcuts: Alt+Shift+E pauses or resumes OLED Night everywhere; Alt+Shift+D toggles the current site. Alternates are Ctrl+Shift+9 and Ctrl+Shift+8 (Command instead of Ctrl on macOS). Customize them in your browser; the popup shows the assigned keys.
> • Site-aware: Figma keeps its native design colors, and ChatGPT keeps its native palette on OLED black surfaces for smooth streaming.
>
> PRIVATE BY DESIGN
> • Recoloring runs entirely on your device. No analytics, background telemetry, ads or account.
> • OLED Night does not record or save your browsing history. Settings and per-site preferences stay in your browser's storage and can sync through your browser profile. The developer cannot see them.
>
> OPTIONAL PRIVATE BUG REPORTS
> • If a site looks wrong, choose Report a broken site. You preview scrubbed technical diagnostics and can add notes or a screenshot. Nothing is sent until you choose Submit report.
> • Reports are stored privately for up to 30 days, and only the maintainer can read them. No GitHub account is needed to submit.
> • Automatic diagnostics exclude page text, entered values, URL paths, query strings, cookies and browser identifiers. Notes and screenshots can contain private information, so review them before submitting.
> • A public GitHub tracking issue shows only a generic title, or the site domain, problem type, extension version and color mode if you pick a problem type. Your notes, other diagnostics and screenshots are never published.
> • You can also save a full diagnostic report locally and share it yourself.
>
> WHY IT ASKS FOR WEBSITE ACCESS
> Website access lets OLED Night read page styles and recolor pages locally. Storage saves settings; activeTab identifies the current site for the popup and shortcuts; scripting checks whether the tab can be reached. Clipboard access is optional and used only when you paste a screenshot into a report.
>
> Some pages restrict extensions, and a few sites may work better in another mode or with OLED Night off. The separate OLED Night Chrome theme darkens Chrome's own window; it is optional.
>
> Free and open source under GPL-3.0.
> Source and support: https://github.com/bc1224/oled-night
> Privacy policy: https://github.com/bc1224/oled-night/blob/main/store/PRIVACY.md

**Graphic assets:**
- Store icon: `store/images/store-icon-128.png` (128x128, artwork padded to 96x96)
- Screenshots (1280x800), upload in this order:
  1. `store/images/screenshot-1-before-after.png` (article page, before and after)
  2. `store/images/screenshot-2-popup.png` (popup)
  3. `store/images/screenshot-3-dashboard.png` (analytics dashboard, before and after; source page `store/demo-dashboard.html`)
  4. `store/images/screenshot-4-welcome.png` (welcome page)
  5. `store/images/screenshot-5-settings.png` (per-site rules in Settings)
- Small promo tile (440x280): `store/images/promo-small.png`
- Marquee promo tile (1400x560): `store/images/promo-marquee.png`
- GitHub social preview (1280x640, not a store asset): `store/images/social-preview.png`. Upload it in GitHub repository Settings > Social preview.

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

**Data usage:** Disclose Web history for the domain in optional bug reports and Website content for optional notes and screenshots. Explain that recoloring and full diagnostic downloads are local, while optional reports share the previewed domain, technical diagnostics and any notes or image privately with the maintainer for up to 30 days. The public tracking issue shows the domain, a fixed problem type, extension version and color mode only if the reporter picks a problem type; otherwise it has a generic title. Confirm all three certifications (no selling, no unrelated use, no creditworthiness use). Keep dashboard disclosures consistent with the privacy policy; the upload API does not update these fields.

**Privacy policy URL:** Host `store/PRIVACY.md` somewhere public (for example a GitHub repo or gist, or your own site) and paste the link.

## Distribution tab
- Visibility: **Public** for the existing published extension. Preserve its current countries and distribution settings when changing copy.
- Regions: all.
