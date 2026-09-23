# Chrome Web Store listing

Everything the Web Store dashboard asks for, ready to paste.

## Package
Upload `dist/oled-night-<version>.zip` (build it with `node tools/package.mjs`).

## Store listing tab

**Name:** OLED Night

**Summary** (132 characters max):
> True-black dark mode for every site. Keeps images intact and text readable, with per-site modes and brightness.

**Category:** Accessibility (alternative: Productivity)

**Language:** English

**Description:**
> OLED Night turns websites true black, the kind of black that switches OLED pixels off completely, without the usual dark-mode side effects.
>
> • Real recoloring, not a blanket filter: photos, videos and artwork keep their true colors.
> • Readable text: main, secondary and muted text keep their emphasis instead of all turning the same grey.
> • Works on already-dark sites: it only deepens their greys to true black and leaves the design alone.
> • Handles modern web apps: web components, embedded frames and chat widgets, charts, and modern CSS color formats.
> • No white flash while pages load.
> • Per-site modes: automatic, full recolor, deepen blacks only, invert (for canvas apps such as spreadsheets and design tools), or off.
> • Per-site brightness and contrast, plus optional image dimming.
> • A schedule (for example, only at night) and a keyboard shortcut (Alt+Shift+D) to switch any site on or off.
> • Settings sync through your Chrome profile; export and import them as a file.
>
> Private by design: OLED Night never sends data anywhere. It has no servers, no analytics and no tracking.

**Graphic assets:**
- Store icon: `store/images/store-icon-128.png` (128x128, artwork padded to 96x96)
- Screenshots (1280x800): `store/images/screenshot-1-before-after.png`, `store/images/screenshot-2-popup.png`
- Small promo tile (440x280): `store/images/promo-small.png`

Regenerate the images with `node tools/store-assets.mjs`.

## Privacy tab

**Single purpose:**
> Makes web pages dark (true black) for comfortable reading, with per-site controls.

**Permission justifications:**
- `host_permissions: <all_urls>`: The extension recolors the pages the user visits, so its content script must run on every site. It only changes colors on the page; it does not read, store or send page content.
- `storage`: Saves the user's settings and per-site choices in Chrome sync storage.
- `activeTab`: Lets the popup and the keyboard shortcut identify the current site so its settings can be shown and changed.
- `scripting`: Lets the popup check whether the current tab can be reached (to offer a Reload button), and removes a page script that versions before 0.6.15 registered for the experimental "reach inside locked web components" setting. No code is injected into pages.

**Remote code:** No, the extension does not use remote code. All code ships in the package.

**Data usage:** Declare that no user data is collected. Check none of the data categories, and confirm all three certifications (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** Host `store/PRIVACY.md` somewhere public (for example a GitHub repo or gist, or your own site) and paste the link.

## Distribution tab
- Visibility: **Unlisted** lets you share a link with specific people without appearing in search. Switch to Public later if you want.
- Regions: all.
