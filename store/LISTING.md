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

Keep it short; full permission and report details live in the Privacy tab and `store/PRIVACY.md`.

> OLED Night is a true-black dark mode for every website. Backgrounds turn pure black (#000000) instead of dark gray, so OLED screens can switch pixels off, while text stays crisp and photos, video and logos keep their real colors.
>
> • Pick a mode per site: Automatic, Full recolor, Deepen blacks only, Invert or Off.
> • Adjust text brightness, contrast and image dimming for each site.
> • Schedule dark mode, or toggle it with Alt+Shift+E (everywhere) and Alt+Shift+D (this site).
> • Works on modern sites, including web apps, embedded frames and pages that update as you scroll.
>
> Private by design: everything runs on your device. No analytics, ads or account, and no browsing history is recorded. If a site looks wrong, Report a broken site sends only what you review and approve.
>
> The optional OLED Night Chrome theme darkens Chrome's own window too.
>
> Free and open source: https://github.com/bc1224/oled-night
> Privacy policy: https://github.com/bc1224/oled-night/blob/main/store/PRIVACY.md

**Graphic assets:**
- Store icon: `store/images/store-icon-128.png` (128x128, artwork padded to 96x96)
- Screenshots (1280x800), upload in this order:
  1. `store/images/screenshot-1-before-after.png` (inbox, before and after)
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
