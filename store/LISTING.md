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
> OLED Night makes every website true black, the kind of black that switches OLED pixels off, without the usual dark-mode side effects.
>
> LOCAL RECOLORING. NO BACKGROUND TRACKING.
> • No analytics, background telemetry, ads or OLED Night account. Recoloring runs locally.
> • Your settings live in Chrome's own sync storage. The developer never sees them.
> • Page text and field values are not uploaded. Optional reports share only the previewed domain and technical diagnostics with GitHub.
> • "Report a broken site" previews scrubbed diagnostics and opens a GitHub issue draft only when you choose. Full reports can still be saved locally.
> • Firefox asks native permission for optional domain/technical report sharing. Declining keeps dark mode working normally.
>
> 100% OPEN SOURCE (GPL-3.0)
> Every line of code is public on GitHub: https://github.com/bc1224/oled-night
> • Read exactly what runs on your pages before you install.
> • Every version is tagged on GitHub with its changelog and a downloadable build.
> • Report a broken site or request a feature in GitHub Issues.
>
> WHAT IT DOES
> • Real recoloring, not a blanket filter: photos, videos and artwork keep their true colors.
> • Readable text: main, secondary and muted text keep their emphasis instead of all turning the same grey.
> • Works on already-dark sites: it only deepens their greys to true black and leaves the design alone.
> • Handles modern web apps: web components, embedded frames, chat widgets, charts and modern CSS colors.
> • Leaves "verify you are human" checks (Cloudflare Turnstile, reCAPTCHA, hCaptcha and others) untouched so they keep working.
> • No white flash while pages load.
> • Per-site modes: automatic, full recolor, deepen blacks only, invert (for canvas apps such as spreadsheets and design tools), or off.
> • Per-site brightness and contrast, plus optional image dimming.
> • A schedule (for example, only at night) and a keyboard shortcut (Alt+Shift+D) to switch any site on or off.
> • Settings sync through your Chrome profile; export and import them as a file.
>
> WHY IT ASKS TO RUN ON EVERY SITE
> Recoloring pages is the whole job, so it has to run on the pages you visit. It only changes colors. Its other permissions just save your settings (storage) and let the popup and shortcut see which site you're on (activeTab, scripting).
>
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
- `host_permissions: <all_urls>`: The extension reads styles locally to recolor pages. Full local diagnostic downloads may include short visible text snippets. Optional GitHub drafts share only the previewed domain and technical diagnostics after the user chooses; page text and entered values are excluded from those drafts.
- `storage`: Saves the user's settings and per-site choices in Chrome sync storage.
- `activeTab`: Lets the popup and the keyboard shortcut identify the current site so its settings can be shown and changed.
- `scripting`: Lets the popup check whether the current tab can be reached (to offer a Reload button), and removes a page script that versions before 0.6.15 registered for the experimental "reach inside locked web components" setting. No code is injected into pages.

**Remote code:** No, the extension does not use remote code. All code ships in the package.

**Data usage:** Disclose Web history for the domain used in settings and optional bug reports, and Website content for local diagnostic snippets. Explain that recoloring and full reports are local, while optional GitHub drafts share only the previewed domain and technical diagnostics. Confirm all three certifications (no selling, no unrelated use, no creditworthiness use). Keep dashboard disclosures consistent with the privacy policy; the upload API does not update these fields.

**Privacy policy URL:** Host `store/PRIVACY.md` somewhere public (for example a GitHub repo or gist, or your own site) and paste the link.

## Distribution tab
- Visibility: **Unlisted** lets you share a link with specific people without appearing in search. Switch to Public later if you want.
- Regions: all.
