# Changelog

## 0.6.61

- Lift dark neutral and colored logo lettering without an outside glow, retaining transparent edges, bright accents, solid icon plates and product media.
- Include bounded logo checks on native dark pages in Automatic mode; clean rendering filters on disable, including shadow roots. Add Chrome and Firefox pixel coverage. No new permissions or tracking; Chrome theme remains 1.0.3.

## 0.6.60

- Darken TikTok Studio's layered shell and sidebar gradients while preserving image URLs, layer order, full-bleed photographs and caption overlays.
- Include the unreleased 0.6.59 LinkedIn repair for black title/truncation strips after scrolling. Add browser, pixel and cache-isolation regressions; retain existing performance gates.

## 0.6.58

- Preserve readable SVG music-control symbols, including disabled Skip, selected Follow and Shuffle states.
- Keep proven retained-card colors stable through later background updates without adding viewport work for unchanged surfaces. The separate Downdetector report remains unverified.

## 0.6.57

- Keep LinkedIn profile headings and Google Calendar booking surfaces continuous inside native dark cards while preserving focus, selection and artwork.
- Repair light shadow-component labels on dark pages and SVG controls whose shared symbol arrives late. Add repeated-update, restoration and rendered-pixel checks.

## 0.6.56

- Keep CSS-generated switch thumbs visible in both states without changing decorative shapes or colored thumbs.
- Add Chrome and Firefox keyboard, state, focus and actual thumb/track pixel regressions with existing performance and media gates retained.

## 0.6.55

- Preserve product photos, transparent color swatches and selected radio indicators; keep related header surfaces continuous and raised cards distinct.
- Bound large page updates and reduce focus/navigation work. Use ChatGPT's native palette with CSS-only OLED base surfaces for streaming conversations.

## 0.6.54

- Keep filled/unfilled rating stars visible, including Backcountry, without changing the rating.
- Give ChatGPT's empty and expanded composer a consistent raised surface. Cover live updates, expansion/collapse and disable restoration.

## 0.6.53

- Preserve product photos on native dark pages by correcting multiply/darken blending against a recolored tile.
- Add Chrome and Firefox live-image/restoration checks and Chrome rendered-pixel coverage for the native-dark product-image case.

## 0.6.52

- Keep Suno-style selected button icons readable after darkening and avoid inverting already-lightened ink.
- Retain raised native dark cards in Hetzner Cloud Console. Add selection, live-update, disable and explicit Deepen-mode regressions.

## 0.6.62

- Restore readable Google Analytics chart axes and legends while preserving data series colors.
- Darken the Analytics map canvas without filtering map controls or other canvases. Disabling OLED Night restores the original chart and map paint.

## 0.6.51

- Give the report form enough height even when OLED Night is paused, with fixed actions and a scrolling body.
- Simplify the form around notes and an explicit screenshot button. Capturing opens image review immediately; paste/upload and privacy details stay expandable.
- Show actionable feedback beside the report button when a page is disconnected or unresponsive, and prevent overlapping report requests.

## 0.6.50

- Keep proven background-only updates immediate instead of retaining offscreen rows in viewport tracking. This avoids repeated geometry work during animated inbox/list updates while preserving the conservative path for other page changes.
- Add alternate browser shortcuts: Ctrl+Shift+9 pauses or resumes OLED Night everywhere; Ctrl+Shift+8 toggles the current site. Keep existing shortcuts and custom assignments; show the keys actually registered by the browser in the popup and Settings.
- Cover conflicting extension shortcuts in real Chrome and retain the existing frame-throughput, contrast and component regression checks.

## 0.6.49

- Keep compact neutral switch thumbs visible against their tracks in both states, including Suno-style billing toggles.
- Darken bright generated button surfaces in automatic dark-page mode so PostHog-style action labels remain readable.
- Preserve authored text colors over promotional images inside busier cards, including Uber Eats-style yellow artwork.
- Give enabled checkbox, radio and switch boundaries enough contrast without brightening ordinary separators. Cover light DOM and shadow-root checkboxes, checked states and restoring authored styles on disable in Chrome and Firefox.
- These regression fixtures reproduce the reported rendering patterns; they do not establish a full authenticated audit of the four sites.

