# Changelog

## 0.6.26

- Leave password sign-in pages with an active CAPTCHA provider entirely native so OLED Night cannot interfere with token generation or form submission. The Industrie Australia login page uses Shopify's CAPTCHA bootstrap. This safeguards the form; the exact provider-side failure is not directly observable without submitting credentials.
- Recheck the controlled menu and existing contents when a trigger expands, and observe `open` state changes. This fixes Industrie Australia's white mega-menu labels after the menu appears.
- Preserve outline SVG geometry and recolor its root tile. This fixes the white square header icons on Industrie Australia.
- Add Chrome regressions for all three cases. Amazon's reported 5–10 second native sort delay remains unresolved; a Chrome-control click is not an input-to-paint measurement.

## 0.6.25

- Keep text legible on light photographs used as full-bleed sibling media behind promotional and hero copy. This addresses the observed Walmart and Microsoft overlays without changing the image files.
- Recolor dark generated icon glyphs on newly darkened headers, including Ralph Lauren's search icon.
- Leave the browser's native select opening path alone during pointer and keyboard interaction. The static dark option styling remains active. This removes one extension handler cost, but the reported Amazon delay is not yet proven resolved.
- Add Chrome regression fixtures for image overlays, generated icons, and native select events. Audit 52 live Chrome pages and document both findings and coverage limits in `AUDIT-2026-10-01.md`. No new permissions or theme changes.

## 0.6.24 (local package)

- Restore OLED Night's constructed stylesheet when a web component replaces its `adoptedStyleSheets` after initial styling. This keeps mapped text and its background together in dynamic shadow roots such as Adobe account cards.
- Raise the contrast of small, labeled icons that the page intentionally fades on a light surface when OLED Night darkens that surface. Normal images and icons on originally dark surfaces retain their appearance.
- Add Chrome and Firefox regressions for stylesheet replacement and faded icons. No new permissions or theme changes.

## 0.6.23 (local package)

- Recolor Gmail's light reading pane, authored email tables, search field, and search suggestions as complete regions even when Gmail's surrounding shell is already dark. This fixes white message bodies and black suggestion text on a dark popup.
- Keep the email's light `color-scheme` for `WindowText` resolution, then map its actual text and background together. Scope the extra work to Gmail's affected regions without a page-wide query on each interaction.
- Replace the Gmail contrast fixture with a native-dark shell, white email and popup, and dark authored text; verify disabling the extension restores the original colors.

## 0.6.22 (local package)

- Restore Gmail email paragraphs that use the system `WindowText` color. The extension's dark color scheme made them white on a sender-authored white email canvas; Gmail message content now resolves system colors in a light scheme.
- Darken Gmail's search suggestion panel so recolored light suggestion text remains readable.
- Add Chrome regression checks for both contrast failures. No new permissions or theme changes.

## 0.6.21 (local package)

- Preserve pale, darken-blended image mattes positioned above product photos. OLED Night had turned Amazon Grocery's matte black and hidden fully loaded product images.
- Reduce glare from Amazon's collapsed Compare circles without changing product image files.
- Defer native select ancestor recoloring until interaction settles so opening a sort menu does not recheck a large ancestor subtree before the popup paints. The select and its options still update immediately.
- Add Chrome regression checks for the image matte, Compare control, and native select opening path. No new permissions or theme changes.

## 0.6.20

- Recheck a page's original light or dark theme when its root or body inline styles change after load. Pages such as iFixit can declare a light color scheme late; OLED Night now measures with its forced dark scheme temporarily off so dark text is recolored for the black background.
- Add Chrome and Firefox regression checks for a delayed light theme. No new permissions or theme changes.

## 0.6.19

- Preserve dark square app icons with transparent corners. The logo readability filter now inverts sparse dark lettering, while leaving filled icons and their brand colors intact. This fixes the white OLED Night icon on the Mozilla Add-ons developer dashboard.
- Add Chrome and Firefox regression checks for a dark app icon. No new permissions or theme changes.

## 0.6.18

- Keep Amazon-style product photos visible when an `<img>` sits inside `<picture>` and uses `mix-blend-mode: multiply`. The image walker now checks the image before skipping the protected `<picture>` subtree, including pictures added after page load.
- Add regression coverage for existing and dynamically added picture products. Add an optional CPU profile capture to the isolated benchmark for investigating busy-page overhead. No new permissions or theme changes.

## 0.6.17

- Give native select options and optgroup labels an explicit dark surface and readable text while OLED Night is active. This fixes transparent options that Chrome painted on a white popup over a dark page, as seen on Glimbo.
- Recolor light ARIA menus and listboxes that open over an already dark page, including their text and dynamically added items. Existing dark cards and site accents keep their colors.
- Add Chrome and Firefox regression coverage for native, grouped, custom and late-opening dropdowns, plus style restoration when the extension is off. No new permissions or theme changes.

