# Outreach drafts (not posted)

Drafts for the maintainer to review, edit and post personally. Each one says plainly that the author made OLED Night. Check each community's self-promotion rules before posting, post from your own account, and reply to comments yourself.

Links to use:
- Chrome: https://chromewebstore.google.com/detail/oled-night/afffgalhockmjmknnaljghdneaeichbl
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/oled-night/
- Source: https://github.com/bc1224/oled-night
- Site: https://bc1224.github.io/oled-night/
- Image: store/images/screenshot-1-before-after.png (before and after)

## Reddit: r/OLED_Gaming

Check first: the subreddit's rules on self-promotion and software posts. If a weekly thread or flair is required, use it.

**Title:** I made a free browser extension that turns websites true black (#000000) instead of dark grey

**Body:**

I'm the developer, so take this with that in mind.

I have an OLED monitor and wanted every website to be actually black, with the pixels off, not the #121212 grey most dark modes use. The extensions I tried either stayed grey or broke sites: unreadable text, white boxes, charts turning into blank shapes, product photos going black.

So I built OLED Night. It recolors each element instead of running one invert filter over the page, so text stays readable and photos, video and artwork keep their real colors. Sites that are already dark, like YouTube, only get their greys pushed to true black.

Some details:
- Per-site modes, brightness and contrast, optional image dimming, a schedule and keyboard shortcuts
- No analytics, ads or account. Open source (GPL-3.0)
- Chrome and Firefox. There's also a matching Chrome theme that makes the tabs and toolbar black

For OLED panels I run text brightness around 85% so white text on black isn't harsh at night.

It isn't perfect. Very large, constantly changing pages cost it some extra work, and canvas apps sometimes need the Invert mode. If a site looks wrong, the popup has a private "Report a broken site" button and I add a regression test for each fix.

Chrome: [link] / Firefox: [link] / Source: [link]

Feedback welcome, especially sites that still look grey or broken.

## Reddit: r/chrome

Check first: r/chrome rules on extension self-promotion. Some weeks it is only allowed in a pinned thread.

**Title:** I built an open-source dark mode extension focused on true black and not breaking sites

**Body:**

Disclosure: I'm the developer.

OLED Night is a free, open-source dark mode for Chrome (and Firefox). It differs from Chrome's Auto Dark Mode flag and filter-based extensions in a few ways:
- Backgrounds go true black (#000000), not dark grey
- Each element is recolored individually, so images, charts and brand colors aren't inverted
- Per-site control: Automatic, Full recolor, Deepen blacks only, Invert or Off, each with its own brightness and contrast
- No white flash on page load
- No analytics, ads or account; settings stay in your browser

Permissions are website access (to recolor pages), storage, and activeTab and scripting so the popup can identify the current site. Clipboard access is optional and only for pasting a screenshot into a bug report.

I measured the performance cost with the repo's benchmark and published the numbers, including the cases where it does more work than plain Chrome: [site link]#performance

Chrome Web Store: [link] / Source: [link]

## Product Hunt

**Name:** OLED Night

**Tagline (60 characters max):** True-black dark mode for every website, free and open source

**Description:**

OLED Night paints websites true black (#000000) so OLED pixels switch off, without the usual dark-mode damage. It recolors each element individually instead of inverting the page, so text stays readable and photos, video and charts keep their colors. Per-site modes, brightness and contrast, a schedule and shortcuts. No analytics, ads or account. Chrome and Firefox, GPL-3.0.

**Maker comment:**

Hi Product Hunt, I'm the maker. I built OLED Night because every dark mode I tried on my OLED monitor was either grey or broke sites I use every day. Each time a site broke, I fixed it and added an automated test that runs the real extension so it stays fixed. It's free and the code is public. I'd love to hear which sites still look wrong for you.

## Review-site pitch (email to an extension reviewer or tech blog)

**Subject:** Free open-source true-black dark mode for Chrome and Firefox (developer pitch)

Hi [name],

I'm the developer of OLED Night, a free, open-source dark-mode extension for Chrome and Firefox, and I thought it might fit your coverage of [browser extensions / OLED displays].

What's different:
- True black (#000000) backgrounds instead of dark grey, aimed at OLED and AMOLED screens
- Per-element recoloring instead of a page-wide invert filter, so images, charts and brand colors are preserved
- Per-site modes and tuning, a schedule and shortcuts
- No analytics, ads or account; GPL-3.0 source on GitHub
- Published benchmark numbers, including where it costs more than plain Chrome

Links: Chrome Web Store [link], Firefox Add-ons [link], source [link], site [link]. Screenshots and a 1400x560 banner are in the repo under store/images.

Happy to answer questions. No payment or affiliate arrangement is involved, and I'm not asking for a positive review, only a look.

Thanks,
[your name]