## 0.6.48

- Simplify site reporting with a full-width form, optional details and always-visible Cancel/Submit buttons.
- Restore native image paste focus, request optional clipboard access only from Paste image, and add an explicit Screenshot this site action with tab-change protection.
- Let reporters click an attached image to review it before sharing. Successful submission closes the form and shows a Successfully submitted confirmation with an issue link.

## 0.6.47

- Keep thin currentColor hamburger/close strokes readable inside compact controls, including rotated and hidden expanded states.
- Keep compact, explicitly identified inline SVG wordmarks readable on darkened surfaces, including wide animated navigation logos and paths added after loading. Preserve colored paint, unlabelled illustrations, larger artwork and adjacent opacity animations. Add synthetic Chrome/Firefox coverage for resting, focused, expanded and disabled states.
- The Anthropic hero text report remains open: animation interruption probes have not reproduced a stuck grey state. This wordmark correction does not establish a fix for that separate symptom.

## 0.6.46

- Preserve authored caption colors over hero artwork when an inline `<picture>` wrapper has no box but its positioned image fills the slide. Keep the image and its colored artwork unchanged; add a synthetic DMV-style carousel fixture with painted-pixel contrast checks.

## 0.6.45

- Preserve exact Google Sheets-style palette swatch colors, including white, grays, saturated colors, pastels and custom colors, while darkening the surrounding menu. Add a synthetic test-site case and Chrome/Firefox regressions for opening, selecting and updating colors.

- Repair compact control symbols with explicit neutral fills or strokes, including filled Send-style arrows that cannot inherit an outer SVG color override. Inspect local definitions or bounded, same-origin SVG assets; preserve colored and uncertain artwork, avoid redirects and stop pending work when disabled.
- Expand the synthetic chat interface regression across Send/Stop transitions, voice, disabled controls, keyboard focus, sidebar and response actions, opened menus/dialogs, late controls and narrow layouts. Check actual Chrome pixels and Firefox rendering states, preserving colored artwork and authored output on disable.
- These fixtures cover rendering patterns; the full authenticated live ChatGPT audit remains unverified because its security verification blocks browser access.

## 0.6.44

- Keep compact SVG sprite controls readable by repairing their inherited currentColor, including voice waveforms whose referenced strokes cannot be fixed through fill overrides. Preserve explicit sprite brand colors and readable native icons.
- Extend the synthetic ChatGPT lab fixture with local/external voice sprites, light/dark button surfaces, already-readable icons and colored sprite artwork. Verify composited Chrome pixels as well as both browsers' inherited ink contrast.

## 0.6.43

- Keep neutral Stop icons readable when Automatic mode darkens a light authored control on a dark page. Preserve dark-button inversion, colored artwork and non-control SVGs; add synthetic painted-pixel and text-contrast coverage with immutable-base Linux proof.
- Add a CI-only immutable-base report reproduction for the exact named public-lab assertion. Keep Chrome and Firefox reports separate and retain original base JSON before fixed results.
- Add the Windows MXC-only headless Chrome sandbox flag to existing test launchers; other launch defaults remain unchanged.

## 0.6.42

- Keep the report confirmation and optional notes; add an optional screenshot by drag and drop, Ctrl+V / ⌘V, Paste screenshot or file selection. Preview and remove images locally before explicit submission; never capture screenshots automatically.
- Resize/re-encode attached images without filenames or original metadata. Send the chosen image with the confirmed report, preserve duplicate protection and host the public attachment for up to 30 days. Request Firefox website-content consent only for an attached image.
- Cover local preview, removal, cancellation, explicit paste, submission, retry, expiry and invalid-image rejection with behavioral checks. Keep test browser launches hidden.
- Protect transparent and dark native links/buttons before their first interaction, and other semantic controls after interaction, from CSSOM background changes between measurements. Add first-entry and later-animation-frame regressions to the public CVS fixture.

