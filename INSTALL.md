# Installing OLED Night

For normal installation and automatic updates, use the [Chrome Web Store](https://chromewebstore.google.com/detail/oled-night/afffgalhockmjmknnaljghdneaeichbl) or [Mozilla Add-ons for Firefox](https://addons.mozilla.org/en-US/firefox/addon/oled-night/). Firefox desktop 142 or newer is supported. The Chrome theme is separate and does not work in Firefox. See [FIREFOX.md](FIREFOX.md) for temporary Firefox development installs.

## Manual Chrome or Chromium installation

Download [`oled-night.zip`](https://github.com/bc1224/oled-night/releases/latest/download/oled-night.zip). It works in Chrome, Edge, Brave and other Chromium browsers.

1. Unzip the file into a folder you'll keep, such as `Documents\OLED Night`. Don't delete the folder afterwards: the browser loads the extension from it.
2. Open `chrome://extensions` (in Edge, `edge://extensions`).
3. Turn on **Developer mode** (top right in Chrome, left side in Edge).
4. Click **Load unpacked** and choose the unzipped folder, the one that contains `manifest.json`.
5. Click the puzzle-piece icon in the toolbar and pin **OLED Night**.
6. Reload any tabs that were already open.

**To update a manual install:** close Chrome, rename the old install folder as a backup, then create an empty folder at the original path and unzip the new version into it. Reopen Chrome and click the reload arrow on OLED Night's card in `chrome://extensions`. Keeping the original path keeps the unpacked extension's identity; using an empty folder avoids leftover files. To hear about new versions, open the [GitHub page](https://github.com/bc1224/oled-night) and click **Watch → Custom → Releases**.

## `_metadata` loading error

The release ZIP does not contain `_metadata`. Chrome creates verification metadata itself; leftover files in a manual install can cause the reserved-name error.

- **Manual install:** use the clean-folder update steps above. Don't copy files from Chrome's installed-extension profile directory into your manual install.
- **From source:** run `npm run package`, then load `dist/chrome`. Packaging rebuilds that folder and `dist/firefox` from runtime files only; treat them as generated output.
- **Chrome Web Store install:** try switching OLED Night off and on, then clear the old error in `chrome://extensions`. If it returns, report your Chrome version and whether it happens after clicking **Update**. Do not delete files inside Chrome's profile; an extension cannot repair Chrome's own installer.

Chrome's extension team has [discussed this warning during store updates](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/JxquRLk3Xk8/m/sMDViqExBAAJ). A successful clean-folder load confirms the manual-install recovery, not a fix for every Chrome update warning.

Chrome may show a "developer mode extensions" notice at startup. That's normal for extensions you install yourself, and you can dismiss it.

## Optional: make Chrome itself black
The extension darkens websites. To make Chrome's own tab bar, toolbar and new-tab page black too, download [`oled-night-theme.zip`](https://github.com/bc1224/oled-night/releases/latest/download/oled-night-theme.zip) and load it the same way (steps 1–4). To remove it later, open Chrome **Settings → Appearance → Theme** and choose **Reset to default**.

## Using it
- Click the toolbar icon to switch it on or off, pick a mode for the current site, and adjust brightness and contrast.
- **Alt+Shift+E** pauses or resumes OLED Night everywhere while preserving site rules; **Alt+Shift+D** turns the current site on or off.
- Alternate keys are **Ctrl+Shift+9** for OLED Night everywhere and **Ctrl+Shift+8** for the current site (Command on macOS). The popup and Settings show assigned keys; use **Settings & defaults → Change shortcuts** if a key is unavailable.
- If a site looks wrong, try **Deepen blacks only**, **Invert** for a compatible canvas app, or **Off** for that site. Figma always keeps its native colors.
- To report a problem, choose **Report a broken site**, review the diagnostics and add optional notes. Use **Screenshot this page**, paste, drop or choose an image, review it, then choose **Use screenshot**. Nothing is uploaded until **Submit report** creates a public GitHub issue. No GitHub sign-in is required. Keep private details out of notes and screenshots. Full local report downloads can contain text and identifiers, so review them before sharing.
