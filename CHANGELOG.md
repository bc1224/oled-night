# Changelog

## 0.6.13

- Fix input lag on large pages, measured on Discord: typing, hovering, focus moves and keyboard/mouse switches no longer restyle the whole document. Applies to every site.
- Re-read original colors by switching off only the overrides being checked, instead of whole subtrees; pseudo-element and page-background checks use their own narrow switches. Subtree switches remain where inherited text colors require them.
- Recheck only elements whose hover/focus state changed right away; other ancestors are rechecked once interaction pauses, so `:has()` and similar rules still apply.
- Page polarity checks no longer switch off the forced dark color scheme unless the page background depends on it (for example `light-dark()`).
- Simpler, accurate popup: one status line says what the page is actually doing, and why when it's off (site switch, All sites, schedule, system light mode, Figma). Tabs opened before an update get a Reload button instead of "Not active". Pages where the browser blocks extensions say so.
- Brightness and contrast appear only when they affect the page. On already-dark sites the popup explains they need full recolor and offers it. The Mode menu no longer repeats On/Off. Reset appears only when a site has its own settings. The Chrome theme link opens the store listing and is hidden in Firefox.
- Add Chrome regression coverage for scoped rechecks, theme classes with page transitions, `:has()` after typing, color-scheme-dependent pages and every popup control and status. No new permissions or theme changes.

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