## 0.6.40

- Read hover/focus styles after later event microtasks edit CSSOM; add deferred stylesheet hover/focus tests to the public CVS case.
- Update only changed paint overrides instead of rewriting every property; preserve repair after frameworks replace inline styles. Avoid extra computed-style passes when unrelated CSS transitions cannot affect a batch.
- Release detached shadow components and queued elements immediately on removal, including background tabs.
- Keep small monochrome checkout icons visible on native dark pages without changing colored payment brands or ordinary artwork. Neutral inline SVG badges invert their paired dark/light detail together; gradients, translucent brand colors and unknown referenced artwork stay untouched. Add fake Stripe-style checkout coverage with painted-pixel and mixed-paint assertions.
- Add a public mail-update performance case and required Chrome/Firefox native-versus-active animation tests. Gate frame throughput, p95 gaps and stalls; also gate Chrome script/style work and collected heap growth, plus component lifetime in both engines. Existing performance and screenshot limits remain unchanged.
- Explain report payload and GitHub retention before explicit Send; prevent duplicate drafts and sharing after cancellation. Add confirmation and cancellation regression checks without sending test reports.

## 0.6.39

- Discover late custom-element shadow roots without waiting for hover/focus. Add a cold-load regression and bounded discovery workload to the performance checks.
- Avoid empty generated-paint reads in small readable stylesheet scopes while retaining conservative reads for uncertain scopes. Recheck each batch and cover late CSSOM, adopted-sheet and exported-part labels.
- Preview scrubbed public diagnostics before opening a GitHub issue draft. Add reporting privacy/consent tests and a gated automatic-release contract; retain full reports as local downloads.

- Pair unlabelled light banners and email panels with readable ink on native dark pages in Automatic mode. Repair neutral dark newsletter text on solid dark canvases while preserving readable native text, status colors, artwork and explicit Deepen behavior.
- Use primary text brightness for enabled form values. Keep placeholders distinct and recognize compact colored logos by CSS and semantic labels without inverting brand colors.
- Add Gmail-style newsletter, Robinhood-style onboarding and SynXis-style booking regressions to the public lab and required Chrome/Firefox release checks, including mobile layout, focus, dynamic copy, preservation and disable restoration. No new website access permissions; Firefox adds optional report-sharing consent. Companion theme unchanged.

## 0.6.38

- Flush interaction-created surfaces before another paint, including mutations still queued in the page's event handlers. Discover late shadow roots and restore replaced adopted stylesheets.
- Keep deterministic CVS stress failures release-blocking, preserve performance budgets and reduce obsolete CI work. Chrome and Firefox store submissions use their configured APIs.

## 0.6.36

- Handle hover and focus changes inside nested shadow components, where browsers hide internal moves from the document listener. This fixes pale CVS navigation hover backgrounds and other component-based controls.
- Process composed events once, remove component listeners on disable/detachment, and restore them when reenabled. Keep interaction scans local and leave native select popups alone.
- Add real-pointer Chrome and keyboard Chrome/Firefox regressions. No new permissions; companion theme unchanged.

## 0.6.35

- Keep native text and logos legible over full-bleed images and videos that follow the copy in the DOM, including Apple heroes. Preserve opaque child panels and image captions.
- Make full-width neutral navigation and flyouts opaque OLED black without flattening raised cards.
- Keep dark shadow components stable through large ancestor updates. Recolor hovered/focused table rows as a unit, including sibling cells; handle bright interactive regions on native dark pages without overriding Deepen blacks only or ordinary content.
- Preserve layout and opacity transitions while suppressing color flashes during recoloring. Add Chrome and Firefox media/navigation regressions. No new permissions; companion theme unchanged.

## 0.6.33

