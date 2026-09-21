# Changelog

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