## 0.6.16

- Fix ordinary pages staying white since 0.6.15 because they load bot-detection scripts or mention captchas in inline data (for example 2captcha.com and sites behind Imperva, AWS WAF or Cloudflare bot management). A page is now treated as a full-page challenge only by markers that exist on the interstitial itself.
- Fix a challenge page being darkened when its only marker is a script near the end of the body; the check now runs again once the page has parsed. Pages whose challenge clears in place are darkened afterwards.
- Fix site components left undarkened because their class or id contains "captcha" or "challenge": login and sign-up forms wrapped in a "captcha" container, and frames whose query or hash mentions a challenge. Only real provider widgets (Turnstile, reCAPTCHA, hCaptcha, Arkose, GeeTest, HUMAN/PerimeterX, AWS WAF, Friendly Captcha, DataDome, Kasada) and captcha containers without a form of their own are left alone.
- Skip bot-check matching while walking subtrees that hold no widget.
- Add regression coverage for each case. No new permissions.

## 0.6.15

- Fix Cloudflare Turnstile and other human-verification checks failing while OLED Night is on. The experimental "reach inside locked web components" option replaced the page's own `attachShadow` function and forced closed components open, in every frame including verification frames; bot checks detect that as tampering. Closed components are now read through the extension-only API (`chrome.dom.openOrClosedShadowRoot` / `openOrClosedShadowRoot` in Firefox), so no page function is changed and closed components stay closed to the page. Any page script registered by an earlier version is removed.
- Leave every verification provider alone, not just Cloudflare: Turnstile, reCAPTCHA, hCaptcha, Arkose/FunCaptcha, DataDome, HUMAN/PerimeterX, GeeTest, AWS WAF, Friendly Captcha, MTCaptcha and generic captcha/challenge widgets. Their frames get no content script (`exclude_matches` plus a URL backstop, including script-built frames inside a widget), their in-page containers are never recolored or marked, closed components holding them are skipped, and whole-page challenges ("Just a moment...") are not darkened.
- Add Chrome and Firefox regression coverage: page `attachShadow` stays native with the option on and off, closed roots stay closed, Turnstile/hCaptcha/reCAPTCHA/PerimeterX-style widgets stay untouched while the rest of the page darkens, and a full-page challenge is left alone. No new permissions.

## 0.6.14

- Fix input lag on large pages, measured on Discord: typing, hovering, focus moves and keyboard/mouse switches no longer restyle the whole document. Applies to every site.
- Re-read original colors by switching off only the overrides being checked, instead of whole subtrees; pseudo-element and page-background checks use their own narrow switches. Subtree switches remain where inherited text colors require them.
- Recheck only elements whose hover/focus state changed right away; other ancestors are rechecked once interaction pauses, so `:has()` and similar rules still apply.
- Page polarity checks no longer switch off the forced dark color scheme unless the page background depends on it (for example `light-dark()`).
- Simpler, accurate popup: one status line says what the page is actually doing, and why when it's off (site switch, All sites, schedule, system light mode, Figma). Tabs opened before an update get a Reload button instead of "Not active". Pages where the browser blocks extensions say so.
- Brightness and contrast appear only when they affect the page. On already-dark sites the popup explains they need full recolor and offers it. The Mode menu no longer repeats On/Off. Reset appears only when a site has its own settings. The Chrome theme link opens the store listing and is hidden in Firefox.
- The popup now covers only the current site. Default appearance, brightness, contrast and image dimming moved to Settings, under Defaults.
- Settings: the site list is collapsed with a count, uses the popup's mode names, and each site has Reset. The popup no longer saves image dimming that matches the default. The shortcut only acts on websites, not browser pages such as the Extensions page.
- Add Chrome regression coverage for scoped rechecks, theme classes with page transitions, `:has()` after typing, color-scheme-dependent pages, every popup control and status, and the Settings defaults and site list. No new permissions or theme changes. (0.6.13 was an unreleased test build.)

## 0.6.12

- Keep Amazon accordion arrows, delivery-dialog close icons and show-more chevrons visible on dark surfaces.
- Limit sprite recoloring to known monochrome controls; preserve other icons and images and restore original styling when disabled.
- Add Chrome and Firefox regression coverage. No new observers, permissions or theme changes.

## 0.6.11

- Combine interaction and mutation updates in one pre-paint batch; remove overlapping subtree work.
- Skip transform/opacity-only inline animation updates while detecting changed page declarations, inherited custom properties and overwritten overrides.
- Share bounded pure surface mappings for repeated colors, gradients, shadows and masks. Element styles remain freshly measured when needed.
- Recheck pages when stylesheets are inserted, edited, removed or loaded; retain global theme-change handling.
- Cancel queued work when disabled and add Chrome/Firefox efficiency and correctness regressions.
- Keep optimizations automatic; no speed/accuracy toggle or new permissions. Theme unchanged at 1.0.2.