- Keep YouTube's inline description and chapter text readable, including expanded descriptions and later renderer updates. Preserve colored annotations and highlighted text.
- Keep the animated like icon visible without changing SVG masks or pressed inverse buttons. Give the search button and chapter links native dark colors.
- Add Chrome and Firefox regressions based on the live YouTube failure, including ancestor background settings. No new permissions or body observers; companion theme unchanged.

## 0.6.32

- Reduce interaction recoloring globally: hover, focus and clicks reread changed controls and individual ancestors without disabling recoloring across entire page layouts. Recognize custom dropdown triggers using ARIA and data-action attributes.
- Improve external UI image/sprite visibility, including Amazon Business's bell and All menu. Keep ordinary content images unfiltered.
- Make broad flat page layouts black while preserving raised cards, borders, gradients and chart fills.
- Add large-page interaction and external-asset regressions in Chrome and Firefox. No new permissions.
- Companion theme 1.0.3 strengthens active-tab/toolbar separation and removes two unsupported Chrome color keys. Add a separate theme upload target to store automation.

## 0.6.31

- Keep ratings, progress and nested bar fills visible instead of mapping them to black panel backgrounds. Preserve widths, zero values, hue and transparency; includes narrow layouts and generated progress fills.
- Keep neutral SVG chart marks and labels readable while darkening the plot background.
- Skip transition guards on batches that have no transitions, reducing style invalidations during streaming updates. Preserve the conservative path for SVG and generated content.
- Include invisible data graphics in broken-site reports. Ignore inactive outlines. Add Chrome and Firefox regressions; no new permissions, companion theme unchanged.

## 0.6.30

- Leave password-manager inline menus untouched when they use a protected manual popover host. This prevents OLED Night from competing with Bitwarden's own attribute and style guard while preserving normal site popover recoloring (issue #3).
- Retain the YouTube native Light-theme correction from 0.6.29 (issue #1), which had not reached Chrome because its store upload failed.
- Add a regression for protected custom-element and div menu hosts. Store submissions now log the Chrome item's published and submitted revision states plus redacted API error codes to make upload failures diagnosable without exposing credentials or user data. No new permissions; companion theme unchanged.

## 0.6.29

- Fix YouTube's white masthead and nearly black text when its native theme is Light (issue #1). Automatic mode now reads YouTube's native dark color palette, including its renamed tokens, and keeps page surfaces OLED black.
- Apply the palette through CSS without changing YouTube's saved theme, traversing its player components, or inverting video. Delayed styles are handled by watching stylesheet changes in the document head only. Pausing OLED Night restores the original light or dark colors.
- Add Chrome and Firefox regressions for header/text contrast, theater layout and media preservation, native-theme restoration and shortcut toggling, plus Chrome coverage for late styles, brightness and inverse buttons. No new permissions; companion theme unchanged.

## 0.6.28

- Add **Alt+Shift+E** to turn OLED Night on or off everywhere, including sites with forced modes (issue #2). Resume restores saved site rules, tuning, appearance and schedule.
- Add a master switch beside the popup title and show both customizable shortcuts in the popup and Settings. **Alt+Shift+D** keeps toggling the current site; while paused everywhere, it leaves saved rules unchanged.
- Verify global pause/resume across tabs and embedded frames, new page loads while paused, preserved site settings, rapid shortcut presses, and Chrome/Firefox shortcut registration. No new permissions; companion theme unchanged.

## 0.6.27

- Keep white cards distinct from the true-black page and retain authored outlines. Sketchfab's white Getting Started card previously collapsed into the same black as its surrounding page.
- Preserve the depth of colored gradients and the brightness of their white labels. Flat colored controls retain their existing dark mapping for contrast.
- Preserve intentionally transparent embedded frames, so a canvas viewer can show the host page's backdrop instead of an extension-painted black rectangle.
- Add Chrome regressions for card separation, outline visibility, gradient depth, and transparent canvas frames. The reported Amazon sort delay remains unresolved.

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