## 0.6.10

- Bound and reuse pure color conversions to reduce repeated CPU work without caching stale element styles.

- Process pending color changes before the next paint instead of waiting for idle time, reducing flashes in newly loaded sections.
- Restore field overrides after frameworks replace inline styles (Maps-style dark text on black).
- Keep highlighted rows readable when sites use more-specific important CSS (FlightAware and Amazon).
- Separate current-site controls from global defaults, add a site switch, clarify slider effects and retain all rapid slider changes when saving.
- Leave Figma native by default and protect identifiable color pickers/swatches.
- Validate imported settings and diagnose field contrast without including field contents.
- Audit extension behavior, privacy, performance and theme palette; theme remains 1.0.2.

## 0.6.9
- Recheck CSS-only hover, focus, active and field states across sites, including transparent dropdown rows and open shadow components. Interaction updates run before the next paint and stay scoped to the affected control and its ancestors.
- Keep explicit field text-fill, caret and placeholder colors readable. Native autofill gets a dark inset surface and readable text without changing field values or focus outlines.
- Add cross-browser focus/blur and field regressions, plus Chrome real-pointer and browser-forced autofill-state coverage. Saved credentials are not needed for these tests.

## 0.6.8
- Gmail's trimmed-content ellipsis is visible on dark backgrounds. Compact dark/mixed-color logos gain contrast without inverting their brand colors, including named logo assets behind image proxies.
- Selected dropdown options stay readable when a site's important background rule loads after OLED Night (including Reddit Ads).
- Recolor dropdown state changes driven by ARIA selection/checking and component state attributes.
- Added Chrome and Firefox regression coverage for dropdown selection and restoring original colors when disabled.

## 0.6.7
- Added a Firefox desktop preview package, native Firefox API support, and Firefox-specific settings instructions.
- Added Firefox runtime regression tests and packaging to CI. Mozilla signing is still pending.

## 0.6.6
- Apple sign-in fields keep readable text and password dots on black, including autofill and focus states.
- Reddit Enhancement Suite's floating account toolbar now matches the dark page, with visible icons.

## 0.6.5
- Icons drawn through masks (like App Store Connect's logo and info icons) and text painted by its background now turn light instead of disappearing or blowing out.
- Charts that add shapes after they first draw (Google Ads' shaded date band) get those shapes darkened too.
- Turning the main switch on also clears an "Off" on the current site, and the popup says when a site setting is overriding the switch.

## 0.6.4
- Relicensed from MIT to GPL-3.0: copies and modified versions that are shared or sold must stay open source. The license file now ships inside the zip.

## 0.6.3
- "Report a broken site" also lists each embedded frame and whether it was darkened (origin only, never its address or content).
- Clearer popup message on pages Chrome keeps extensions off (chrome:// pages, the Chrome Web Store).

## 0.6.2
- Settings page and popup link to the companion OLED Night Chrome theme.
- Amazon and other shops: product photos no longer turn into black squares. The "multiply" blend they use to hide white photo backgrounds is switched off where the page goes black.
- Dark, transparent logos and wordmarks (like Wikipedia's) are flipped to light so they stay visible. Colored logos and photos are left alone.
- Heavy pages start darkening as soon as the page body appears instead of after the whole page loads, so there's less white flash on big sites.
- The popup shows the version number. A companion Chrome theme ships as its own download.

## 0.6.1
- Gmail: unread emails get a blue edge and full-brightness text, and read emails are dimmed, so they're easy to tell apart.

## 0.6.0
- Per-site modes: automatic, full recolor, deepen blacks only, invert (canvas apps), off.
- Per-site brightness, contrast and image dimming, all applied live.
- Schedule, Alt+Shift+D shortcut, settings export and import, and a "Report a broken site" button.
- Dark scrollbars and text selection. An experimental option reaches inside locked web components.

## 0.5.x
- Charts and graphs: pale area fills and gradients go dark, and colored lines keep their color.
- No more light flashes from sites' color animations.
- Already-dark sites only get their darkest greys pushed to true black.
- Frames and chat widgets are darkened, with no white flash on load.
- Text keeps primary, secondary and muted emphasis. Dark icons are brightened. Colored borders keep their color. Pale tints become subtle dark tints.

## 0.4.0
- The sliders are about 7× faster (no re-scan while dragging). Brightness now runs 40–100 and contrast 0–100.

## 0.3.x
- Web components (Apple Ads and similar dashboards) and modern CSS color formats (Ralphs and similar sites).
- A rewrite for speed: no more lag on Gmail and ChatGPT.
- White gradients and glows around chats are gone. Text is only lightened when the background behind it is actually dark.
