(function () {
  "use strict";
  const chrome = globalThis.browser || globalThis.chrome;

  const VERSION = "0.6.56";
  const Settings = globalThis.OledNightSettings;
  const DEFAULTS = Settings.DEFAULTS;
  const MEDIA_SELECTOR = "img, picture, video, canvas, svg, iframe, object, embed, shreddit-player, shreddit-async-loader, shreddit-media-lightbox, zoomable-img";
  // Explicit color controls carry data, not decorative page colors.
  const COLOR_CONTROL = 'input[type="color"], [data-oled-night-preserve-colors], .react-colorful, .color-picker, .color-swatch, .goog-palette-colorswatch, .goog-palette-customcolor, .docs-material-colorpalette-colorswatch, .docs-material-colorpalette-colorswatch-color, [role="slider"][aria-label*="hue" i], [role="slider"][aria-label*="saturation" i], [role="slider"][aria-label*="color" i]';

  const ICON_PARTS = "path, circle, rect, ellipse, polygon, polyline, line, text, use, g";
  const CHART_PARTS = `${ICON_PARTS}, stop`;
  const MARK = "data-oled-night";
  const SHARED_BG = "data-oled-night-bg";
  const MEASURE = "data-oled-night-measure";
  // Set while we swap overrides in and out, so site CSS transitions on colors
  // never animate between our dark value and the original light one.
  const NOANIM = "data-oled-night-noanim";
  const MOTION = "data-oled-night-motion";
  // Element-only variants. Toggling the subtree forms on a large ancestor
  // restyles every descendant, which is expensive on any large page.
  const MEASURE_SELF = "data-oled-night-measure-self";
  const NOANIM_SELF = "data-oled-night-noanim-self";
  // Chrome restyles the whole subtree around any element whose attribute is
  // named in a ::placeholder/::before/::after rule, so those rules use their own
  // switch, set only on elements that carry pseudo-element overrides.
  const MEASURE_PSEUDO = "data-oled-night-measure-pseudo";
  const PSEUDO_KEYS = /(?:^|\s)(?:before-|after-|placeholder)/;
  // Switches off only the page background on <html>/<body>. The inherited
  // color-scheme stays, so a polarity check does not restyle the whole page.
  const MEASURE_ROOT = "data-oled-night-measure-root";
  // Overrides that descendants inherit, so switching them needs a subtree calm.
  const INHERITED_KEYS = /(?:^|\s)(?:fg|ink|caret|fill|stroke|field)(?:\s|$)/;
  // Above this many re-read overrides, subtree switches cost less than per-element ones.
  const MANY_MARKED = 150;
  const COLOR_TRANSITION = /^all$|color|background|border|shadow|fill|stroke/;
  const LOGO = "data-oled-night-logo";
  const LOGO_EDGE = "data-oled-night-logo-edge";
  // "Multiply"-style blends hide a photo's white background on a light page;
  // over black they turn the whole photo black (Amazon product images).
  const DARKENING_BLENDS = /^(multiply|darken|color-burn|plus-darker)$/;
  const PROPS = ["bg", "img", "shadow", "fg", "ink", "caret", "placeholder", "field", "bt", "br", "bb", "bl", "fill", "stroke", "stop", "blend", "faded-icon", "asset-icon", "icon-invert", "data",
    "before-bg", "before-img", "before-shadow", "before-fg", "after-bg", "after-img", "after-shadow", "after-fg"];
  const SIDES = [["Top", "bt"], ["Right", "br"], ["Bottom", "bb"], ["Left", "bl"]];
  // Frames that are players, maps, ads or challenges are left exactly as they are.
  const UNTOUCHED_FRAMES = /(youtube(-nocookie)?\.com|vimeo\.com|player\.|twitch\.tv|spotify\.com|soundcloud\.com|maps\.google|google\.[a-z.]+\/maps|doubleclick\.net|googlesyndication\.com)/i;
  // Bot and human verification of any provider (Turnstile, reCAPTCHA, hCaptcha,
  // Arkose, DataDome, HUMAN/PerimeterX, GeeTest, AWS WAF, Friendly Captcha and
  // others). These check the page for tampering, so their frames, widgets and
  // full-page challenges are never recolored, marked or observed. Frame URLs
  // are matched on origin and path only, so a query or hash that merely
  // mentions a challenge doesn't leave a normal embed white.
  const BOT_CHECK_URL = /captcha|challenges\.cloudflare\.com|challenge-platform|turnstile|arkoselabs|funcaptcha|geetest|perimeterx|px-cloud\.net|px-cdn\.net|humansecurity|datadome|awswaf|kasada|friendlycaptcha|frcapi|\/cdn-cgi\//i;
  const AUTH_PATH = /\/(?:account\/)?(?:login|signin|sign-in|register|signup)(?:\/|$)/i;
  const frameUrl = (src) => { try { const url = new URL(src, location.href); return url.origin + url.pathname; } catch { return ""; } };
  // Provider widgets by their own markup. A site's own element that merely has
  // "captcha" in its name counts only while it holds no form of its own, so a
  // login form wrapped in "login-captcha-wrapper" is still darkened.
  const BOT_CHECK = ':is([data-sitekey], .cf-turnstile, [id^="cf-chl-"], [id^="cf-turnstile"], .g-recaptcha, .grecaptcha-badge, .h-captcha, .frc-captcha, .frc-container, #px-captcha, [class^="geetest_"], [class*=" geetest_"], [id^="arkose"], [id^="funcaptcha"], awswaf-captcha, :is([class*="captcha" i], [id*="captcha" i]):not(input, select, button, textarea):not(:has(form, input:not([type="hidden"]), select, button, textarea:not([name*="response" i]))), iframe[src*="captcha" i], iframe[src*="challenges.cloudflare.com"], iframe[src*="/challenge-platform/"], iframe[src*="arkoselabs"], iframe[src*="geetest"], iframe[src*="perimeterx"], iframe[src*="px-cloud.net"], iframe[src*="px-cdn.net"], iframe[src*="datadome"], iframe[src*="awswaf"], iframe[src*="kasada"], iframe[src*="frcapi"]):not(html, body)';
  // Subtrees we never recolor: color data and verification widgets.
  const PRESERVE = `${COLOR_CONTROL}, ${BOT_CHECK}`;
  // Password managers inject top-layer menus into the page. Bitwarden's menu
  // hosts use this manual-popover/fixed/max-z combination and actively remove any
  // foreign attributes or styles. Marking them causes both extensions to
  // repeatedly undo each other's mutations and can interrupt autofill.
  const isExternalOverlay = (element) => element.getAttribute("popover") === "manual" &&
    element.style.position === "fixed" && element.style.zIndex === "2147483647";
  const STATE_ATTRIBUTES = ["aria-selected", "aria-checked", "aria-expanded", "aria-disabled", "data-state", "data-highlighted", "selected", "disabled", "open", "hidden"];
  const classSnapshots = new WeakMap();
  const sheetSnapshots = new WeakMap();
  const largeScopes = new WeakSet();
  const OBSERVE = { childList: true, characterData: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["class", "style", "href", "media", MARK, SHARED_BG, ...STATE_ATTRIBUTES] };
  const isTopFrame = (() => { try { return typeof window === "undefined" || window.top === window; } catch { return false; } })();

  let observer = null;
  let stopYouTubeTheme = null;
  let challengeTimer = null;
  let active = false;
  let darkPage = false;
  let pageColor = { r: 255, g: 255, b: 255, a: 1 };
  let polarityDirty = false;
  // The page's own background follows color-scheme (light-dark(), Canvas):
  // polarity checks must also switch off our forced dark scheme.
  let schemeSensitive = false;
  let batchPolarity = null;
  let domReady = document.readyState !== "loading";
  let settings = DEFAULTS;
  let revision = 0;
  let applied = new WeakMap();
  // Only observed repeated containers retain paint snapshots. Ink objects are
  // shared immutable color conversions, and both maps release detached nodes.
  let containerPaint = new WeakMap();
  let nativeInk = new WeakMap();
  let simpleScopeFingerprint = null;
  let compiledPaintScope = null;
  let simpleScopeEpoch = 0;
  let recentBackgroundWrites = new Map();
  let recentSharedBackgrounds = new Map();
  const sharedBackgrounds = new Map();
  let sharedBackgroundScope = null;
  // Browsers serialize shorthand defaults differently (initial vs repeat,
  // scroll, etc.). Compare to that engine's own color-only declaration.
  const backgroundDefaults = (() => {
    const style = document.createElement('div').style;
    if (!style) return new Map(); // Reduced non-rendering test documents have no CSSOM.
    style.background = '#000';
    return new Map(Array.from(style, name => [name, style.getPropertyValue(name)]));
  })();
  let originalSurface = new WeakMap();
  let mediaCopies = new WeakMap();
  let mediaCopyMeasurements = new WeakSet();
  let textTiers = new WeakMap();
  let logoChecked = new WeakSet();
  let logoBudget = 80;
  const spriteDocuments = new Map();
  let inlineStyles = new WeakMap();
  const pendingTrees = new Set();
  const pendingSelf = new Set();
  // Revalidate existing dark paint in small frames when an unknown stylesheet
  // forces a large scope. New content and controls still paint immediately.
  // Retain cursors, rather than arrays of every descendant, and reuse the
  // existing 64-owner work bound. Invalidation requests one additional pass.
  const refreshRoots = new Map();
  let refreshFrame = null;
  let refreshIdle = false;
  let refreshBatchLimit = 32;
  let lastPaintFrame = null;
  const retainedHeadFrames = new WeakMap();
  let parsedShadowCursor = null;
  let flushScheduled = false;
  let flushHandle = null;
  let flushTimer = false;
  let flushMicrotask = false;
  let flushEpoch = 0;
  const settleSelf = new Set();
  const settleTrees = new Set();
  let settleTimer = null;
  const interactionSelf = new Set();
  const interactionTrees = new Set();
  let interactionFrame = null;
  const interactionSurfaces = new WeakSet();
  const SETTLE_MS = 400;
  const INTERACTION_EVENTS = ["pointerover", "pointerout", "pointerdown", "pointerup", "pointercancel", "focusin", "focusout", "input", "change", "keydown", "keyup"];
  const CONTROL = 'a, button, input, textarea, select, option, label, li, [role="option"], [role^="menuitem"], [role="button"], [role="combobox"], [aria-haspopup], [aria-expanded], [data-action], [contenteditable="true"], [tabindex]';
  // A row's hover/focus paints sibling cells, even when the event originates
  // inside a nested button or a checkbox's shadow root. Keep that state unit
  // local; a table or results layout must never become an interaction scan.
  const STATE_GROUP = 'tr, [role="row"]';
  const DROPDOWN = 'select, [role="listbox"], [role="menu"], [role="combobox"]';
  const LIGHT_UI = `${CONTROL}, ${STATE_GROUP}, form, [role="dialog"], [role="listbox"], [role="menu"]`;
  const GMAIL_LIGHT_REGIONS = ".nH.a98.iY, .a3s, .gssb_e, form.gb_Pd.gb_2e";
  // Open shadow roots (web components) we style and watch. Page stylesheets
  // never reach inside them, so each gets our rules adopted directly.
  const shadowRoots = new Set();
  // Only fully styled, ordinary offscreen branches can retain their existing
  // dark paint. New/uncertain content stays eager. Bound observer ownership.
  const deferredPaint = new Set();
  const observedPaint = new Set();
  const paintContainers = new Set();
  const nearViewport = new WeakMap();
  const MAX_DEFERRED_PAINT = 2048;
  const MAX_OBSERVED_PAINT = 4096;
  const MAX_PENDING_OBSERVED_PAINT = 64;
  let viewportObserver = null;

  function forgetDeferredPaint(node) {
    deferredPaint.delete(node);
    if (observedPaint.delete(node)) viewportObserver?.unobserve(node);
  }

  function observePaint(node, pending = false) {
    if (observedPaint.has(node)) return true;
    if (pending && observedPaint.size >= MAX_PENDING_OBSERVED_PAINT) return false;
    if (observedPaint.size >= MAX_OBSERVED_PAINT || typeof IntersectionObserver === "undefined") return;
    if (!viewportObserver) {
      const margin = Math.max(innerWidth, innerHeight);
      viewportObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          nearViewport.set(entry.target, entry.isIntersecting);
          if (entry.target.isConnected && entry.isIntersecting && deferredPaint.has(entry.target)) {
            forgetDeferredPaint(entry.target);
            pendingTrees.add(entry.target);
          }
          // Initial geometry sampling is one-shot. Only branches with actual
          // postponed paint stay observed across subsequent layout frames.
          if (!deferredPaint.has(entry.target)) {
            viewportObserver?.unobserve(entry.target);
            observedPaint.delete(entry.target);
          }
        }
        if (pendingTrees.size) schedule(true);
      }, { rootMargin: `${margin}px` });
    }
    observedPaint.add(node);
    viewportObserver.observe(node);
    return true;
  }

  function eagerPaintList(list, trees) {
    // IntersectionObserver supplies viewport state without a synchronous full
    // page layout during each mutation. Retain old dark paint until its next
    // notification on a jump/layout move; new content is never deferred.
    if (trees.length < 8 || list.length < 64) return list;
    const scopes = new Map(), deferred = new Set();
    for (const root of trees) {
      if (!(root instanceof Element) || !root.hasAttribute(MARK) || root.getRootNode() !== document ||
          nearViewport.get(root) !== false || root.matches(MEDIA_SELECTOR) || root.querySelector(MEDIA_SELECTOR) || root.localName.includes("-")) continue;
      // Generated content can paint beyond its originating element's rect;
      // inaccessible/imported rules and shadow/custom scopes remain eager.
      if (!scopes.has(document)) scopes.set(document, hasAuthoredRules(document, "generated") || hasAuthoredRules(document, "viewport"));
      if (scopes.get(document)) continue;
      const branch = list.filter(node => node === root || root.contains(node));
      if (!branch.length || branch.some(node => node.localName.includes("-") || node.shadowRoot ||
          !applied.has(node) || !overridesIntact(node) || inlineStyles.get(node) !== inlineSignature(node) ||
          node.matches('input,textarea,select,button') || /position|transform|translate|rotate|scale|margin|float|animation|text-indent/i.test(node.style.cssText.replace(/--oln-[^;]+;?/g, '')))) continue;
      if (!deferredPaint.has(root) && deferredPaint.size >= MAX_DEFERRED_PAINT) continue;
      if (!observePaint(root, true)) continue;
      deferredPaint.add(root);
      for (const node of branch) deferred.add(node);
    }
    return deferred.size ? list.filter(node => !deferred.has(node)) : list;
  }
  // Hosts can attach roots after their light-DOM scan without a mutation.
  // Poll only unresolved custom hosts, with a fixed per-frame work bound.
  const unresolvedShadowHosts = new Set();
  let shadowDiscoveryFrame = null;
  let handledInteractions = new WeakSet();
  let shadowSheet = null;
  let shadowHealthTimer = null;

  const colorsApi = () => globalThis.OledNightColors;
  const domApi = globalThis.chrome?.dom;

  // Site rules follow the page in the address bar, including inside its frames.
  function hostname() {
    try {
      if (!isTopFrame && location.ancestorOrigins?.length) return new URL(location.ancestorOrigins[location.ancestorOrigins.length - 1]).hostname;
      return location.hostname;
    } catch { return ""; }
  }

  function prefersDark() {
    try { return matchMedia("(prefers-color-scheme: dark)").matches; } catch { return true; }
  }

  // "Auto" follows the operating system: OLED Black in dark mode, off in light mode.
  function isEnabled(config) {
    return Settings.isEnabled(config, hostname(), prefersDark());
  }

  const currentSiteMode = () => Settings.siteMode(settings, hostname());

  function resolvedAppearance(config) {
    return config.appearance === "auto" ? "oled" : config.appearance;
  }

  function frameIsUntouched() {
    if (isTopFrame) return false;
    try {
      if (UNTOUCHED_FRAMES.test(location.href) || BOT_CHECK_URL.test(frameUrl(location.href))) return true;
      // Script-built (about:blank/srcdoc) frames inside a verification widget.
      if (window.frameElement?.closest(BOT_CHECK)) return true;
      return innerWidth < 80 || innerHeight < 40;
    } catch { return true; }
  }

  function preservesColor(element) {
    for (let node = element; node; node = parentAcrossShadow(node))
      if (node.matches?.(PRESERVE) || isExternalOverlay(node)) return true;
    return false;
  }

  // A whole-page challenge ("Just a moment...", "Press & Hold", "Verify you are
  // human") is left alone rather than darkened.
  function isChallengePage() {
    try {
      if (document.querySelector('#challenge-form, #challenge-running, #challenge-stage, #challenge-success-text, #cf-challenge-running, #sec-if-cpt-container, [data-translate="checking_browser"], iframe#main-iframe[src*="_Incapsula_Resource"]')) return true;
      // Only markers that exist on the interstitial itself. Ordinary protected
      // pages load bot-detection scripts and inline data mentioning captchas.
      for (const script of document.scripts) {
        if (script.src ? /\/cdn-cgi\/challenge-platform\/h\/[a-z]\/orchestrate\/|\/\/[\w.-]*captcha-delivery\.com\//i.test(script.src) : /(?:^|[\s;{(])(?:window\.)?(?:_cf_chl_opt|gokuProps)\s*=/.test(script.textContent.slice(0, 4000))) return true;
      }
    } catch {}
    return false;
  }

  // CAPTCHA providers can reject an authentication form after any third-party
  // DOM/style intervention, even when their own frames are untouched. Keep the
  // complete form page native when a provider guards a password form.
  function isCaptchaProtectedAuth() {
    if (!AUTH_PATH.test(location.pathname)) return false;
    const form = document.querySelector('form:has(input[type="password"])');
    return !!form && !!document.querySelector('#captcha-bootstrap, #captcha-provider, script[src*="hcaptcha"], script[src*="recaptcha"], [data-sitekey]');
  }

  function isMedia(element) {
    return colorsApi().isProtectedMediaTag(element.localName) || element.matches(MEDIA_SELECTOR);
  }

  function parentAcrossShadow(node) {
    if (node.parentElement) return node.parentElement;
    const parent = node.parentNode;
    return parent && parent.host ? parent.host : null;
  }

  function adoptShadowRoot(root) {
    if (!shadowRoots.has(root)) {
      shadowRoots.add(root);
      observer?.observe(root, OBSERVE);
      // Moving between children retargets target and relatedTarget to the
      // same host outside a shadow tree, so those events never reach document.
      // Listen inside every managed root; composed events are handled once.
      for (const type of INTERACTION_EVENTS) root.addEventListener(type, onInteraction, true);
      // Constructed sheets are not observed by MutationObserver. Some apps
      // replace the whole adoptedStyleSheets array after our initial pass.
      if (!shadowHealthTimer) {
        shadowHealthTimer = setInterval(repairShadowSheets, 1200);
        document.addEventListener("visibilitychange", repairShadowSheets);
      }
    }
    ensureShadowSheet(root);
  }

  function ensureShadowSheet(root) {
    try {
      if (!shadowSheet) { shadowSheet = new CSSStyleSheet(); shadowSheet.replaceSync(overrideRules()); }
      const sheets = root.adoptedStyleSheets;
      if (!sheets.includes(shadowSheet)) root.adoptedStyleSheets = [...sheets, shadowSheet];
    } catch {}
  }

  function releaseDetachedComponents(removedNodes) {
    if (removedNodes) {
      let removedContainer = false;
      for (const node of removedNodes) {
        if (!(node instanceof Element) || node.isConnected) continue;
        if (node.childElementCount || node.shadowRoot || node.localName.includes("-")) {
          removedContainer = true;
          continue;
        }
        // Streaming a single plain text leaf must not enumerate thousands of
        // unrelated retained rows. Components and removed subtrees still get
        // the full immediate ownership sweep, including in hidden tabs.
        paintContainers.delete(node);
        deferredPaint.delete(node);
        if (observedPaint.delete(node)) viewportObserver?.unobserve(node);
        refreshRoots.delete(node);
        for (const set of [pendingTrees, pendingSelf, settleTrees, settleSelf, interactionTrees, interactionSelf]) set.delete(node);
      }
      if (!removedContainer) {
        if (!observedPaint.size) { viewportObserver?.disconnect(); viewportObserver = null; }
        return;
      }
    }
    for (const node of paintContainers) if (!node.isConnected) paintContainers.delete(node);
    for (const node of deferredPaint) if (!node.isConnected) forgetDeferredPaint(node);
    for (const node of observedPaint) if (!node.isConnected) { viewportObserver?.unobserve(node); observedPaint.delete(node); }
    if (!observedPaint.size) { viewportObserver?.disconnect(); viewportObserver = null; }
    for (const root of shadowRoots) {
      if (!root.host.isConnected) {
        for (const type of INTERACTION_EVENTS) root.removeEventListener(type, onInteraction, true);
        shadowRoots.delete(root);
      }
    }
    for (const host of unresolvedShadowHosts) if (!host.isConnected) unresolvedShadowHosts.delete(host);
    for (const root of refreshRoots.keys()) if (!root.isConnected) refreshRoots.delete(root);
    for (const set of [pendingTrees, pendingSelf, settleTrees, settleSelf, interactionTrees, interactionSelf])
      for (const node of set) if (!node.isConnected) set.delete(node);
    if (!unresolvedShadowHosts.size && shadowDiscoveryFrame !== null) {
      cancelAnimationFrame(shadowDiscoveryFrame);
      shadowDiscoveryFrame = null;
    }
    if (!shadowRoots.size) {
      clearInterval(shadowHealthTimer);
      shadowHealthTimer = null;
      document.removeEventListener("visibilitychange", repairShadowSheets);
    }
  }

  function repairShadowSheets() {
    releaseDetachedComponents();
    if (document.hidden) return;
    for (const root of shadowRoots) ensureShadowSheet(root);
  }

  // What an element originally painted behind its children: real imagery,
  // a color, or nothing (transparent).
  function surfaceInfo(computed) {
    const colors = colorsApi();
    const image = computed.backgroundImage;
    if (image && image !== "none") {
      if (/url\(/i.test(image)) {
        // Only full-bleed photos/banners protect text; icons, sprites and
        // repeating patterns under text must not leave dark text on black.
        if (computed.backgroundRepeat.startsWith("no-repeat") && /cover|contain|100%/.test(computed.backgroundSize)) return { image: true };
      } else {
        const stop = colors.gradientBackdrop(image);
        if (stop) return { color: stop };
      }
    }
    const background = colors.parseColor(computed.backgroundColor);
    return background && background.a >= 0.5 ? { color: background } : null;
  }

  // Nearest original surface behind an element. Originals are remembered when
  // each element is decided, because afterwards our overrides hide them.
  function mediaUnderlay(sibling, frame, content, ctx, copy) {
    let candidates = ctx.media.get(sibling);
    if (!candidates) {
      candidates = [];
      // Responsive creative wrappers can be several levels deep. Bound this
      // local walk so an overlay beside a large application tree stays cheap.
      const pending = [sibling];
      for (let visited = 0; pending.length && visited < 48; visited++) {
        const node = pending.pop();
        if (node.matches("img, video")) candidates.push(node);
        // Responsive <picture> sources are metadata, not separate branches.
        // They must not push its actual image past the wrapper fanout bound.
        else if (node.localName === "picture") pending.push(...Array.from(node.children).filter(child => child.localName === "img"));
        else if (node.childElementCount <= 4) pending.push(...Array.from(node.children).reverse());
      }
      ctx.media.set(sibling, candidates);
    }
    // A video may have no dimensions on the first pass. Remember only the
    // local copies that depend on it, so readiness can repair those copies.
    for (const media of candidates) for (let node = media; node && node !== sibling.parentElement; node = node.parentElement) {
      let copies = mediaCopies.get(node);
      if (!copies) mediaCopies.set(node, copies = new Set());
      copies.add(copy);
    }
    return candidates.some(media => {
      const underlay = media.getBoundingClientRect();
      if (!underlay.width || !underlay.height || !content.width || !content.height) return false;
      const overlapWidth = Math.max(0, Math.min(underlay.right, content.right) - Math.max(underlay.left, content.left));
      const overlapHeight = Math.max(0, Math.min(underlay.bottom, content.bottom) - Math.max(underlay.top, content.top));
      return underlay.width >= frame.width * 0.7 && underlay.height >= frame.height * 0.7 &&
        overlapWidth >= content.width * 0.7 && overlapHeight >= content.height * 0.7;
    });
  }

  function backdropOf(element, ctx) {
    const chain = [];
    let result = { color: ctx.pageColor };
    for (let node = element; node; node = parentAcrossShadow(node)) {
      // <html>/<body> are painted black by our root rule; use their original color.
      if (node === document.documentElement || node === document.body) break;
      if (ctx.backdrop.has(node)) { result = ctx.backdrop.get(node); break; }
      chain.push(node);
      const surface = originalSurface.has(node) ? originalSurface.get(node) : surfaceInfo(ctx.style(node));
      if (surface) { result = surface; break; }
      // Full-bleed media in either adjacent sibling can paint behind a text
      // overlay (retail cards and hero sections). It is still real imagery
      // even though no ancestor has a CSS background-image.
      for (const sibling of [node.previousElementSibling, node.nextElementSibling]) {
        // Most text siblings contain no media. Avoid style/layout reads for
        // them on every streaming update.
        if (!sibling || (!sibling.matches("img, video") && !sibling.childElementCount)) continue;
        const directMedia = sibling?.matches("img, picture, video") || sibling?.firstElementChild?.matches("img, picture, video");
        if (!sibling || (node.parentElement?.childElementCount > 4 && !directMedia) ||
            !(directMedia || ctx.style(node).position === "absolute" || ctx.style(sibling).position === "absolute")) continue;
        const frame = node.parentElement?.getBoundingClientRect();
        const content = node.getBoundingClientRect();
        const media = frame && mediaUnderlay(sibling, frame, content, ctx, node);
        // A <picture> can have a zero-sized inline box when its absolutely
        // positioned image fills the slide. mediaUnderlay validates the actual
        // rendered image bounds and overlap, so the wrapper's box is irrelevant.
        if (frame && media) {
          result = { image: true };
          break;
        }
      }
      if (result.image) break;
    }
    for (const node of chain) ctx.backdrop.set(node, result);
    return result;
  }

  // An element drawn through a mask (icon fonts, logos) or with its background
  // clipped to its text shows its background color AS the icon or the text.
  function paintsInk(computed) {
    const mask = computed.maskImage || computed.webkitMaskImage;
    return (mask && mask !== "none") || /text/.test(computed.webkitBackgroundClip || computed.backgroundClip || "");
  }

  const surfaceMappings = new Map();
  function mapSurface(computed, prefix, mode, found) {
    // Reuse only pure mappings of complete paint inputs, never element state.
    const key = JSON.stringify([mode, computed.backgroundColor, computed.backgroundImage, computed.boxShadow,
      computed.maskImage, computed.webkitMaskImage, computed.webkitBackgroundClip, computed.backgroundClip]);
    let mapped = surfaceMappings.get(key);
    if (!mapped) {
      mapped = {};
      computeSurface(computed, "", mode, mapped);
      if (surfaceMappings.size >= 512) surfaceMappings.clear();
      surfaceMappings.set(key, mapped);
    }
    for (const name of Object.keys(mapped)) found[prefix + name] = mapped[name];
  }

  function computeSurface(computed, prefix, mode, found) {
    const colors = colorsApi();
    const original = colors.parseColor(computed.backgroundColor);
    if (paintsInk(computed)) {
      if (mode !== "oled" && mode !== "soft") return;
      const ink = original && original.a >= 0.08 && colors.luminance(original) < 0.5 && colors.chroma(original) < 0.15 ? colors.mapForeground(original, 1) : null;
      if (ink) found[`${prefix}bg`] = ink;
      return;
    }
    const alreadyBlack = original && mode !== "soft" && original.r <= 2 && original.g <= 2 && original.b <= 2;
    const background = alreadyBlack ? null : colors.mapBackground(original, mode);
    const gradient = colors.mapGradient(computed.backgroundImage, mode);
    const shadow = colors.mapShadow(computed.boxShadow, mode);
    if (background) found[`${prefix}bg`] = background;
    if (gradient) found[`${prefix}img`] = gradient;
    if (shadow) found[`${prefix}shadow`] = shadow;
  }

  function modeForElement(element, ctx) {
    // Gmail's shell is natively dark, but its message reader and search UI
    // still paint light surfaces. Recolor each whole region, including text.
    if (ctx.mode === "crush" && ctx.gmail && element.closest(GMAIL_LIGHT_REGIONS)) return "oled";
    return ctx.mode;
  }

  // A page-sized, flat layout is the black canvas, not a raised card. Keep
  // bordered, rounded, shadowed and smaller panels distinct from that canvas.
  function isPageLayout(element, computed, color) {
    if (!color || color.a < 0.95 || colorsApi().chroma(color) > 0.03 || colorsApi().luminance(color) < 0.62) return false;
    if (!element.matches('main, [role="main"], [class*="layout" i], [class*="content" i], [class*="page" i], [class*="results" i]')) return false;
    if (element.closest('[role="dialog"], [role="menu"], [role="listbox"], [role="img"], article, table')) return false;
    if (computed.boxShadow !== "none" || ["TopLeft", "TopRight", "BottomLeft", "BottomRight"].some(corner => parseFloat(computed[`border${corner}Radius`]) > 0) ||
        SIDES.some(([side]) => computed[`border${side}Style`] !== "none" && parseFloat(computed[`border${side}Width`]) > 0)) return false;
    return parseFloat(computed.width) >= document.documentElement.clientWidth * 0.7 &&
      parseFloat(computed.height) >= window.innerHeight * 0.6;
  }

  // External images and CSS sprites cannot inherit color. Give small named UI
  // assets a light edge without inverting colored artwork or reading remote
  // pixels. Photos, charts, swatches and standalone content images stay native.
  function isProductMedia(element) {
    return !!element.closest('[itemprop~="image"], [data-product-media], .image-swatch, [class*="product-image" i], [class*="product-photo" i], [class*="product-swatch" i], [class*="colorway" i]') ||
      /\b(?:photo(?:graph)?|jacket|product|colorway|swatch)\b/i.test(`${element.getAttribute('alt') || ''} ${element.getAttribute('aria-label') || ''}`);
  }

  function isControlAsset(element, computed, source) {
    if (isProductMedia(element)) return false;
    const named = /(?:icon|sprite|bell|hamburger|menu|search|cart|bag)(?:[\W_]|$)/i.test(`${element.className} ${source}`);
    const labelledImage = element.localName === "img" &&
      /\b(?:payment|card|crypto|currency|back|icon|menu|notification|search|cart|bag)\b/i.test(element.alt || "");
    return (named || labelledImage) &&
      parseFloat(computed.width) >= 8 && parseFloat(computed.width) <= 48 &&
      parseFloat(computed.height) >= 8 && parseFloat(computed.height) <= 48 &&
      !!element.closest('a, button, [role="button"], [role="radio"], [aria-haspopup], [data-action]');
  }

  // Painted, empty rectangles sharing a track's short axis are bar values,
  // including charts without ARIA roles. Read cached styles, not subtree scans
  // or extra layout measurements. Ordinary panels and standalone separators
  // do not have this nested thin-track shape.
  function isDataFill(element, computed, ctx, pseudo = false) {
    if (computed.backgroundImage !== "none" || paintsInk(computed)) return false;
    if (!pseudo && (element.childElementCount || element.textContent.trim())) return false;
    const paint = colorsApi().parseColor(computed.backgroundColor);
    if (!paint || paint.a < .08) return false;
    const track = pseudo ? element : element.parentElement;
    if (!track || track.matches("html, body, svg")) return false;
    if (pseudo && !track.matches('[role="progressbar"], [role="meter"], [role="img"]')) return false;
    const trackStyle = ctx.style(track);
    const base = originalSurface.get(track)?.color || colorsApi().parseColor(trackStyle.backgroundColor);
    if (!base || base.a < .5) return false;
    const w = parseFloat(computed.width), h = parseFloat(computed.height);
    const tw = parseFloat(trackStyle.width), th = parseFloat(trackStyle.height);
    const horizontal = h > 0 && h <= 24 && tw >= Math.max(24,3*h) && Math.abs(h-th) <= 1 && w >= 0 && w <= tw+1;
    const vertical = w > 0 && w <= 24 && th >= Math.max(24,3*w) && Math.abs(w-tw) <= 1 && h >= 0 && h <= th+1;
    return horizontal || vertical;
  }

  // Some compact controls draw their icon with thin neutral background bars.
  // Measure authored width/height, so rotating a hamburger into a close glyph
  // does not turn its thin stroke into a square surface. Exclude separators,
  // text, artwork and bars outside a small semantic control.
  function isControlStroke(element, computed, ctx) {
    if (element.childElementCount || element.textContent.trim() || computed.backgroundImage !== "none") return false;
    const w = parseFloat(computed.width), h = parseFloat(computed.height);
    if (!((w >= 6 && w <= 64 && h > 0 && h <= 3) || (h >= 6 && h <= 64 && w > 0 && w <= 3))) return false;
    const control = element.parentElement?.closest('button, [role="button"]');
    if (!control) return false;
    const style = ctx.style(control), cw = parseFloat(style.width), ch = parseFloat(style.height);
    if (!(cw > 0 && cw <= 96 && ch > 0 && ch <= 96) || backdropOf(element, ctx).image) return false;
    const colors = colorsApi(), paint = colors.parseColor(computed.backgroundColor);
    return paint?.a >= .5 && colors.chroma(paint) < .15 &&
      !element.closest('[role="progressbar"], [role="meter"], [role="img"]');
  }

  // A switch's moving knob is state ink, not a second panel to crush to
  // black. Bound this to compact, empty, rounded children or generated knobs
  // of semantic switches; generated knobs otherwise follow surface mapping.
  function switchThumb(element, computed, ctx, pseudo = false) {
    if (ctx.mode === "crush" && !ctx.recolorLightRegions) return null;
    if (!pseudo && element.childElementCount) return null;
    const control = pseudo ? element : element.parentElement;
    const role = control?.getAttribute("role");
    if (role !== "switch" &&
        !(control?.localName === "button" && (!pseudo || !role) && control.hasAttribute("aria-checked"))) return null;
    if ((!pseudo && element.textContent.trim()) || computed.backgroundImage !== "none" ||
        (pseudo && computed.content !== '""' && computed.content !== "''")) return null;
    const w = parseFloat(computed.width), h = parseFloat(computed.height);
    if (!(w >= 8 && w <= 32 && h >= 8 && h <= 32 && w / h >= .5 && w / h <= 2 &&
        parseFloat(computed.borderTopLeftRadius) >= Math.min(w, h) / 4)) return null;
    const colors = colorsApi(), paint = colors.parseColor(computed.backgroundColor);
    if (!paint || paint.a < .5 || colors.chroma(paint) > .15) return null;
    const track = colors.parseColor(ctx.style(control).backgroundColor);
    let trackMode = modeForElement(control, ctx);
    if (trackMode === "crush" && ctx.recolorLightRegions && track?.a >= .5 &&
        colors.luminance(track) > .5 && control.closest(LIGHT_UI)) trackMode = "oled";
    // Native bright checked tracks already need a dark knob. Recolored
    // tracks are dark, so keep their knob light in either logical state.
    return trackMode === "crush" && track && colors.luminance(track) > .18 ? "#000000" : "rgb(190 190 190)";
  }

  // Read-only: decides overrides from original computed styles. No DOM writes
  // happen here, so the whole batch costs a single style recalculation.
  function decide(element, ctx) {
    const colors = colorsApi();
    const computed = ctx.style(element);
    if (ctx.rememberInk) nativeInk.set(element, colors.parseColor(computed.color));
    else nativeInk.delete(element);
    const found = {};
    originalSurface.set(element, surfaceInfo(computed));
    if (ctx.mode === "none") return found;
    // Some stores paint a pale, darken-blended matte *above* a product photo.
    // Turning that matte black hides a fully loaded image (Amazon Grocery).
    // Keep the store's original matte and blend; the image remains untouched.
    if (DARKENING_BLENDS.test(computed.mixBlendMode) && computed.position === "absolute") {
      const matte = colors.parseColor(computed.backgroundColor);
      if (matte && matte.a >= 0.5 && colors.luminance(matte) > 0.8 &&
          element.parentElement?.querySelector(":scope > img, :scope > picture")) return found;
    }
    // Document polarity is only a default. A native dark page can still have
    // light hover cells, fields or popups. Decide their surface and inherited
    // ink together from the local original backdrop, not the site's mode.
    // Actual imagery remains protected by the same backdrop classification.
    const localMode = modeForElement(element, ctx);
    const nativeBackdrop = localMode === "crush" && (ctx.recolorLightRegions || element.closest(DROPDOWN)) ? backdropOf(element, ctx) : null;
    // Automatic mode pairs plain light islands with their ink, including
    // unlabelled banners and email tables. Restrict colored native surfaces
    // to the existing UI scope; status colors and artwork keep their meaning.
    const lightIsland = nativeBackdrop && !nativeBackdrop.image && colors.luminance(nativeBackdrop.color) > 0.5 &&
      ((colors.chroma(nativeBackdrop.color) < 0.1 && (element.childElementCount || element.textContent.trim())) ||
        element.closest(ctx.recolorLightRegions ? LIGHT_UI : DROPDOWN));
    const mode = lightIsland ? "oled" : localMode;
    mapSurface(computed, "", mode, found);
    // Native dark dashboards distinguish raised cards with subtle shades.
    // Keep that authored depth; crushing both the page and its cards to black
    // removes their boundaries. A text composer's short shell and footer
    // share that depth even before the draft grows to multiple lines.
    if (mode !== "soft" && found.bg && computed.backgroundImage === "none" && !paintsInk(computed) &&
        element !== document.documentElement && element !== document.body &&
        (element.childElementCount || element.textContent.trim()) &&
        parseFloat(computed.width) >= 120 &&
        (parseFloat(computed.height) >= 64 || (parseFloat(computed.height) >= 32 &&
          element.closest('form')?.querySelector('textarea, [contenteditable="true"]'))) &&
        (parseFloat(computed.borderTopLeftRadius) >= 4 || computed.boxShadow !== "none")) {
      const bg = colors.parseColor(computed.backgroundColor);
      if (bg?.a >= .5 && colors.chroma(bg) < .1 && colors.luminance(bg) >= .005 && colors.luminance(bg) < .025)
        found.bg = computed.backgroundColor;
    }
    const thumb = switchThumb(element, computed, ctx);
    if (thumb) found.bg = thumb;
    // Protect native links/buttons before their first interaction too. CSSOM
    // hydration can change their surface without a mutation or input event.
    // Other semantic controls gain the same protection on interaction. Native
    // tag checks avoid another selector query during the full-page scan.
    if ((mode === "oled" || mode === "soft") && !found.bg &&
        (element.localName === "a" || element.localName === "button" || interactionSurfaces.has(element)) &&
        computed.backgroundImage === "none" && !paintsInk(computed))
      found.bg = computed.backgroundColor;
    if (mode === "oled" && isPageLayout(element, computed, colors.parseColor(computed.backgroundColor))) found.bg = "#000000";
    // A flat header wrapper and its navigation are one continuous band.
    // Cards, dialogs and control faces remain separate surface decisions.
    if (mode === 'oled' && computed.backgroundImage === 'none' && !paintsInk(computed) &&
        !element.matches(CONTROL) && !element.closest('[role="dialog"], dialog, [role="menu"], [role="listbox"]') &&
        parseFloat(computed.borderTopLeftRadius) === 0 &&
        parseFloat(computed.width) >= document.documentElement.clientWidth * .7 &&
        parseFloat(computed.height) <= innerHeight * .4) {
      const bg = colors.parseColor(computed.backgroundColor);
      if (bg?.a >= .95 && colors.chroma(bg) <= .03 &&
          (element.matches('header, [role="banner"]') || element.querySelector('nav, [role="navigation"]')) &&
          // A page header can cast a separating shadow while its wrapper and
          // centered navigation still form one band. Raised navigation cards
          // farther down the page retain their own surface and shadow.
          (computed.boxShadow === 'none' || element.matches('header, [role="banner"]') ||
            /^(sticky|fixed)$/.test(computed.position) ||
            (element.parentElement && /^(sticky|fixed)$/.test(ctx.style(element.parentElement).position)))) found.bg = '#000000';
    }
    // Full-width neutral navigation is page chrome, rather than a raised card.
    // Paint it opaque black so translucent flyouts cannot reveal a white page.
    if (mode === "oled" && !paintsInk(computed) && computed.backgroundImage === "none") {
      const bg = colors.parseColor(computed.backgroundColor);
      if (bg?.a >= 0.5 && colors.chroma(bg) <= 0.03) {
        const nav = element.closest('nav, [role="navigation"]');
        if (nav && element.getBoundingClientRect().width >= nav.getBoundingClientRect().width * 0.7) found.bg = "#000000";
      }
    }
    if ((mode === "oled" || mode === "soft") && !element.childElementCount && !element.textContent.trim() &&
        computed.backgroundImage.startsWith("url(") && isControlAsset(element, computed, computed.backgroundImage)) found["asset-icon"] = "1";
    if ((mode === "oled" || mode === "soft") && isDataFill(element, computed, ctx)) {
      found.bg = colors.mapDataPaint(colors.parseColor(computed.backgroundColor));
      found.data = "1";
    }
    if ((mode === "oled" || mode === "soft") && isControlStroke(element, computed, ctx)) {
      // currentColor can already inherit our light foreground during a
      // shallow state update; it remains ink at either native lightness.
      found.bg = colors.mapForeground(colors.parseColor(computed.backgroundColor), 1);
    }
    if (element.matches("input, textarea, select")) found.field = "1";
    if (mode === "crush") {
      // The parent may have been recolored as a light UI island while this
      // descendant still sits over artwork. Pin its authored ink here too.
      if (nativeBackdrop?.image) found.fg = computed.color;
      // Native dark readers sometimes replace the message canvas while
      // leaving explicit dark HTML ink. Repair only unreadable neutral ink
      // on a solid dark backdrop; keep readable native text and imagery.
      const text = colors.parseColor(computed.color);
      if (ctx.recolorLightRegions && nativeBackdrop && !nativeBackdrop.image && text?.a >= 0.95 &&
          colors.chroma(text) < 0.1 && colors.luminance(text) < 0.2) {
        const bg = colors.luminance(nativeBackdrop.color), ink = colors.luminance(text);
        if (bg < 0.2 && (Math.max(bg, ink) + 0.05) / (Math.min(bg, ink) + 0.05) < 4.5)
          found.fg = colors.mapForeground(text, 1);
      }
      // Raised buttons can paint their entire face in a generated layer
      // (PostHog's LemonButton__chrome). Their element itself is transparent,
      // so the ordinary light-island check cannot see the bright surface.
      if (ctx.recolorLightRegions && element.closest('button, [role="button"], [role="switch"]') && ctx.generated(element)) {
        for (const pseudo of ["before", "after"]) {
          const style = getComputedStyle(element, `::${pseudo}`);
          const paint = colors.parseColor(style.backgroundColor);
          // Cover a button face, not a small generated switch knob or badge.
          if ((style.content === '""' || style.content === "''") && style.position === "absolute" &&
              parseFloat(style.width) >= parseFloat(computed.width) * .7 &&
              parseFloat(style.height) >= parseFloat(computed.height) * .7 &&
              paint?.a >= .5 && colors.luminance(paint) > .5)
            mapSurface(style, `${pseudo}-`, "oled", found);
          const thumb = switchThumb(element, style, ctx, true);
          if (thumb) found[`${pseudo}-bg`] = thumb;
        }
      }
      return found;
    }
    if (DARKENING_BLENDS.test(computed.mixBlendMode)) found.blend = "normal";
    let visibleControlBoundary;
    for (const [side, key] of SIDES) {
      if (computed[`border${side}Width`] === "0px" || computed[`border${side}Style`] === "none") continue;
      if (visibleControlBoundary === undefined) {
        const type = element.localName === "input" ? element.type : null, role = element.getAttribute("role");
        visibleControlBoundary = (type === "checkbox" || type === "radio" || role === "checkbox" || role === "radio" || role === "switch") &&
          !element.matches(':disabled, [aria-disabled="true"]');
      }
      const border = colors.mapBorder(colors.parseColor(computed[`border${side}Color`]));
      if (border) found[key] = border;
      // Small form-control boundaries need stronger contrast than decorative
      // separators. Do not make the page's ordinary borders this bright.
      if (visibleControlBoundary) {
        const paint = colors.parseColor(computed[`border${side}Color`]);
        if (paint?.a >= .08 && colors.chroma(paint) <= .15) found[key] = "rgb(160 160 168)";
      }
    }
    if (computed.outlineWidth !== "0px" && computed.outlineStyle !== "none") {
      const outline = colors.mapBorder(colors.parseColor(computed.outlineColor));
      if (outline) found.outline = outline;
    }
    let generatedInk = false;
    for (const pseudo of (ctx.generated(element) ? ["before", "after"] : [])) {
      const pseudoStyle = getComputedStyle(element, `::${pseudo}`);
      if (pseudoStyle.content && pseudoStyle.content !== "none" && pseudoStyle.content !== "normal") {
        generatedInk = true;
        mapSurface(pseudoStyle, `${pseudo}-`, mode, found);
        const thumb = switchThumb(element, pseudoStyle, ctx, true);
        if (thumb) found[`${pseudo}-bg`] = thumb;
        if (isDataFill(element, pseudoStyle, ctx, true)) {
          found[`${pseudo}-bg`] = colors.mapDataPaint(colors.parseColor(pseudoStyle.backgroundColor));
          found.data = "1";
        }
        // A custom radio's generated dot is state ink, not another surface.
        // Keep its authored geometry and state; repair only a small neutral
        // filled marker on a selected, site-drawn radio/checkbox.
        if (element.matches('input[type="radio"]:checked, input[type="checkbox"]:checked, [role="radio"][aria-checked="true"], [role="checkbox"][aria-checked="true"]') &&
            (pseudoStyle.content === '\"\"' || pseudoStyle.content === "''") &&
            parseFloat(pseudoStyle.width) > 0 && parseFloat(pseudoStyle.height) > 0 &&
            parseFloat(pseudoStyle.width) <= parseFloat(computed.width) * .8 &&
            parseFloat(pseudoStyle.height) <= parseFloat(computed.height) * .8) {
          const marker = colors.parseColor(pseudoStyle.backgroundColor);
          if (marker?.a >= .5 && colors.chroma(marker) <= .15)
            found[`${pseudo}-bg`] = colors.mapForeground(marker, 1);
        }
        // Icon fonts and generated labels may set their own color, so the
        // element's mapped foreground does not necessarily reach them.
        const ink = colors.parseColor(pseudoStyle.color);
        if (ink && ink.a >= 0.08 && colors.luminance(ink) < 0.4) {
          const backdrop = backdropOf(element, ctx);
          if (!backdrop.image && colors.luminance(backdrop.color) > 0.5)
            found[`${pseudo}-fg`] = colors.mapForeground(ink, colors.textTier(ink, backdrop.color));
        }
      }
    }
    // Text over real imagery keeps its own color; everything else is
    // lightened, keeping its original primary/secondary/muted emphasis.
    const text = colors.parseColor(computed.color);
    if (text && text.a >= 0.08) {
      const backdrop = backdropOf(element, ctx);
      if (backdrop.image) {
        // Pin original ink too: otherwise a transparent creative inherits
        // the light foreground we applied to its surrounding page container.
        found.fg = computed.color;
      } else {
        let tier = colors.textTier(text, backdrop.color);
        // Light text on a light original surface is text that inherited our
        // already-lightened color (e.g. a newly streamed chat line): keep the
        // parent's emphasis instead of treating it as faint.
        if (colors.luminance(text) > 0.5 && colors.luminance(backdrop.color) > 0.5) tier = textTiers.get(parentAcrossShadow(element)) ?? 1;
        if (found.field && !element.matches(':disabled, [aria-disabled="true"]')) tier = 1;
        textTiers.set(element, tier);
        found.fg = colors.mapForeground(text, tier);
      }
    }
    // A large structural wrapper with no own text or generated content needs
    // surface paint, but no inherited foreground override. Its text-bearing
    // descendants receive their own ink. Keeping the wrapper's authored ink
    // avoids invalidating the whole document when a small chunk is measured.
    // A proven simple scope keeps inherited ink so newly streamed plain text
    // can reuse it without a measured paint batch on every animation frame.
    if (!ctx.rememberInk && (largeScopes.has(element) || element === document.body || element === document.documentElement) &&
        element.childElementCount && !element.localName.includes('-') && !generatedInk &&
        computed.display !== 'list-item' && !element.matches(CONTROL) &&
        !element.isContentEditable && !Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
      delete found.fg;
    if (found.field && found.fg) {
      const ink = colors.parseColor(computed.webkitTextFillColor);
      if (ink && ink.a >= 0.08) found.ink = colors.mapForeground(ink, textTiers.get(element) ?? 1);
      const caret = colors.parseColor(computed.caretColor);
      if (caret && caret.a >= 0.08 && colors.luminance(caret) < 0.3 && colors.chroma(caret) < 0.15) found.caret = found.fg;
      const placeholder = colors.parseColor(getComputedStyle(element, "::placeholder").color);
      if (placeholder && placeholder.a >= 0.08) found.placeholder = colors.mapForeground(placeholder, 0.8);
    }
    return found;
  }

  // Inspect only the artwork already referenced by a compact control. Never
  // insert fetched SVG into the page or change a shared symbol definition.
  // Unknown/colored artwork retains its paint. Requests are same-origin,
  // coalesced, finite and bounded; a failed asset is not retried in this run.
  function spriteTarget(svg, use) {
    const href = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
    let url, id;
    try { url = new URL(href, document.baseURI); id = decodeURIComponent(url.hash.slice(1)); } catch { return null; }
    if (!id || id.length > 256) return null;
    if (href.startsWith("#")) return svg.getRootNode().getElementById(id);
    if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin || url.username || url.password) return null;
    url.hash = "";
    const key = url.href;
    let entry = spriteDocuments.get(key);
    if (!entry) {
      if (spriteDocuments.size >= 8) return null;
      entry = { doc: null, waiting: new Set(), controller: new AbortController(), pending: true };
      spriteDocuments.set(key, entry);
      const timer = setTimeout(() => entry.controller.abort(), 3000);
      (async () => {
        try {
          const response = await fetch(key, { credentials: "same-origin", signal: entry.controller.signal, redirect: "error" });
          if (!response.ok || !/^(?:image\/svg\+xml|(?:application|text)\/xml)(?:;|$)/i.test(response.headers.get("content-type") || "")) return;
          const reader = response.body.getReader(), chunks = []; let length = 0;
          try {
            while (true) {
              const { done, value } = await reader.read(); if (done) break;
              length += value.length;
              if (length > 524288) { await reader.cancel(); return; }
              chunks.push(value);
            }
          } finally { reader.releaseLock(); }
          const bytes = new Uint8Array(length); let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
          const text = new TextDecoder().decode(bytes);
          if (/<!DOCTYPE/i.test(text)) return;
          const doc = new DOMParser().parseFromString(text, "image/svg+xml");
          if (doc.documentElement.localName === "svg" && doc.documentElement.namespaceURI === "http://www.w3.org/2000/svg" && !doc.querySelector("parsererror,style,script") && doc.querySelectorAll("*").length <= 2048) entry.doc = doc;
        } catch {} finally {
          clearTimeout(timer); entry.pending = false;
          // Repaints advance flushEpoch while an asset is loading. Entry
          // ownership changes only on disable/re-enable, so ordinary page
          // updates must not discard a completed inspection.
          const current = active && spriteDocuments.get(key) === entry && !entry.controller.signal.aborted;
          if (current) for (const icon of entry.waiting) if (icon.isConnected) pendingTrees.add(icon);
          entry.waiting.clear();
          if (current) schedule();
        }
      })();
    }
    if (entry.pending && entry.waiting.size < 256) entry.waiting.add(svg);
    return entry.doc?.getElementById(id) || null;
  }

  function fixedSpriteInk(svg, ctx) {
    const uses = svg.querySelectorAll("use");
    if (uses.length !== 1 || svg.querySelector("path,rect,circle,ellipse,line,polyline,polygon,image,foreignObject")) return null;
    const colors = colorsApi(), surface = colors.parseColor(ctx.style(svg).backgroundColor);
    // Inverting the SVG also inverts its own CSS tile, unlike the button
    // around it. Preserve authored tiles and blending/filter effects.
    if ((surface && surface.a >= .08) || ctx.style(svg).mixBlendMode !== "normal" || ctx.style(svg).filter !== "none") return null;
    const use = uses[0], target = spriteTarget(svg, use);
    if (!target || target.querySelectorAll("*").length > 128) return null;
    const paints = [];
    let unknown = false;
    const resolve = (value, color, depth = 0) => {
      if (depth > 3) return null;
      if (/^currentcolor$/i.test(value)) return resolve(color, "", depth + 1);
      const variable = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.*))?\)$/i.exec(value);
      if (variable) return resolve(ctx.style(svg).getPropertyValue(variable[1]).trim() || variable[2] || "", color, depth + 1);
      const hex = /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value);
      if (hex) {
        const digits = hex[1].length <= 4 ? [...hex[1]].map(c => c + c).join("") : hex[1];
        return { r: parseInt(digits.slice(0, 2), 16), g: parseInt(digits.slice(2, 4), 16), b: parseInt(digits.slice(4, 6), 16), a: digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1 };
      }
      value = ({ black: "rgb(0,0,0)", white: "rgb(255,255,255)", transparent: "rgba(0,0,0,0)" })[value.toLowerCase()] || value;
      return colors.parseColor(value);
    };
    const visit = (node, inherited, draw = true) => {
      if (!/^(svg|symbol|g|defs|path|rect|circle|ellipse|line|polyline|polygon|title|desc)$/.test(node.localName) || node.hasAttribute("class") ||
          ["filter", "mask", "clip-path"].some(key => node.hasAttribute(key)) ||
          Array.from(node.style || []).some(key => !/^(display|visibility|color|fill|stroke|opacity|fill-opacity|stroke-opacity|fill-rule|clip-rule|stroke-width|stroke-linecap|stroke-linejoin|stroke-miterlimit|stroke-dasharray|stroke-dashoffset)$/.test(key))) { unknown = true; return; }
      const state = { ...inherited };
      for (const key of ["color", "fill", "stroke"]) {
        const value = (node.style?.getPropertyValue(key) || node.getAttribute(key) || "").trim();
        if (value && value !== "inherit") { state[key] = value; if (key !== "color") state[key + "Fixed"] = !/^currentcolor$/i.test(value); }
      }
      if (draw && /^(path|rect|circle|ellipse|line|polyline|polygon)$/.test(node.localName)) for (const key of ["fill", "stroke"]) {
        if (state[key] === "none") continue;
        const color = resolve(state[key], state.color);
        if (!color) unknown = true;
        else if (color.a >= .08) {
          // A local stylesheet can override a presentation attribute. Do not
          // infer neutral artwork when its actual authored paint differs.
          const live = target.ownerDocument === document && state[key + "Fixed"] ? colors.parseColor(ctx.style(node)[key]) : null;
          if (live && ["r", "g", "b", "a"].some(channel => Math.abs(live[channel] - color[channel]) > .01)) unknown = true;
          paints.push({ color, fixed: state[key + "Fixed"] });
        }
      }
      if (draw) for (const child of node.children) visit(child, state);
      return state;
    };
    const computed = ctx.style(use);
    let state = { color: ctx.style(svg).color, fill: computed.fill, stroke: computed.stroke, fillFixed: true, strokeFixed: true };
    const ancestry = []; for (let node = target.parentElement; node && ancestry.length < 16; node = node.parentElement) { ancestry.unshift(node); if (node.localName === "svg") break; }
    for (const node of ancestry) state = visit(node, state, false) || state;
    visit(target, state);
    if (unknown || !paints.length || paints.some(p => colors.chroma(p.color) > .1)) return null;
    return paints.find(p => p.fixed && colors.luminance(p.color) < .2)?.color || null;
  }

  // Small inline SVG icons with a hard-coded dark fill/stroke would vanish on
  // black. Larger SVGs are charts/illustrations: their near-white area fills
  // and gradient stops (App Store Connect sparklines) are darkened instead,
  // while colored lines and bars keep their color.
  function decideSvg(svg, ctx, out) {
    const mode = modeForElement(svg, ctx);
    // Read-only indicators (for example review stars) need the same neutral
    // ink repair as clickable icons. The compact/neutral checks below still
    // preserve large illustrations and colored artwork.
    const nativeIcon = mode === "crush" && ctx.recolorLightRegions;
    if (mode !== "oled" && mode !== "soft" && !nativeIcon) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Icons in an image creative share its authored light/dark ink.
    if (backdropOf(svg, ctx).image) return;
    const colors = colorsApi();
    // Compact wordmarks can be much wider than a square icon (including
    // animated SVG logos). Keep the same neutral-ink mapping for explicitly
    // named logos; unlabelled illustrations and larger artwork stay charts.
    let compactLogo = false;
    if (rect.width > 64 && rect.width <= 420 && rect.height <= 64) {
      for (let owner = svg, depth = 0; owner && depth < 3; owner = owner.parentElement, depth++) {
        if (owner.matches('[itemprop~="logo"], [aria-label*="logo" i], [data-oled-night-logo]') ||
            /(?:^|[\s_-])logo(?:$|[\s_-])/i.test(`${owner.id} ${owner.getAttribute("class") || ""}`)) {
          compactLogo = true;
          break;
        }
      }
    }
    const icon = (rect.width <= 64 && rect.height <= 64) || compactLogo;
    if (icon && svg.closest('a,button,[role="button"],[role="radio"]')) {
      const fixed = fixedSpriteInk(svg, ctx);
      if (fixed) {
        const backdrop = backdropOf(svg, ctx).color, bg = colors.luminance(backdrop), ink = colors.luminance(fixed);
        const unreadable = mode !== "crush" || (bg < .2 && (Math.max(bg, ink) + .05) / (Math.min(bg, ink) + .05) < 3) || (bg > .6 && colors.chroma(backdrop) < .1);
        if (unreadable) { out.push([svg, { "icon-invert": "1" }]); return; }
      }
    }
    // A sprite's shadow tree is not traversable here. Repair inherited
    // currentColor instead of inverting unknown artwork: explicit brand
    // fills/strokes in either local or external symbols keep their paint.
    const referencedInk = icon && svg.querySelector("use") ? colors.parseColor(ctx.style(svg).color) : null;
    const referenceFg = referencedInk?.a >= .95 && colors.chroma(referencedInk) < .1 &&
      colors.luminance(referencedInk) < .2 ? colors.mapForeground(referencedInk, 1) : null;
    if (nativeIcon) {
      if (icon && svg.querySelector("use") && !svg.querySelector("image,foreignObject")) {
        const backdrop = backdropOf(svg, ctx).color;
        const bg = colors.luminance(backdrop);
        const ink = referencedInk && colors.luminance(referencedInk);
        const unreadable = referenceFg && ((bg < .2 && (Math.max(bg, ink) + .05) / (Math.min(bg, ink) + .05) < 3) || (bg > .6 && colors.chroma(backdrop) < .1));
        out.push([svg, unreadable ? {fg: referenceFg} : {}]);
        return;
      }
      // Invert only wholly neutral badges: black-on-white details become
      // white-on-black together. SVG drop-shadow edges are not reliably painted
      // by every Chrome backend. Colored brands retain their authored paint.
      if (icon && !svg.querySelector('use,image,foreignObject')) {
        const bg = colors.luminance(backdropOf(svg, ctx).color);
        let neutral = true, currentColorOnly = true;
        const paints = [], currentParts = [];
        for (const part of svg.querySelectorAll(ICON_PARTS)) {
          const s = ctx.style(part);
          for (const name of ['fill', 'stroke']) {
            const paint = s[name];
            if (paint === 'none') continue;
            const color = colors.parseColor(paint);
            // Gradients/referenced paint and translucent brand colors are not
            // evidence of a wholly neutral badge. Preserve uncertain artwork.
            if (!color || /^url\(/i.test(paint) || colors.chroma(color) > .1) neutral = false;
            if (color && color.a >= .5) paints.push(color);
            let authored = '';
            for (let node = part, depth = 0; node && depth < 16; node = node.parentElement, depth++) {
              authored = node.style?.[name] || node.getAttribute(name) || '';
              if (authored || node === svg) break;
            }
            if (authored.toLowerCase() !== 'currentcolor' || paint !== s.color) currentColorOnly = false;
          }
          currentParts.push(part);
        }
        const logoLike = svg.closest('[itemprop~="logo"], [aria-label*="logo" i], [data-oled-night-logo]') ||
          /(?:^|[\s_-])logo(?:$|[\s_-])/i.test(`${svg.id} ${svg.getAttribute("class") || ""}`);
        const unreadable = paints.some(c => {
          const ink = colors.luminance(c);
          // In Automatic mode a light native control inside a dark page is
          // transformed to a dark surface. Its authored backdrop is still
          // light here, so a neutral dark icon also needs inversion.
          return (bg < .2 && (Math.max(bg, ink) + .05) / (Math.min(bg, ink) + .05) < 3) ||
            (bg > .6 && ink < .2 && !logoLike);
        });
        // A lightened parent also lightens currentColor SVG paint. Inverting
        // that inherited ink a second time makes selected icons dark again.
        // Fixed black-on-white badges still need the whole-image inversion.
        if (neutral && unreadable && currentColorOnly && paints.length) {
          const fg = colors.mapForeground(colors.parseColor(ctx.style(svg).color), 1);
          out.push([svg, {fg}], ...currentParts.map(part => [part, {fg}]));
        } else {
          out.push([svg, neutral && unreadable ? {"icon-invert":"1"} : {}], ...currentParts.map(part => [part, {}]));
        }
      }
      return;
    }
    const dataChart = !icon && /chart|rating|histogram|distribution|progress|graph/i.test(svg.getAttribute("aria-label") || "");
    const use = svg.querySelector("use");
    const href = use?.getAttribute("href") || use?.getAttribute("xlink:href") || "";
    const referenced = href.startsWith("#") ? document.getElementById(href.slice(1)) : null;
    const outline = svg.getAttribute("fill") === "none" || referenced?.getAttribute("fill") === "none";
    const paleToDark = (color) => (color && color.a >= 0.08 && colors.luminance(color) > 0.6 && colors.chroma(color) < 0.25
      ? colors.mapBackground(color, mode) : null);
    for (const part of [svg, ...svg.querySelectorAll(icon ? ICON_PARTS : CHART_PARTS)]) {
      const computed = getComputedStyle(part);
      const found = {};
      if (icon) {
        // SVG backgrounds are ordinary painted surfaces. Stores commonly put
        // a white tile behind a dark outline icon; recoloring only its stroke
        // leaves a glaring white square on a darkened header.
        if (part === svg) {
          mapSurface(computed, "", mode, found);
          if (referenceFg) found.fg = referenceFg;
          if (outline) {
            const currentColor = colors.parseColor(computed.color);
            if (currentColor) found.fg = colors.mapForeground(currentColor, 1);
          }
        }
        const fill = colors.mapIconPaint(colors.parseColor(computed.fill));
        const stroke = colors.mapIconPaint(colors.parseColor(computed.stroke));
        // A <use> referencing <symbol fill="none"> must stay unfilled. Its
        // inherited computed fill looks dark even though the authored symbol
        // deliberately draws only strokes.
        if (fill && !(outline && (part === svg || part.localName === "use"))) found.fill = fill;
        if (stroke) found.stroke = stroke;
      } else if (part.localName === "stop") {
        const stop = paleToDark(colors.parseColor(computed.stopColor));
        if (stop) found.stop = stop;
      } else {
        const plotBackground = part.localName === "rect" && part.width.baseVal.value >= .9 * (svg.viewBox.baseVal.width || rect.width) && part.height.baseVal.value >= .9 * (svg.viewBox.baseVal.height || rect.height);
        const dataMark = dataChart && part !== svg && !plotBackground && /^(rect|path|line|polyline|circle|text)$/.test(part.localName);
        const fill = dataMark ? colors.mapDataPaint(colors.parseColor(computed.fill)) : paleToDark(colors.parseColor(computed.fill));
        if (fill) found.fill = fill;
        if (dataMark) {
          found.data = "1";
          const stroke = colors.mapDataPaint(colors.parseColor(computed.stroke));
          if (stroke) found.stroke = stroke;
        }
      }
      out.push([part, found]);
    }
  }

  // Dark, mostly transparent images (logos and wordmarks like Wikipedia's)
  // disappear on black. Sample a thumbnail of the pixels; if the visible part
  // is dark and colorless, flip its lightness. Cross-origin images can't be
  // sampled (the browser forbids it). Explicit compact logo assets get a light
  // edge instead: it reveals dark lettering without changing brand colors.
  function checkLogo(img, ctx) {
    const namedLogo = img.matches('[itemprop~="logo"]') ||
      /(?:^|[\s_./#-])(?:logo|wordmark)(?:[\s_./?#-]|$)/i.test(`${img.alt} ${img.className} ${img.id} ${img.currentSrc || img.src}`);
    // Pixel shape is supporting evidence, never permission to alter a photo.
    // Dark transparent product cutouts can look exactly like sparse black ink.
    if (isProductMedia(img) || (!namedLogo && !isControlAsset(img, ctx.style(img), img.currentSrc || img.src))) {
      img.removeAttribute(LOGO); img.removeAttribute(LOGO_EDGE); return;
    }
    if (backdropOf(img, ctx).image) {
      img.removeAttribute(LOGO);
      img.removeAttribute(LOGO_EDGE);
      return;
    }
    if (logoChecked.has(img) || logoBudget <= 0) return;
    logoChecked.add(img);
    logoBudget--;
    const run = () => {
      try {
        // Keep the aspect ratio and enough resolution that thin lettering survives.
        const scale = Math.min(1, 96 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
        if (!img.naturalWidth || !img.naturalHeight) return;
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(img, 0, 0, w, h);
        const data = context.getImageData(0, 0, w, h).data;
        let clear = 0, solid = 0, light = 0, colorful = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 16) { clear++; continue; }
          if (alpha < 128) continue;
          solid++;
          const max = Math.max(data[i], data[i + 1], data[i + 2]), min = Math.min(data[i], data[i + 1], data[i + 2]);
          if (max > 110) light++;
          if (max - min > 60) colorful++;
        }
        const total = w * h;
        if (clear / total > 0.3 && solid / total > 0.02) {
          // A filled app icon can have transparent rounded corners and a dark
          // face. Inverting its whole bitmap turns that face white. Reserve
          // inversion for sparse ink (or a wide wordmark), not square badges.
          const sparseInk = solid / total < 0.4 || img.naturalWidth / img.naturalHeight > 2;
          if (sparseInk && light / solid < 0.2 && colorful / solid < 0.25) img.setAttribute(LOGO, "");
          else if (namedLogo && light / solid < 0.7) img.setAttribute(LOGO_EDGE, "");
        }
      } catch {
        // No extra request or canvas security bypass. Only assets explicitly
        // named as logos qualify; ordinary photos and mail attachments do not.
        if (namedLogo) img.setAttribute(LOGO_EDGE, "");
      }
    };
    if (img.complete) run(); else img.addEventListener("load", run, { once: true });
  }

  function overridesIntact(element, signature = applied.get(element)) {
    if (signature === undefined) return true;
    const keys = (element.getAttribute(MARK) || "").split(" ").filter(Boolean);
    return keys.map(key => `${key}=${element.style.getPropertyValue(`--oln-${key}`)}`).join(";") === signature;
  }

  const signatureOf = (found) => Object.keys(found).map((key) => `${key}=${found[key]}`).join(";");

  function unchanged(element, found) {
    const signature = signatureOf(found);
    return (applied.get(element) || "") === signature && overridesIntact(element, signature);
  }

  function write(element, found, same = unchanged(element, found)) {
    classSnapshots.set(element, element.getAttribute('class'));
    inlineStyles.set(element, inlineSignature(element));
    element.removeAttribute(SHARED_BG);
    if (same) return;
    const keys = Object.keys(found);
    const signature = signatureOf(found);
    // Most updates change one paint value. Avoid dozens of native CSSOM calls
    // for absent properties and unchanged ink. Retain the previous applied
    // keys even when a framework removes our marker or replaces style entirely.
    const previous = new Set((element.getAttribute(MARK) || "").split(" "));
    for (const part of (applied.get(element) || "").split(";")) {
      const end = part.indexOf("=");
      if (end > 0) previous.add(part.slice(0, end));
    }
    for (const key of previous) if (PROPS.includes(key) && !(key in found)) element.style.removeProperty(`--oln-${key}`);
    for (const key of keys) {
      const name = `--oln-${key}`;
      if (element.style.getPropertyValue(name) !== String(found[key]) || element.style.getPropertyPriority(name))
        element.style.setProperty(name, found[key]);
    }
    if (keys.length) {
      const mark = keys.join(" ");
      if (element.getAttribute(MARK) !== mark) element.setAttribute(MARK, mark);
    } else if (element.hasAttribute(MARK)) element.removeAttribute(MARK);
    applied.set(element, signature);
  }

  function visit(element, list, seen) {
    if (seen.has(element)) return;
    seen.add(element);
    list.push(element);
    const root = shadowOf(element);
    if (root) {
      unresolvedShadowHosts.delete(element);
      adoptShadowRoot(root);
      walkChildren(root, list, seen, list.icons);
    } else if (element.localName.includes("-")) {
      unresolvedShadowHosts.add(element);
      scheduleShadowDiscovery();
    }
  }

  // Experimental: closed roots are read through the extension-only API, so the
  // page's own functions stay native and its roots stay closed. Only custom
  // elements are asked (challenge widgets such as Turnstile lock plain <div>s),
  // and roots that hold a verification frame are never touched.
  function shadowOf(element) {
    if (element.shadowRoot) return element.shadowRoot;
    if (!settings.openClosedShadows || !element.localName.includes("-")) return null;
    let root = null;
    // Firefox exposes the root on the element; Chrome through its dom API.
    try { root = "openOrClosedShadowRoot" in element ? element.openOrClosedShadowRoot : domApi?.openOrClosedShadowRoot(element); } catch {}
    if (!root) return null;
    if (element.matches(BOT_CHECK) || root.querySelector(BOT_CHECK)) return null;
    for (const frame of root.querySelectorAll("iframe")) if (BOT_CHECK_URL.test(frameUrl(frame.src))) return null;
    return root;
  }

  function scheduleShadowDiscovery() {
    if (!observer || document.hidden || (!unresolvedShadowHosts.size && !parsedShadowCursor) || shadowDiscoveryFrame !== null) return;
    shadowDiscoveryFrame = requestAnimationFrame(() => {
      shadowDiscoveryFrame = null;
      if (!observer || document.hidden) return;
      const count = Math.min(unresolvedShadowHosts.size, 16);
      let discovered = false;
      for (let i = 0; i < count; i++) {
        const host = unresolvedShadowHosts.values().next().value;
        unresolvedShadowHosts.delete(host);
        if (!host.isConnected) continue;
        const root = shadowOf(host);
        if (root) { pendingTrees.add(host); discovered = true; }
        else unresolvedShadowHosts.add(host);
      }
      // Parsing can attach an open root to an ordinary host after its early
      // light-DOM scan. One cursor after DOMContentLoaded discovers these
      // roots without another synchronous full-page paint or retained array.
      for (let i = 0; parsedShadowCursor && i < 96; i++) {
        const host = parsedShadowCursor.nextNode();
        if (!host) { parsedShadowCursor = null; break; }
        if (host.shadowRoot && !shadowRoots.has(host.shadowRoot) && !preservesColor(host) && !isMedia(host)) {
          pendingTrees.add(host); discovered = true;
        }
      }
      if (discovered) schedule(true);
      scheduleShadowDiscovery();
    });
  }

  function walkChildren(root, list, seen, icons) {
    list.images ||= new Set();
    const guard = root.querySelector(BOT_CHECK) ? PRESERVE : COLOR_CONTROL;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        if (node.matches(guard) || isExternalOverlay(node)) return NodeFilter.FILTER_REJECT;
        if (deferHiddenBranch(node, list)) return NodeFilter.FILTER_REJECT;
        if (!isMedia(node)) return NodeFilter.FILTER_ACCEPT;
        if (node.localName === "svg") icons.add(node);
        else if (node.localName === "img") list.images.add(node);
        // <picture> is protected media, but its <img> can multiply with the
        // newly darkened tile beneath it. A rejected picture hides that img
        // from the walker, so collect it before pruning the subtree.
        else if (node.localName === "picture") {
          const image = node.querySelector("img");
          if (image) list.images.add(image);
        }
        return NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) visit(walker.currentNode, list, seen);
  }

  function collect(root, list, seen) {
    if (!(root instanceof Element) || !root.isConnected || seen.has(root) || preservesColor(root)) return;
    if (deferHiddenBranch(root, list)) return;
    if (root.localName === "svg") { list.icons.add(root); return; }
    // Charts often draw in stages, adding shapes to an SVG that's already on the
    // page. Re-check the outermost SVG so late-added fills get darkened too.
    if (root instanceof SVGElement) {
      let svg = root.closest("svg");
      for (let up = svg?.parentElement?.closest("svg"); up; up = up.parentElement?.closest("svg")) svg = up;
      if (svg) list.icons.add(svg);
      return;
    }
    if (root.localName === "img") { list.images.add(root); return; }
    if (root.localName === "picture") {
      const image = root.querySelector("img");
      if (image) list.images.add(image);
      return;
    }
    if (isMedia(root) || root.closest(MEDIA_SELECTOR)) return;
    visit(root, list, seen);
    walkChildren(root, list, seen, list.icons);
  }

  function deferHiddenBranch(root, list) {
    if (isMedia(root) || (root.childElementCount < 8 && !largeScopes.has(root)) || !applied.has(root) ||
        root.getRootNode() !== document || root.localName.includes('-') ||
        (!deferredPaint.has(root) && deferredPaint.size >= MAX_DEFERRED_PAINT) ||
        getComputedStyle(root).display !== 'none') return false;
    // Unlike an offscreen rectangle, display:none proves that descendants,
    // generated paint and positioned children cannot paint. Retain only a
    // complete previous paint: new nodes and replaced overrides stay eager.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: node => {
        if (node.matches(COLOR_CONTROL)) return NodeFilter.FILTER_REJECT;
        if (node.matches(MEDIA_SELECTOR)) {
          // This entire branch is display:none. Its media cannot paint either;
          // geometry and icon correction run when the branch becomes visible.
          // Do not let hidden symbol banks force a page-wide transition flush.
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node = root;
    do {
      if (node.localName.includes('-') || node.shadowRoot || !applied.has(node) || !overridesIntact(node) ||
          inlineStyles.get(node) !== inlineSignature(node)) return false;
    } while ((node = walker.nextNode()));
    if (!observePaint(root, true)) return false;
    deferredPaint.add(root);
    return true;
  }

  // Original page background decides between recoloring a light page and
  // only crushing the greys of a page that is already dark.
  function detectDarkPage() {
    const colors = colorsApi();
    pageColor = { r: 255, g: 255, b: 255, a: 1 };
    for (const node of [document.body, document.documentElement]) {
      if (!node) continue;
      const background = colors.parseColor(getComputedStyle(node).backgroundColor);
      if (background && background.a >= 0.5) { pageColor = background; return colors.luminance(background) < 0.2; }
    }
    return false;
  }

  function isTransparentFrame() {
    if (isTopFrame || !document.body) return false;
    return [document.documentElement, document.body].every((node) => {
      const style = getComputedStyle(node);
      const color = colorsApi().parseColor(style.backgroundColor);
      return (!color || color.a < 0.08) && style.backgroundImage === "none";
    });
  }

  function modeFor() {
    if (Settings.prefersNativeColors(hostname())) return "native";
    const appearance = resolvedAppearance(settings);
    const site = currentSiteMode();
    if (site === "recolor") return appearance;
    if (site === "deepen") return "crush";
    if (!darkPage) return appearance;
    return appearance === "oled" ? "crush" : "none";
  }

  // Ancestor batches already cover descendants, including open shadow roots.
  function covered(node, roots) {
    for (let parent = parentAcrossShadow(node); parent; parent = parentAcrossShadow(parent)) if (roots.has(parent)) return true;
    return false;
  }

  function* refreshElements(root) {
    if (root instanceof Element) {
      if (root.matches(PRESERVE) || isExternalOverlay(root)) return;
      if ((deferredPaint.has(root) || largeScopes.has(root)) && getComputedStyle(root).display === 'none') {
        if (observePaint(root, true)) deferredPaint.add(root);
        return;
      }
      yield root;
      if (isMedia(root)) return;
      const shadow = shadowOf(root);
      if (shadow) {
        unresolvedShadowHosts.delete(root);
        adoptShadowRoot(shadow);
        yield* refreshElements(shadow);
      } else if (root.localName.includes('-')) {
        unresolvedShadowHosts.add(root);
        scheduleShadowDiscovery();
      }
    }
    for (let node = root.firstElementChild; node; node = node.nextElementSibling) yield* refreshElements(node);
  }

  function appendRefresh(batch, node) {
    if (node.localName === 'svg') batch.icons.add(node);
    else if (node.localName === 'img') batch.images.add(node);
    else if (node.localName === 'picture') {
      const image = node.querySelector('img'); if (image) batch.images.add(image);
    } else if (!isMedia(node)) batch.push(node);
  }

  function scheduleRefresh() {
    if (!observer || document.hidden || refreshFrame !== null || !refreshRoots.size) return;
    const run = timestamp => {
      refreshFrame = null;
      if (!observer || document.hidden) return;
      onMutations(observer.takeRecords());
      // A mutation flush can run in the same frame as this callback. Avoid a
      // second authored-style measurement before the browser has painted.
      if (document.timeline && lastPaintFrame === timestamp) { scheduleRefresh(); return; }
      const batch = []; batch.icons = new Set(); batch.images = new Set();
      let count = 0;
      for (const [root, state] of refreshRoots) {
        if (!root.isConnected) { refreshRoots.delete(root); continue; }
        while (count < refreshBatchLimit) {
          const next = state.cursor.next();
          if (next.done) {
            if (state.again) { state.cursor = refreshElements(root); state.again = false; }
            else refreshRoots.delete(root);
            break;
          }
          if (next.value.isConnected) { appendRefresh(batch, next.value); count++; }
        }
        if (count >= refreshBatchLimit) break;
      }
      if (count) {
        const started = performance.now();
        processBatch(batch, [], batch, true);
        // Retained paint can wait for idle time. Adapt below the existing
        // 96-node cap so complex CSS does not consume an entire input frame.
        const elapsed = performance.now() - started;
        refreshBatchLimit = Math.max(8, Math.min(96, Math.round(count * 6 / Math.max(1, elapsed))));
        observer.takeRecords();
        recentBackgroundWrites.clear(); recentSharedBackgrounds.clear();
      }
      scheduleRefresh();
    };
    refreshIdle = typeof requestIdleCallback === 'function';
    refreshFrame = refreshIdle ? requestIdleCallback(() => run(document.timeline?.currentTime), {timeout:100}) : requestAnimationFrame(run);
  }

  function queueRefresh(root) {
    for (const [owner, state] of refreshRoots) {
      if (owner === root || owner.contains(root)) {
        // Finish the current traversal before revisiting already-read nodes.
        // Frequent sticky-header classes must not starve the end of the page.
        state.again = true; scheduleRefresh(); return true;
      }
      if (root.contains(owner)) refreshRoots.delete(owner);
    }
    if (refreshRoots.size >= MAX_PENDING_OBSERVED_PAINT) return false;
    refreshRoots.set(root, { cursor: refreshElements(root), again: false });
    scheduleRefresh();
    return true;
  }

  function process(trees, selves, eager = false) {
    // Schedule known large scopes before collecting their descendants. Walking
    // the entire article just to choose a small chunk was itself synchronous
    // navigation work, especially in Firefox. Explicit inserted/changed small
    // scopes remain eager even when a large ancestor also changed.
    const large = !eager && trees.filter(node => node.isConnected && largeScopes.has(node) && classSnapshots.has(node));
    if (large?.length && large.length + refreshRoots.size <= MAX_PENDING_OBSERVED_PAINT) {
      const roots = new Set(large), refresh = large.filter(node => !covered(node, roots));
      const head = []; head.icons = new Set(); head.images = new Set();
      const seen = new Set();
      const add = node => { if (!seen.has(node)) { seen.add(node); appendRefresh(head, node); } };
      for (const root of refresh) {
        // Several mutation deliveries can precede the same paint. The old
        // dark surface is still intact: do not measure its leading subtree
        // repeatedly in that frame. Explicit new content and changed controls
        // are processed separately below; the retained cursor still converges.
        const frame = document.timeline?.currentTime;
        if (frame != null && retainedHeadFrames.get(root) === frame) continue;
        if (frame != null) retainedHeadFrames.set(root, frame);
        let count = 0;
        // Retained sections already have readable dark paint. Recheck their
        // leading surface promptly, then yield ordinary descendants to the
        // bounded idle cursor. An eager 96-owner head could combine several
        // flyout updates into a >150 ms input frame. Actual new content and
        // native fields/selected states below still receive immediate repair.
        for (const node of refreshElements(root)) { add(node); if (++count === 32) break; }
        for (const node of root.querySelectorAll('input, select, textarea, [aria-selected="true"], [aria-checked="true"], [aria-pressed="true"]'))
          if (!preservesColor(node)) add(node);
      }
      process(trees.filter(node => !roots.has(node)), selves, eager);
      if (head.length || head.icons.size || head.images.size) processBatch(head, [], head, true);
      for (const root of refresh) queueRefresh(root);
      return;
    }
    const roots = new Set(trees.filter(node => node.isConnected));
    trees = [...roots].filter(node => !covered(node, roots));
    selves = [...new Set(selves)].filter(node => node.isConnected && !roots.has(node) && !covered(node, roots));
    const list = [];
    list.icons = new Set();
    list.images = new Set();
    const seen = new Set();
    for (const node of trees) collect(node, list, seen);
    if(list.length > 512) {
      const sizes = new Map();
      for(let i=list.length-1;i>=0;i--) {
        const node=list[i], size=(sizes.get(node)||1);
        const parent=parentAcrossShadow(node);if(parent) sizes.set(parent,(sizes.get(parent)||1)+size);
      }
      // A delivery may insert many small sibling roots under a previously
      // scanned parent. Include those uncollected common parents as well.
      for (const [node, size] of sizes) if (size>512)
        for (let ancestor = node; ancestor && !largeScopes.has(ancestor); ancestor = parentAcrossShadow(ancestor)) {
          largeScopes.add(ancestor);
          // Parser hydration can grow a layout after its first small scan.
          // Retire its unnecessary inherited ink now, without collecting or
          // repainting unrelated siblings. Otherwise every later native-style
          // read on this ancestor restyles the entire newly large section.
          if (!seen.has(ancestor) && !selves.includes(ancestor)) selves.push(ancestor);
        }
    }
    for (const node of selves) {
      if (!seen.has(node) && node.isConnected && !isMedia(node) && !node.closest(MEDIA_SELECTOR) && !preservesColor(node)) { seen.add(node); list.push(node); }
    }
    if (!list.length && !list.icons.size && !list.images.size) return;
    processBatch(list, trees, selves);
  }

  // Skip empty generated-paint reads only when the complete, small authored
  // scope proves there are no before/after selectors. Re-scan each batch:
  // insertRule and adoptedStyleSheets can change without a DOM mutation.
  // Unreadable, imported, large and slotted scopes retain the conservative path.
  function hasAuthoredRules(root, feature) {
    let count = 0;
    const selectors = [];
    const inspect = rules => {
      for (const rule of rules) {
        if (++count > 256 || rule.type === 3) return true;
        if (feature === "viewport" && (rule.type === 7 || (rule.style && Array.from(rule.style).some(property =>
          /^(?:position|transform|translate|rotate|scale|margin(?:-.+)?|float|animation(?:-.+)?|text-indent)$/.test(property) ||
          (property === "display" && rule.style.display === "contents"))))) return true;
        if (feature === "generated") {
          if (/:before\b|:after\b/i.test(rule.selectorText || "")) return true;
        } else if (rule.style?.getPropertyValue("transition-duration") || rule.style?.getPropertyValue("transition")) {
          // An unrelated menu animation must not force a pre-measurement
          // computed-style pass on every streamed mail row. This remains a
          // per-batch CSSOM inspection; uncertain scopes stay conservative.
          const selector = rule.selectorText;
          if (!selector || /::part|::slotted/i.test(selector)) return true;
          selectors.push(selector.replace(/::?(?:before|after)\b/g, ""));
        }
        if (rule.cssRules && inspect(rule.cssRules)) return true;
      }
      return false;
    };
    try {
      const sheets = root === document ? [...document.styleSheets] :
        [...root.querySelectorAll('style, link[rel~="stylesheet"]')].map(node => node.sheet);
      sheets.push(...root.adoptedStyleSheets);
      for (const sheet of sheets) {
        if (!sheet) return true; // An authored sheet is still loading.
        if (sheet === shadowSheet || sheet.ownerNode?.id?.startsWith("oled-night-")) continue;
        if (inspect(sheet.cssRules)) return true;
      }
      return feature === "generated" ? false : selectors.join(",");
    } catch { return true; }
  }

  // This deliberately accepts only a complete, small, simple authored scope.
  // Conditional/imported/unreadable sheets, generated content, selector state
  // and descendant rules keep native measurement. A fingerprint invalidates
  // older snapshots even for CSSOM edits that have no DOM mutation.
  function simplePaintScope() {
    const uncertain = () => {
      if (compiledPaintScope?.dynamicToken) {
        document.getElementById('oled-night-row-paint')?.remove();
        delete compiledPaintScope.dynamicToken;
        sharedBackgroundScope = null;
      }
      return null;
    };
    const authored = [], fingerprint = [];
    const rules = [];
    let count = 0, length = 0, mayAnimate = false, movingPaint = false;
    try {
      for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
        if (sheet === shadowSheet || sheet.ownerNode?.id?.startsWith("oled-night-")) continue;
        if (!sheet || sheet.disabled || sheet.media?.length) return uncertain();
        for (const rule of sheet.cssRules) {
          if (++count > 256 || rule.type !== 1 || rule.cssRules?.length) return uncertain();
          const text = rule.cssText;
          length += text.length;
          if (length > 32768) return uncertain();
          fingerprint.push(text);
          authored.push(rule);
        }
      }
      const key = fingerprint.join("\n");
      if (key === simpleScopeFingerprint && compiledPaintScope) return compiledPaintScope;
      for (const rule of authored) {
          const selectors = rule.selectorText?.split(",").map(selector => selector.trim());
          if (!selectors?.every(selector => /^(?:[a-z][\w-]*|\*)?(?:\.[\w-]+)*$/i.test(selector))) return uncertain();
          const properties = Array.from(rule.style);
          for (const property of properties) {
            if (/^(?:transition|animation)(?:-|$)/.test(property)) mayAnimate = true;
            if (/^(?:position|transform|translate|rotate|scale|margin(?:-.+)?|float|animation(?:-.+)?|text-indent)$/.test(property) ||
                (property === "display" && rule.style.display === "contents")) movingPaint = true;
          }
          const backgroundOnly = properties.every(property => property === 'background-color' ||
            (property.startsWith('background-') && (rule.style.getPropertyValue(property) === 'initial' ||
              rule.style.getPropertyValue(property) === backgroundDefaults.get(property))) ||
            (property === 'background-image' && rule.style.backgroundImage === 'none'));
          const background = colorsApi().parseColor(rule.style.backgroundColor);
          for (const selector of selectors) {
            const classes = selector.match(/\.[\w-]+/g) || [];
            rules.push({selector,classes,backgroundOnly,background,priority:[
              rule.style.getPropertyPriority('background-color') === 'important' ? 1 : 0,
              classes.length, /^[a-z]/i.test(selector) ? 1 : 0]});
          }
      }
      if (key !== simpleScopeFingerprint) { uncertain(); simpleScopeFingerprint = key; simpleScopeEpoch++; }
      // Cache only compiled strings/colors. Every call still checks the full
      // CSSOM fingerprint, including insertRule and adopted sheet changes.
      compiledPaintScope = { epoch: simpleScopeEpoch, rules, mayAnimate, movingPaint };
      return compiledPaintScope;
    } catch { return uncertain(); }
  }

  function plainDocumentContext(node, cache = new Map()) {
    if (node.getRootNode() !== document) return false;
    const path = [];
    let safe = true;
    for (let parent = node; parent; parent = parent.parentElement) {
      if (cache.has(parent)) { safe = cache.get(parent); break; }
      path.push(parent);
      if (parent.localName.includes('-') || parent.assignedSlot || parent.hasAttribute('part')) { safe = false; break; }
      // Closed ordinary hosts hide slot styles from document.styleSheets and
      // assignedSlot. Ask only whether a root exists; never inspect or style
      // an unknown root (including verification widgets). Cache this boolean
      // only for this delivery: attachShadow need not mutate the document.
      try {
        if ('openOrClosedShadowRoot' in parent) { if (parent.openOrClosedShadowRoot) { safe = false; break; } }
        else if (domApi?.openOrClosedShadowRoot) { if (domApi.openOrClosedShadowRoot(parent)) { safe = false; break; } }
        else { safe = false; break; }
      } catch { safe = false; break; }
    }
    for (const parent of path) cache.set(parent, safe);
    return safe;
  }

  function inheritsPlainInk(node, scope, contexts) {
    if (!scope || scope.mayAnimate || node.hasAttribute(MARK) || node.childElementCount || node.style.length ||
        !/^(p|span|b|strong|em|i|small)$/.test(node.localName) || !plainDocumentContext(node, contexts) ||
        !node.parentElement?.getAttribute(MARK)?.split(' ').includes('fg') || !overridesIntact(node.parentElement)) return false;
    if (scope.rules.some(rule => node.matches(rule.selector))) return false;
    // Complete document CSS, no matching rule and no hidden slot scope:
    // these ordinary text tags inherit ink. Native controls, explicit styles,
    // nested/conditional rules and unknown scopes still get measured.
    originalSurface.set(node, null);
    applied.set(node, '');
    inlineStyles.set(node, '');
    nativeInk.delete(node);
    textTiers.set(node, textTiers.get(node.parentElement) ?? 1);
    return true;
  }

  function primeSharedBackgrounds(scope) {
    if (!scope || scope.mayAnimate) return;
    const mode = modeFor(), key = `${scope.epoch}:${mode}`;
    if (sharedBackgroundScope === key || !['oled', 'soft'].includes(mode)) return;
    const sheet = document.getElementById('oled-night-sheet')?.sheet;
    if (!sheet) return;
    const colors = colorsApi();
    const candidates = new Map();
    let simpleBackgrounds = true;
    for (const {background} of scope.rules) if (background) {
      if (background.a !== 1 || colors.chroma(background) >= .1 || colors.luminance(background) < .8) { simpleBackgrounds = false; break; }
      candidates.set(`${background.r},${background.g},${background.b}`, background);
      if (candidates.size > 2) { simpleBackgrounds = false; break; }
    }
    scope.inkCandidates = simpleBackgrounds ? candidates : new Map();
    const oldRows = document.getElementById('oled-night-row-paint');
    if (simpleBackgrounds && candidates.size) {
      scope.dynamicToken = `c${scope.epoch}`;
      const rows = oldRows || document.createElement('style'); rows.id = 'oled-night-row-paint';
      const on = `:is([${MARK}], #oled-night-color-priority):not([${MEASURE}], [${MEASURE}] *):not([${MEASURE_SELF}])`;
      rows.textContent = scope.rules.filter(rule => rule.background).map(rule =>
        `${rule.selector}[${SHARED_BG}="${scope.dynamicToken}"][${MARK}~="bg"]${on}${rule.priority[0] ? ':is(*, #oled-night-important-bg-priority)' : ''}{background-color:${colors.mapBackground(rule.background, mode)} !important}`).join('\n');
      if (!oldRows) (document.head || document.documentElement).append(rows);
    } else oldRows?.remove();
    for (const {background} of scope.rules) {
      if (background?.a !== 1 || colors.chroma(background) >= .1 || colors.luminance(background) < .8) continue;
      const paint = colors.mapBackground(background, mode);
      if (sharedBackgrounds.has(paint) || sharedBackgrounds.size >= 128) continue;
      const token = String(sharedBackgrounds.size);
      const on = `:is([${MARK}], #oled-night-color-priority):not([${MEASURE}], [${MEASURE}] *):not([${MEASURE_SELF}])`;
      try {
        // Shared immutable declarations let the browser reuse matched paint.
        // Prime outside animation updates; never create rules in the fast path.
        sheet.insertRule(`[${SHARED_BG}="${token}"][${MARK}~="bg"]${on} { background-color: ${paint} !important; }`, sheet.cssRules.length);
        sharedBackgrounds.set(paint, token);
      } catch {} // CSSOM unavailable: retain ordinary inline paint.
    }
    sharedBackgroundScope = key;
  }

  function processBatch(list, trees, selves, ancestorMeasurement = false) {
    // Ordinary already-styled buttons/menus need no scope analysis. Pay for
    // this proof only for repeated containers or unstyled text leaves.
    const mayReusePaint = list.some(node => paintContainers.has(node) ||
      (node.childElementCount && node.parentElement?.childElementCount >= 32 && node.getRootNode() === document) ||
      (!node.hasAttribute(MARK) && /^(p|span|b|strong|em|i|small)$/.test(node.localName) &&
        node.parentElement?.getAttribute(MARK)?.split(' ').includes('fg')));
    const paintScope = mayReusePaint ? simplePaintScope() : null;
    primeSharedBackgrounds(paintScope);
    const documentContexts = new Map();
    const paintList = eagerPaintList(list, trees).filter(node => !inheritsPlainInk(node, paintScope, documentContexts));
    if (!paintList.length && !list.images.size && !list.icons.size) return;
    // Media readiness changes the local copy's underlay, not the authored
    // colors of every layout ancestor. Read its native inheritance chain,
    // without recomputing and rewriting those unrelated layout decisions.
    if (paintList.some(node => mediaCopyMeasurements.has(node))) ancestorMeasurement = true;
    for (const element of paintList) if (deferredPaint.has(element)) forgetDeferredPaint(element);
    const paintTrees = trees.filter(node => !deferredPaint.has(node));
    // Already-styled elements hide their original colors behind our overrides.
    // Read original colors with our overrides switched off (no paint happens in
    // between, so nothing flickers). A subtree switch restyles every descendant,
    // which is expensive on large pages, so when no re-read override is inherited
    // switch off just those elements. Inherited overrides (text, fill, stroke)
    // restyle their subtree either way, so they keep one switch per root.
    const measured = [], measuredSelf = [], measuredPseudo = [], calm = [], calmSelf = new Set();
    const marked = [...paintList, ...list.images].filter((element) => element.isConnected && element.hasAttribute(MARK));
    // Form fields have (almost) no subtree, so their inherited overrides are cheap to switch.
    const deep = (element) => INHERITED_KEYS.test(element.getAttribute(MARK)) && !element.matches("input, textarea, select");
    if (ancestorMeasurement || (marked.length <= MANY_MARKED && !marked.some(deep))) {
      for (const element of marked) {
        const keys = element.getAttribute(MARK);
        measuredSelf.push(element);
        if (PSEUDO_KEYS.test(keys)) measuredPseudo.push(element);
        if (!ancestorMeasurement && INHERITED_KEYS.test(keys)) calm.push(element); else calmSelf.add(element);
      }
      if (ancestorMeasurement) {
        // Measure the real authored inheritance chain without disabling the
        // overrides on unrelated siblings. The page keeps its previous dark
        // paint between chunks; each chunk reads current, rather than cached,
        // ancestor colors and backdrops, including across shadow boundaries.
        const ancestors = new Set();
        for (const element of paintList) for (let parent = parentAcrossShadow(element); parent; parent = parentAcrossShadow(parent)) {
          if (ancestors.has(parent)) break;
          ancestors.add(parent); originalSurface.delete(parent);
          if (parent.hasAttribute(MARK) && !marked.includes(parent)) {
            measuredSelf.push(parent); calmSelf.add(parent);
          }
        }
      }
    } else {
      // A shallow ancestor reread must never turn off every descendant's
      // overrides. A small click path can include the entire results layout.
      // Keep subtree switches for actual subtree work, and own-element
      // switches for ancestors whose hover/focus state needs rechecking.
      const roots = paintTrees.filter((node) => node instanceof Element && node.isConnected);
      for (const node of roots) if (node.hasAttribute(MARK) || node.querySelector(`[${MARK}]`)) measured.push(node);
      calm.push(...roots);
      for (const node of selves) {
        if (!node.hasAttribute(MARK)) continue;
        measuredSelf.push(node);
        if (PSEUDO_KEYS.test(node.getAttribute(MARK))) measuredPseudo.push(node);
        calmSelf.add(node);
      }
      // "[measure] *" cannot see into shadow trees, so switch those off at their top level too.
      for (const element of paintList) if (element.parentNode?.host) {
        calm.push(element);
        // A transparent shadow wrapper can contain styled controls. Outside
        // subtree guards do not cross this boundary; measure their native
        // paint too, or crush mode alternately removes and reapplies black.
        if (element.hasAttribute(MARK) || element.querySelector(`[${MARK}]`)) measured.push(element);
      }
    }
    for (const icon of list.icons) {
      if (!icon.isConnected) continue;
      calm.push(icon);
      if (icon.hasAttribute(MARK) || icon.querySelector(`[${MARK}]`)) measured.push(icon);
    }
    // Most streaming rows have no transitions. Adding/removing subtree-wide
    // transition guards still invalidates styles across those rows twice per
    // batch. Keep the guards only when this batch can actually animate; old
    // pseudo overrides retain the conservative path for generated transitions.
    const transitionScopes = new Map();
    const mayTransition = node => {
      // A complete authored scope with no transition declarations needs no
      // pre-measurement computed-style pass. Reinspect each batch for CSSOM
      // changes; inline transitions and native/cross-scope controls stay read.
      const root = node.getRootNode();
      const uncertain = node.assignedSlot || node.hasAttribute("part") || node.localName.includes("-") ||
        /^(q|input|button|select|textarea|progress|meter)$/.test(node.localName) ||
        node.style.transition || node.style.transitionDuration;
      if (!uncertain) {
        if (!transitionScopes.has(root)) transitionScopes.set(root, hasAuthoredRules(root, "transition"));
        const rules = transitionScopes.get(root);
        if (!rules) return false;
        if (typeof rules === "string") {
          try { if (!node.matches(rules)) return false; } catch {} // Unknown selectors retain the native read.
        }
      }
      return getComputedStyle(node).transitionDuration.split(",").some(duration => parseFloat(duration) > 0);
    };
    const needsCalm = list.icons.size > 0 || [...paintList, ...list.images].some(node =>
      PSEUDO_KEYS.test(node.getAttribute(MARK) || "") || mayTransition(node));
    if (!needsCalm) { calm.length = 0; calmSelf.clear(); }
    // Suppress paint transitions without canceling the page's layout motion.
    // Retain list timing/delays; commas inside cubic-bezier() are not separators.
    const motion = [];
    if (needsCalm) for (const node of new Set([...paintList, ...list.images])) {
      const style = getComputedStyle(node);
      const split = value => value.split(/,(?![^()]*\))/).map(part => part.trim());
      const properties = split(style.transitionProperty), durations = split(style.transitionDuration);
      const easing = split(style.transitionTimingFunction), delays = split(style.transitionDelay);
      const retained = []; let colorTransition = false;
      properties.forEach((property, index) => {
        if (parseFloat(durations[index % durations.length]) <= 0) return;
        if (COLOR_TRANSITION.test(property)) colorTransition = true;
        const props = property === "all" ? ["opacity", "transform", "translate", "rotate", "scale", "height", "width", "max-height", "max-width", "min-height", "min-width", "top", "right", "bottom", "left", "grid-template-rows", "grid-template-columns", "clip-path"] : [property];
        for (const prop of props) if (prop !== "none" && !COLOR_TRANSITION.test(prop)) retained.push(`${prop} ${durations[index % durations.length]} ${easing[index % easing.length]} ${delays[index % delays.length]}`);
      });
      if (colorTransition) calmSelf.add(node);
      else if (!PSEUDO_KEYS.test(node.getAttribute(MARK) || '')) calmSelf.delete(node);
      // A layout-only ancestor needs no color guard. Writing the inherited
      // motion variable there would invalidate its whole article subtree.
      if (retained.length && (calmSelf.has(node) || calm.some(root => root === node || root.contains(node)))) {
        motion.push([node, retained.join(", ")]);
      }
    }
    // Finish every transition read before setting guards. Interleaving these
    // writes with computed-style reads repeatedly flushes unrelated page CSS.
    for (const [node, transition] of motion) {
      node.style.setProperty("--oln-motion", transition);
      node.setAttribute(MOTION, "");
    }
    const measuresPolarity = batchPolarity && batchPolarity.dark === null;
    if (measuresPolarity) {
      document.documentElement.setAttribute(MEASURE_ROOT, "");
      for (const node of [document.documentElement, document.body]) if (node && !measuredSelf.includes(node)) measuredSelf.push(node);
    }
    for (const node of calm) node.setAttribute(NOANIM, "");
    for (const node of calmSelf) node.setAttribute(NOANIM_SELF, "");
    for (const node of measured) node.setAttribute(MEASURE, "");
    for (const node of measuredSelf) node.setAttribute(MEASURE_SELF, "");
    for (const node of measuredPseudo) node.setAttribute(MEASURE_PSEUDO, "");
    if (measuresPolarity) {
      batchPolarity.dark = detectDarkPage();
      document.documentElement.toggleAttribute("data-oled-night-transparent-frame", isTransparentFrame());
    }
    const styles = new Map(), generatedScopes = new Map();
    const ctx = {
      mode: modeFor(),
      rememberInk: !!paintScope && !paintScope.mayAnimate,
      // Explicit "Deepen blacks only" keeps the user's native light content.
      recolorLightRegions: currentSiteMode() !== "deepen",
      pageColor,
      gmail: document.documentElement.getAttribute("data-oled-night-site") === "gmail",
      backdrop: new Map(),
      media: new Map(),
      generated: element => {
        // Native quotes/controls and slotted content may use UA or another
        // scope's generated paint; never infer those from this scope's sheets.
        if (element.assignedSlot || element.hasAttribute('part') || element.localName.includes('-') || /^(q|input|button|select|textarea|progress|meter)$/.test(element.localName)) return true;
        const root = element.getRootNode();
        if (!generatedScopes.has(root)) generatedScopes.set(root, hasAuthoredRules(root, "generated"));
        return generatedScopes.get(root);
      },
      style(node) {
        let computed = styles.get(node);
        if (!computed) { computed = getComputedStyle(node); styles.set(node, computed); }
        return computed;
      }
    };
    const decisions = paintList.map((element) => decide(element, ctx));
    const iconDecisions = [];
    for (const icon of list.icons) if (icon.isConnected) decideSvg(icon, ctx, iconDecisions);
    const recolor = ctx.mode === "oled" || ctx.mode === "soft";
    const imageDecisions = [];
    const logoCandidates = [];
    if (recolor || (ctx.mode === "crush" && ctx.recolorLightRegions)) {
      for (const img of list.images) {
        if (!img.isConnected) continue;
        const computed = ctx.style(img);
        // Automatic mode recolors light product tiles even on a native dark
        // page. Their photos must stop multiplying against the darkened tile
        // too; document polarity does not determine image visibility.
        const found = DARKENING_BLENDS.test(computed.mixBlendMode) ? { blend: "normal" } : {};
        const rect = img.getBoundingClientRect();
        const opacity = Number(computed.opacity);
        if (isControlAsset(img, computed, img.currentSrc || img.src)) found["asset-icon"] = "1";
        if (img.alt?.trim() && rect.width >= 12 && rect.height >= 12 && rect.width <= 48 && rect.height <= 48 &&
            opacity >= 0.12 && opacity <= 0.35) {
          const backdrop = backdropOf(img, ctx);
          if (!backdrop.image && colorsApi().luminance(backdrop.color) > 0.65) found["faded-icon"] = "1";
        }
        imageDecisions.push([img, found]);
        if (recolor && rect.width >= 12 && rect.height >= 12 && rect.width <= 420 && rect.height <= 160) logoCandidates.push(img);
      }
    }
    for (const node of measured) node.removeAttribute(MEASURE);
    for (const node of measuredSelf) node.removeAttribute(MEASURE_SELF);
    for (const node of measuredPseudo) node.removeAttribute(MEASURE_PSEUDO);
    if (measuresPolarity) document.documentElement.removeAttribute(MEASURE_ROOT);
    const writes = [...paintList.map((element, index) => [element, decisions[index]]), ...iconDecisions, ...imageDecisions];
    // Elements about to gain, lose or change an override also skip transitions.
    const changed = new Set();
    for (const [element, found] of writes) {
      if (unchanged(element, found)) continue;
      changed.add(element);
      if (!needsCalm && !PSEUDO_KEYS.test(Object.keys(found).join(" "))) continue;
      if (!calmSelf.has(element) && !calm.some(root => root === element || root.contains(element)) &&
          !PSEUDO_KEYS.test(Object.keys(found).join(' '))) continue;
      if (calmSelf.has(element) || element.closest(`[${NOANIM}]`)) continue;
      const keys = `${element.getAttribute(MARK) || ""} ${Object.keys(found).join(" ")}`;
      if (INHERITED_KEYS.test(keys)) calm.push(element); else calmSelf.add(element);
      element.setAttribute(INHERITED_KEYS.test(keys) ? NOANIM : NOANIM_SELF, "");
    }
    for (const [element, found] of writes) write(element, found, !changed.has(element));
    // Register only repeated, fully styled container rows, never every leaf.
    for (const [node, found] of writes) if (node.childElementCount && node.parentElement?.childElementCount >= 32 &&
      node.hasAttribute(MARK) && node.getRootNode() === document && !node.localName.includes("-")) {
      if (!paintContainers.has(node) && paintContainers.size < MAX_OBSERVED_PAINT) {
        paintContainers.add(node);
        observePaint(node);
      }
      if (paintContainers.has(node) && paintScope && !paintScope.mayAnimate && plainDocumentContext(node, documentContexts)) {
        const inkProof = new Set();
        // The same two bounded neutral ink proofs are useful before the first
        // animated selection, not only after it. Prime once while every leaf
        // is already freshly painted; never collect rows during interaction.
        if (!paintScope.inkCandidates) {
          const candidates = new Map(), colors = colorsApi();
          for (const {background} of paintScope.rules) if (background?.a === 1 &&
              colors.chroma(background) < .1 && colors.luminance(background) >= .8 && candidates.size < 2)
            candidates.set(`${background.r},${background.g},${background.b}`, background);
          paintScope.inkCandidates = candidates;
        }
        if (inlineStyles.get(node) === '') for (const [key, background] of paintScope.inkCandidates)
          if (backgroundInkCompatible(node, background)) inkProof.add(key);
        const source = originalSurface.get(node)?.color, colors = colorsApi();
        const declarative = !!paintScope.dynamicToken && inkProof.size === paintScope.inkCandidates.size && inkProof.size > 0 &&
          source?.a === 1 && colors.chroma(source) < .1 && colors.luminance(source) >= .8 && found.bg === colors.mapBackground(source, ctx.mode);
        const sharedToken = declarative ? paintScope.dynamicToken : undefined;
        if (declarative) {
          node.setAttribute(SHARED_BG, sharedToken);
          if (recentSharedBackgrounds.size < 2048) recentSharedBackgrounds.set(node, sharedToken);
        }
        containerPaint.set(node, {found: { ...found }, classes: node.getAttribute("class") || "", scopeEpoch: paintScope.epoch, inkProof, declarative, sharedToken});
      }
      else containerPaint.delete(node);
    }
    for (const img of logoCandidates) checkLogo(img, ctx);
    // Commit the new colors with transitions still off, then restore them.
    const first = calm[0] || calmSelf.values().next().value;
    if (first) getComputedStyle(first).color;
    for (const node of calm) node.removeAttribute(NOANIM);
    for (const node of calmSelf) node.removeAttribute(NOANIM_SELF);
    for (const [node] of motion) { node.removeAttribute(MOTION); node.style.removeProperty("--oln-motion"); }
    for (const node of paintList) mediaCopyMeasurements.delete(node);
    lastPaintFrame = document.timeline?.currentTime ?? null;
  }

  // Re-reads the page's original polarity with only the page background and
  // the root elements' own overrides switched off; everything else stays styled.
  function remeasurePolarity(full = schemeSensitive) {
    const root = document.documentElement, roots = [root, document.body].filter(Boolean);
    // A site can set an explicit light scheme after our first pass. A shallow
    // measurement still sees our forced dark scheme and mislabels its page dark.
    if (root.style.colorScheme.trim().toLowerCase() === "light") full = true;
    if (full) root.setAttribute(MEASURE, "");
    else { root.setAttribute(MEASURE_ROOT, ""); for (const node of roots) node.setAttribute(MEASURE_SELF, ""); }
    const dark = detectDarkPage();
    const transparent = isTransparentFrame();
    root.removeAttribute(MEASURE);
    root.removeAttribute(MEASURE_ROOT);
    for (const node of roots) node.removeAttribute(MEASURE_SELF);
    root.toggleAttribute("data-oled-night-transparent-frame", transparent);
    return dark;
  }

  function flush() {
    flushScheduled = false;
    flushMicrotask = false;
    flushHandle = null;
    if (!observer) { pendingTrees.clear(); pendingSelf.clear(); return; }
    // Capture handlers queue us before the site's own event handler. Include
    // its DOM writes even when our microtask precedes observer delivery.
    onMutations(observer.takeRecords(), false);
    if (polarityDirty) {
      polarityDirty = false;
      // Native light/dark() colors still need the full scheme switch. Ordinary
      // root changes share the batch's original-style read instead of forcing
      // two complete style recalculations before one paint.
      if (schemeSensitive || document.documentElement.style.colorScheme.trim().toLowerCase() === "light") {
        const nowDark = remeasurePolarity();
        if (nowDark !== darkPage && !["recolor", "deepen"].includes(currentSiteMode())) { enable(); return; }
      } else batchPolarity = { dark: null };
    }
    const trees = [...pendingTrees];
    const selves = [...pendingSelf];
    pendingTrees.clear();
    pendingSelf.clear();
    process(trees, selves);
    const nowDark = batchPolarity?.dark;
    batchPolarity = null;
    if (nowDark !== null && nowDark !== undefined && nowDark !== darkPage &&
        !["recolor", "deepen"].includes(currentSiteMode())) { enable(); return; }
    observer.takeRecords();
    recentBackgroundWrites.clear();
    recentSharedBackgrounds.clear();
  }

  // Batch mutations before the next paint. Idle callbacks run after painting,
  // allowing newly inserted white sections to flash for up to 250 ms.
  function schedule(beforePaint = false) {
    // Mutations inside a frame callback cannot wait for another rAF: the
    // browser paints their native surface in the current frame. Batch at the
    // microtask checkpoint instead, after the site's synchronous updates.
    if (beforePaint && !document.hidden) {
      if (flushScheduled && flushMicrotask) return;
      if (flushHandle !== null) {
        if (flushTimer) clearTimeout(flushHandle); else cancelAnimationFrame(flushHandle);
      }
      flushHandle = null;
      flushScheduled = true;
      flushMicrotask = true;
      const epoch = ++flushEpoch;
      queueMicrotask(() => { if (epoch === flushEpoch) flush(); });
      return;
    }
    if (flushScheduled) return;
    flushScheduled = true;
    flushTimer = document.hidden;
    flushHandle = flushTimer ? setTimeout(flush, 16) : requestAnimationFrame(flush);
  }

  // Ignore compositor-only animation churn, but retain all other declarations
  // and page custom properties: they can change inherited colors indirectly.
  function inlineSignature(element) {
    const style = element.style;
    if (!style) return "";
    const parts = [];
    for (let i = 0; i < style.length; i++) {
      const name = style[i];
      if (name.startsWith("--oln-") || name.startsWith("--oled-night-") || ["transform", "translate", "rotate", "scale", "opacity", "will-change"].includes(name)) continue;
      parts.push(name + ":" + style.getPropertyValue(name) + "!" + style.getPropertyPriority(name));
    }
    return parts.sort().join(";");
  }

  // Hover/focus/active and native field states do not necessarily mutate the DOM.
  // Read their final styles before the next paint, only along the changed path
  // and inside the nearest control, rather than traversing the entire page.
  function onInteraction(event) {
    if (!observer || handledInteractions.has(event)) return;
    handledInteractions.add(event);
    const path = event.composedPath().filter(node => node instanceof Element);
    if (path.some(isExternalOverlay)) return;
    if (/^pointer(?:over|out)$/.test(event.type)) {
      const index = path.findIndex(node => paintContainers.has(node));
      if (index >= 0 && !path.some(node => node.matches(CONTROL)) && path.slice(0, index + 1).every(node =>
          /^(div|span|b|strong|em|i|small)$/.test(node.localName) && !node.assignedSlot && !node.hasAttribute('part'))) {
        const snapshot = containerPaint.get(path[index]), scope = snapshot && simplePaintScope();
        // Plain repeated rows with a completely inspected scope have no
        // authored hover rules or native control states. Pointer crossings
        // cannot change their paint. Actual DOM/style changes still invalidate
        // and repaint through the observer, including later event handlers.
        if (scope && !scope.mayAnimate && snapshot.scopeEpoch === scope.epoch) return;
      }
    }
    const nativeSelect = path.find(node => node.localName === "select");
    // The browser owns the open popup. Its static option rules are already
    // installed; synchronous select event restyles delay native opening.
    if (nativeSelect) return;
    const found = path.find(node => node.matches(CONTROL));
    const control = found && found !== document.body && found !== document.documentElement ? found : null;
    if (control) interactionSurfaces.add(control);
    // Existing background AND ink overrides protect the current paint. Native
    // dark mode may own only a background; new native focus ink then needs the
    // immediate pass too. Fully protected leaf controls stay coalesced.
    const currentPaint = !!control?.childElementCount || path.some(node =>
      node !== document.body && node !== document.documentElement &&
      !['bg','fg'].every(key => node.getAttribute(MARK)?.split(' ').includes(key)));
    // attachShadow() on an already-scanned host is not a DOM mutation. Discover
    // those roots from the native event path before painting the first hover.
    // A new root needs its whole component scanned once; subsequent interactions
    // keep the existing bounded path. Sites can also replace adopted sheets
    // without a mutation, so restore our sheet on each affected root's path.
    for (const node of event.composedPath()) {
      if (!(node instanceof ShadowRoot) || preservesColor(node.host) || isMedia(node.host)) continue;
      const discovered = !shadowRoots.has(node);
      adoptShadowRoot(node);
      if (discovered) queueInteraction(node.host, true, currentPaint);
    }
    const stop = firstUnchanged(event, path, control);
    let rest = false;
    for (const node of path) {
      if (node === document.body || node === document.documentElement) break;
      if (node === stop) rest = true;
      if (rest) settleSelf.add(node); else queueInteraction(node, false, currentPaint);
    }
    // Descendant rules of changed elements (".row:hover .label") need their subtree.
    const controlChanged = control && (!stop || path.indexOf(control) < path.indexOf(stop));
    if (controlChanged) queueInteraction(control, true, currentPaint);
    else {
      // Non-semantic triggers and plain text hover must not promote the
      // entire page layout to a subtree reread. Ancestor state is checked
      // shallowly above; actual DOM/class changes still queue their subtree.
      if (path[0] && path[0] !== stop && path[0] !== document.body && path[0] !== document.documentElement) {
        const roots = largeScopes.has(path[0]) ? interactionPaintRoots(path[0]) : null;
        if (roots) {for (const root of roots) queueInteraction(root, true, currentPaint)}
        else queueInteraction(path[0], true, currentPaint);
      }
      if (control) settleTrees.add(control);
    }
    const group = path.find(node => node.matches(STATE_GROUP));
    if (group && (!stop || path.indexOf(group) < path.indexOf(stop))) queueInteraction(group, true, currentPaint);
    // Native focus/hover can change inside a frame callback. Waiting for the
    // next rAF exposes its pale state in the current paint. Repair at this
    // microtask checkpoint, then recheck only this path at the next boundary:
    // a later site microtask can edit CSSOM without any observed DOM write.
    schedule(currentPaint);
    if (currentPaint && interactionFrame === null) interactionFrame = requestAnimationFrame(() => {
      interactionFrame = null;
      if (!observer) return;
      for (const node of interactionSelf) if (node.isConnected) pendingSelf.add(node);
      for (const node of interactionTrees) if (node.isConnected) pendingTrees.add(node);
      interactionSelf.clear();
      interactionTrees.clear();
      schedule(true);
    });
    if (settleSelf.size || settleTrees.size) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, SETTLE_MS);
    }
  }

  function hasDescendantShadow(node) {
    if (node.getRootNode() !== document) return true;
    for (const root of shadowRoots) if (root.host === node || node.contains(root.host)) return true;
    // Hosts without a readable root have no shadow paint to invalidate yet.
    // Discovery scans the entire component when its root becomes available.
    return false;
  }

  function interactionPaintRoots(node) {
    if (hasDescendantShadow(node)) return null;
    const roots = new Set(); let count = 0;
    const inspect = rules => {for (const rule of rules) {
      if (++count > 8192 || rule.type === 3) throw Error('Unknown interaction scope');
      if (rule.selectorText && /:(?:hover|focus(?:-visible|-within)?|active)\b/.test(rule.selectorText)) {
        for (const selector of rule.selectorText.split(/,(?![^()]*\))/)) {
          if (/:has\(|::part|::slotted|&/.test(selector)) throw Error('Unknown state subject');
          const parts = selector.trim().split(/\s+/);
          for (let i=0;i<parts.length;i++) {
            if (!/:(?:hover|focus(?:-visible|-within)?|active)\b/.test(parts[i])) continue;
            if (/[>+~]/.test(parts[i])) throw Error('Combined state selector');
            const prefix = parts.slice(0,i+1).join(' ').replace(/:not\(:(?:hover|focus(?:-visible|-within)?|active)\)/g,'').replace(/:(?:hover|focus(?:-visible|-within)?|active)\b/g,'');
            if (!node.matches(prefix)) continue;
            if (i === parts.length-1) throw Error('Inherited state paint');
            const tail=parts.slice(i+1).join(' ').replace(/::?(?:before|after)\b/g,'');
            if (/^[>+~]/.test(tail)) throw Error('Relative state selector');
            for (const target of node.querySelectorAll(tail)) {
              roots.add(target); if (roots.size > 64) throw Error('Broad state paint');
            }
          }
        }
      }
      if (rule.cssRules) inspect(rule.cssRules);
    }};
    try {
      for (const sheet of [...document.styleSheets,...document.adoptedStyleSheets]) {
        if (sheet === shadowSheet || sheet.ownerNode?.id?.startsWith('oled-night-')) continue;
        inspect(sheet.cssRules);
      }
      return [...roots];
    } catch {return null;}
  }

  function queueInteraction(node, tree = false, recheck = false) {
    (tree ? pendingTrees : pendingSelf).add(node);
    if (recheck) (tree ? interactionTrees : interactionSelf).add(node);
  }

  // Moving between elements changes :hover/:focus-within only below the common
  // ancestor; typing changes state only up to the field's control. Everything
  // above is rechecked once interaction pauses (e.g. :has() rules).
  function firstUnchanged(event, path, control) {
    if (/^key|^input$|^change$/.test(event.type)) {
      const top = control || path[0];
      return path[path.indexOf(top) + 1] || null;
    }
    const other = event.relatedTarget;
    if (!/^(pointerover|pointerout|focusin|focusout)$/.test(event.type) || !(other instanceof Element)) return null;
    const around = new Set();
    for (let node = other; node; node = parentAcrossShadow(node)) around.add(node);
    return path.find(node => around.has(node)) || null;
  }

  function settle() {
    settleTimer = null;
    if (!observer) { settleSelf.clear(); settleTrees.clear(); return; }
    for (const node of settleSelf) if (node.isConnected) pendingSelf.add(node);
    for (const node of settleTrees) if (node.isConnected) pendingTrees.add(node);
    settleSelf.clear();
    settleTrees.clear();
    schedule();
  }

  function isPageSheet(node) {
    return node instanceof Element && node.matches('style, link[rel~="stylesheet"]') && !node.id.startsWith("oled-night-");
  }

  function queueMediaCopies(copies) {
    for (const copy of copies) {
      if (!copy.isConnected) { copies.delete(copy); continue; }
      pendingTrees.add(copy);
      mediaCopyMeasurements.add(copy);
    }
  }

  function onSheetLoad(event) {
    if (!observer) return;
    const copies = mediaCopies.get(event.target);
    if (copies) { queueMediaCopies(copies); schedule(); }
    if (!isPageSheet(event.target)) return;
    queuePageSheet(event.target, true);
    schedule();
  }

  function backgroundInkCompatible(node, background) {
    const colors = colorsApi(), branch = [node], walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode() && branch.length <= 16) branch.push(walker.currentNode);
    if (branch.length > 16) return false;
    for (const item of branch) {
      const ink = nativeInk.get(item), signature = applied.get(item), keys = (item.getAttribute(MARK) || '').split(' ');
      const foreground = signature?.match(/(?:^|;)fg=([^;]+)(?:;|$)/)?.[1];
      if (!ink || item.shadowRoot || item.matches(MEDIA_SELECTOR) || !/^(div|span|b|strong|em|i|small)$/.test(item.localName) ||
          (item !== node && originalSurface.get(item)) || keys.some(key => !['bg','fg','bt','br','bb','bl'].includes(key)) ||
          foreground !== colors.mapForeground(ink, colors.textTier(ink, background))) return false;
    }
    return true;
  }

  function fastBackgroundState(node, scopes) {
    if (!scopes.has('mode')) scopes.set('mode', modeFor());
    if (!scopes.has('contexts')) scopes.set('contexts', new Map());
    const mode = scopes.get('mode'), snapshot = containerPaint.get(node);
    if (!["oled", "soft"].includes(mode) || !paintContainers.has(node) || !snapshot ||
        !plainDocumentContext(node, scopes.get('contexts')) || inlineStyles.get(node) !== "") return false;
    // A snapshot survives only when the complete observer delivery contains
    // no external style, marker or shared-paint edit on this branch. Reuse that
    // integrity proof rather than rebuilding CSS signatures for every row.
    if (!scopes.has(document)) scopes.set(document, simplePaintScope());
    const scope = scopes.get(document);
    if (!scope || scope.mayAnimate || snapshot.scopeEpoch !== scope.epoch) return false;
    const current = node.getAttribute("class") || "";
    if (snapshot.classes === current) { forgetDeferredPaint(node); return true; }
    // Simple-scope selectors depend only on tag/classes. Repeated rows share
    // this bounded transition proof; CSSOM fingerprint changes replace scope.
    // Descendant ink and override integrity still need their own node proof.
    const key = snapshot.classes.length + current.length <= 1024 ?
      JSON.stringify([node.namespaceURI, node.localName, snapshot.classes, current]) : null;
    const transitions = scope.transitions || (scope.transitions = new Map());
    let background = key === null ? undefined : transitions.get(key);
    if (background === undefined) {
      const oldClasses = new Set(snapshot.classes.split(/\s+/)), newClasses = new Set(current.split(/\s+/));
      const changed = new Set([...oldClasses, ...newClasses].filter(name => oldClasses.has(name) !== newClasses.has(name)));
      let affected = false, safe = true, winner = null;
      background = null;
      for (const { selector, classes, backgroundOnly, background: paint, priority } of scope.rules) {
        if (classes.some(name => changed.has(name.slice(1)))) {
          if (!backgroundOnly) { safe = false; break; }
          affected = true;
        }
        if (paint && node.matches(selector) && (!winner || priority[0] > winner[0] || (priority[0] === winner[0] &&
            (priority[1] > winner[1] || (priority[1] === winner[1] && priority[2] >= winner[2]))))) {
          winner = priority; background = paint;
        }
      }
      if (!affected || !safe) background = null;
      if (key !== null && transitions.size < 128) transitions.set(key, background);
    }
    const colors = colorsApi(), source = originalSurface.get(node)?.color, found = snapshot.found;
    const light = color => color?.a === 1 && colors.chroma(color) < 0.1 && colors.luminance(color) >= 0.8;
    if (!light(background) || !light(source) || (snapshot.effectivePaint || found.bg) !== colors.mapBackground(source, mode)) return false;
    const proofKey = `${background.r},${background.g},${background.b}`;
    if (!snapshot.inkProof?.has(proofKey)) {
    if (!backgroundInkCompatible(node, background)) return false;
    // The observer invalidates the whole snapshot before descendant mutations,
    // including style/marker edits. Do not reread every leaf's CSS declaration
    // block while proving an unchanged branch on a background-only transition.
    // Retain only two proven neutral backgrounds, never a DOM subtree or an
    // unbounded color history. Unknown colors still check every leaf.
    if (!snapshot.inkProof) snapshot.inkProof = new Set();
    if (snapshot.inkProof.size < 2) snapshot.inkProof.add(proofKey);
    }
    // This proof needs only an attribute write, without layout or native-style
    // reads. Re-observing offscreen rows costs more: IntersectionObserver must
    // track their geometry on every frame until they approach the viewport.
    // Apply cheap paint immediately; defer only the expensive measured path.
    forgetDeferredPaint(node);
    // Only the neutral container background changed; every descendant keeps
    // exactly its existing ink tier. No temporary subtree style switch.
    originalSurface.set(node, { color: background });
    const next = { ...found, bg: colors.mapBackground(background, mode) };
    if (snapshot.declarative && snapshot.sharedToken === scope.dynamicToken) {
      // Native class matching selects the mapped background in the same style
      // pass. Repeated selection needs no second DOM attribute/style write.
      containerPaint.set(node, {...snapshot, effectivePaint: next.bg, classes: current});
      return true;
    }
    const sharedToken = sharedBackgrounds.get(next.bg);
    if (sharedToken !== undefined) {
      if (node.getAttribute(SHARED_BG) !== sharedToken) {
        node.setAttribute(SHARED_BG, sharedToken);
        if (recentSharedBackgrounds.size < 2048) recentSharedBackgrounds.set(node, sharedToken);
      }
      containerPaint.set(node, {found, effectivePaint: next.bg, sharedToken, classes: current,
        scopeEpoch: scope.epoch, inkProof: snapshot.inkProof});
      return true;
    }
    node.removeAttribute(SHARED_BG);
    // The proof above already verified every override and native declaration.
    // Only this background can differ. Avoid rereading/rebuilding every other
    // inline property, and recognize this exact write on observer delivery.
    if (found.bg !== next.bg || node.style.getPropertyPriority('--oln-bg')) {
      node.style.setProperty('--oln-bg', next.bg);
      applied.set(node, signatureOf(next));
      if (recentBackgroundWrites.size < 2048) recentBackgroundWrites.set(node, node.getAttribute('style'));
    }
    containerPaint.set(node, { found: next, classes: current, scopeEpoch: scope.epoch, inkProof: snapshot.inkProof });
    return true;
  }

  function changesOnlyInteractionBehavior(style) {
    const properties = Array.from(style || []);
    // Scroll target offsets affect the destination of native scrolling, not
    // layout boxes or authored paint. Keep real top/padding/geometry rules.
    return properties.length > 0 && properties.every(property =>
      /^(?:pointer-events|cursor|touch-action|(?:-(?:webkit|moz)-)?user-select|overscroll-behavior(?:-[xy])?|scroll-behavior|scroll-(?:padding|margin)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?)$/.test(property));
  }

  // A sticky-header class on the page does not necessarily restyle its article.
  // Narrow only with a complete readable CSSOM proof. Unknown selectors,
  // imports, shadow scopes and inherited root paint retain the full scan.
  function classPaintRoots(node, scopes) {
    if (node !== document.body && node !== document.documentElement && !largeScopes.has(node)) return null;
    const previous = classSnapshots.get(node), current = node.getAttribute('class');
    if (previous === undefined) return null;
    if (previous === current) return [];
    const before = new Set((previous || '').split(/\s+/).filter(Boolean)), after = new Set((current || '').split(/\s+/).filter(Boolean));
    const changed = [...new Set([...before, ...after])].filter(name => before.has(name) !== after.has(name));
    if (hasDescendantShadow(node) || changed.some(name => !/^[\w-]+$/.test(name))) return null;
    if (!scopes.has('classRules')) {
      const selectors = []; let count = 0, valid = true;
      const inspect = rules => { for (const rule of rules) {
        if (++count > 8192 || rule.type === 3) { valid = false; return; }
        if (rule.selectorText) selectors.push(rule);
        if (rule.cssRules) inspect(rule.cssRules);
        if (!valid) return;
      }};
      try { for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
        if (sheet === shadowSheet || sheet.ownerNode?.id?.startsWith('oled-night-')) continue;
        if (!sheet) { valid = false; break; }
        inspect(sheet.cssRules); if (!valid) break;
      }} catch { valid = false; }
      scopes.set('classRules', valid ? selectors : null);
    }
    const selectors = scopes.get('classRules'); if (!selectors) return null;
    const affected = changed.length ? new RegExp('\\.(?:' + changed.join('|') + ')(?![\\w-])') : /$a/;
    const roots = new Set(), oldProbe = document.createElement(node.localName), newProbe = document.createElement(node.localName);
    if (previous !== null) oldProbe.setAttribute('class',previous);
    if (current !== null) newProbe.setAttribute('class',current);
    for (const rule of selectors) {
      const text = rule.selectorText;
      // Most rules cannot depend on this changed class. Inspect declarations
      // only for possible dependencies; reading every unrelated declaration
      // made repeated flyout class changes synchronous page-wide CSSOM work.
      if (!affected.test(text) && !text.includes('\\') && !/\[\s*class\b/i.test(text)) continue;
      if (changesOnlyInteractionBehavior(rule.style)) continue;
      if (text.includes('\\')) {
        // Utility sheets contain many escaped names such as .lg\:flex.
        // Unrelated names do not invalidate this proof. Decode only to detect
        // a possible dependency; affected escaped selectors stay conservative.
        const decoded = text.replace(/\\(?:([0-9a-f]{1,6})[\t\n\f\r ]?|([^\n\r\f]))/gi, (_, hex, char) => {
          const code = hex && parseInt(hex, 16);
          return hex ? String.fromCodePoint(code > 0 && code <= 0x10ffff ? code : 0xfffd) : char;
        });
        if (affected.test(decoded) || /\[\s*class\b/i.test(decoded)) return null;
      }
      // Unrelated substring/prefix class selectors cannot invalidate this
      // proof when their truth value is identical before and after the edit.
      for (const attribute of text.match(/\[\s*class\b[^\]]*\]/gi) || []) {
        try { if (oldProbe.matches(attribute) !== newProbe.matches(attribute)) return null; }
        catch { return null; }
      }
      if (!affected.test(text)) continue;
      for (const selector of text.split(/,(?![^()]*\))/)) {
        if (!affected.test(selector)) continue;
        // Only a plain ancestor compound followed by a descendant selector:
        // no :has(), sibling effects, nesting, or changed subject state.
        const parts = selector.trim().split(/\s+/), index = parts.findLastIndex(part => affected.test(part));
        if (index < 0 || index === parts.length - 1 || !parts.slice(0,index+1).every(part => /^(?:(?:html|body|:root)?(?:\.[\w-]+|:not\(\.[\w-]+\))+|html|body|:root)$/.test(part))) return null;
        const suffix = parts.slice(index+1).join(' ');
        if (/^[>+~]|:has\(|&|::part|::slotted/.test(suffix)) return null;
        const tail = suffix.replace(/::?(?:before|after)\b/g, '');
        try { for (const target of node.querySelectorAll(tail)) { roots.add(target); if (roots.size > 64) return null; } }
        catch { return null; }
      }
    }
    return [...roots];
  }

  function pageSheetSelectors(node) {
    if (!node.sheet) return node.isConnected ? [] : null;
    let count = 0, length = 0, keyframes = false; const selectors = [];
    const inspect = rules => {for(const rule of rules) {
      if (++count > 512 || rule.type === 3) throw Error('Unbounded or indirect sheet');
      if (rule.type === 7) {
        // Popup modules append opacity/transform entry keyframes repeatedly.
        // These properties remain native, just like compositor-only inline
        // writes. They introduce no paint consumer to find across unrelated,
        // possibly unreadable sheets. Color/geometry/custom-property animation
        // definitions still require the conservative consumer search below.
        for (const frame of rule.cssRules) {
          if (++count > 512) throw Error('Unbounded keyframe definition');
          if (Array.from(frame.style).some(property =>
            !/^(?:opacity|transform|translate|rotate|scale|will-change|animation-timing-function)$/.test(property))) keyframes = true;
        }
        continue;
      }
      if (rule.selectorText) {
        // Event hit testing does not alter any color, image, geometry or
        // generated paint we measure. A late tooltip module often sets this
        // on every citation child; rereading those children is wasted work.
        if (changesOnlyInteractionBehavior(rule.style)) continue;
        length += rule.selectorText.length; if(length > 32768 || /:host|::part|::slotted|&/.test(rule.selectorText)) throw Error('Uncertain selector scope');
        selectors.push(rule.selectorText.replace(/::?(?:before|after|placeholder)\b/g,''));
      } else if (!rule.cssRules) throw Error('Global stylesheet definition');
      if(rule.cssRules) inspect(rule.cssRules);
    }};
    try {
      inspect(node.sheet.cssRules);
      // Keyframe definitions affect animation subjects, rather than every
      // article node. Include every authored animation declaration, including
      // variables and inactive states; uncertain scopes retain the full scan.
      if (keyframes) {
        let total = 0;
        const animations = rules => {for (const rule of rules) {
          if (++total > 8192 || rule.type === 3) throw Error('Unknown animation scope');
          // A new keyframe definition can affect animation names/shorthands.
          // Global duration/iteration resets (often in reduced-motion rules)
          // introduce no animation subject and must not promote this to a
          // page-wide scan.
          if (rule.selectorText && rule.style && Array.from(rule.style).some(p => /^(?:-webkit-)?animation(?:-name)?$/.test(p))) {
            if (/:host|::part|::slotted|&/.test(rule.selectorText)) throw Error('Unknown animation subject');
            selectors.push(rule.selectorText.replace(/::?(?:before|after)\b/g,''));
          }
          if (rule.type !== 7 && rule.cssRules) animations(rule.cssRules);
        }};
        for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
          if (sheet === shadowSheet || sheet.ownerNode?.id?.startsWith('oled-night-')) continue;
          animations(sheet.cssRules);
        }
        selectors.push('[style*="animation" i]');
      }
      return selectors;
    } catch {return null;}
  }

  function pageSheetFingerprint(node) {
    try {
      if (!node.isConnected || !node.sheet) return null;
      const parts = []; let length = 0;
      for (const rule of node.sheet.cssRules) {
        const text = rule.cssText; length += text.length;
        if (length > 262144) return null;
        parts.push(text);
      }
      return parts.join('\n') + '\n' + node.sheet.disabled + '\n' + node.media;
    } catch { return null; }
  }

  function queuePageSheet(node, loaded = false) {
    const before = sheetSnapshots.get(node), scope = node.isConnected ? node.getRootNode() : before?.scope;
    if (scope instanceof ShadowRoot) {
      if (node.isConnected) sheetSnapshots.set(node,{selectors:null,fingerprint:null,scope}); else sheetSnapshots.delete(node);
      pendingTrees.add(scope.host);
      return;
    }
    // A style element's load event follows its text mutation. Compare the
    // complete bounded CSSOM, not just selectors: declaration-only edits must
    // invalidate paint, and unreadable/large sheets cannot claim equivalence.
    const fingerprint = pageSheetFingerprint(node);
    if (loaded && fingerprint !== null && before?.fingerprint === fingerprint) return;
    const after = node.isConnected ? pageSheetSelectors(node) : before === undefined ? null : [];
    const previous = before?.selectors;
    if(node.isConnected) sheetSnapshots.set(node,{selectors:after,fingerprint,scope}); else sheetSnapshots.delete(node);
    const full = () => {polarityDirty = true;pendingTrees.add(document.documentElement)};
    // Document selectors cannot pierce a shadow boundary. Matching hosts are
    // scanned with their roots; ::part/:host/::slotted remain uncertain above.
    if (after === null || previous === null || (!node.isConnected && before === undefined)) {full();return;}
    const roots = new Set();
    try {for(const selector of new Set([...(previous || []),...(after || [])])) {
      for(const target of document.querySelectorAll(selector)) {
        roots.add(target); if(roots.size > 2048 || target === document.body || target === document.documentElement) {full();return;}
      }
    }} catch {full();return;}
    for(const root of roots) pendingTrees.add(root);
  }

  function onMutations(records, scheduleBatch = true) {
    const ownBackgrounds = recentBackgroundWrites;
    recentBackgroundWrites = new Map();
    const ownShared = recentSharedBackgrounds;
    recentSharedBackgrounds = new Map();
    // A later page write changes the complete attribute and must be processed.
    // Only our still-identical color write is redundant. This map lives for
    // one delivery, is bounded, and is cleared on disable/flush as well.
    records = records.filter(record => record.type !== 'attributes' || record.attributeName !== 'style' ||
      !ownBackgrounds.has(record.target) || ownBackgrounds.get(record.target) !== record.target.getAttribute('style'));
    records = records.filter(record => record.type !== 'attributes' || record.attributeName !== SHARED_BG ||
      !ownShared.has(record.target) || ownShared.get(record.target) !== record.target.getAttribute(SHARED_BG));
    // Navigation scripts often close every menu on every scroll/focus event,
    // assigning aria-expanded=false even to already-closed controls. Compare
    // the first old value with the final value for this delivery before any
    // invalidation or controlled-menu traversal. Real transitions still queue
    // both the trigger and its menu; changes to other attributes stay visible.
    const stateChanges = new Map();
    records = records.filter(record => {
      if (record.type !== 'attributes' || (record.attributeName !== 'class' && !STATE_ATTRIBUTES.includes(record.attributeName))) return true;
      let names = stateChanges.get(record.target);
      if (!names) stateChanges.set(record.target, names = new Set());
      if (names.has(record.attributeName)) return false;
      names.add(record.attributeName);
      return record.oldValue !== record.target.getAttribute(record.attributeName);
    });
    if (!records.length) return;
    const seenAttributes = new Map();
    const backgroundScopes = new Map();
    const changedRoots = new Set();
    const removed = [];
    const invalidatedAncestors = new Set();
    // Inspect the complete delivery first: a descendant edit and a row's class
    // toggle can arrive together in either order. Never reuse an earlier ink
    // proof after external styles, content, attributes or children changed.
    for (const record of records) {
      let node = record.target;
      if (record.type === "attributes") {
        if (["style", MARK].includes(record.attributeName) && overridesIntact(node) &&
            inlineSignature(node) === (inlineStyles.get(node) || "")) continue;
        if (record.attributeName === "class" && paintContainers.has(node)) node = parentAcrossShadow(node);
      } else if (!(node instanceof Element)) node = node.parentElement;
      for (; node && !invalidatedAncestors.has(node); node = parentAcrossShadow(node)) {
        invalidatedAncestors.add(node); containerPaint.delete(node);
      }
    }
    for (const record of records) {
      const target = record.target;
      const copies = mediaCopies.get(target);
      if (copies && (record.type === "childList" || record.attributeName === "class" ||
          (record.attributeName === "style" && inlineSignature(target) !== (inlineStyles.get(target) || "")))) {
        queueMediaCopies(copies);
      }
      const scope = target.getRootNode();
      if (scope instanceof ShadowRoot && shadowRoots.has(scope)) changedRoots.add(scope);
      // Class/state records were already deduplicated above. Avoid allocating
      // another per-row set for every animated background transition.
      if (record.type === "attributes" && record.attributeName !== 'class' && !STATE_ATTRIBUTES.includes(record.attributeName)) {
        let names = seenAttributes.get(target);
        if (!names) seenAttributes.set(target, names = new Set());
        if (names.has(record.attributeName)) continue;
        names.add(record.attributeName);
      }
      if (isPageSheet(target) || (record.type === "characterData" && isPageSheet(target.parentElement))) {
        queuePageSheet(isPageSheet(target) ? target : target.parentElement);
      } else if (record.type === "childList") {
        removed.push(...record.removedNodes);
        for(const node of [...record.addedNodes,...record.removedNodes]) {
          if(isPageSheet(node)) queuePageSheet(node);
          else if(node instanceof Element) for(const sheet of node.querySelectorAll('style, link[rel~="stylesheet"]')) if(isPageSheet(sheet)) queuePageSheet(sheet);
        }
        for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) pendingTrees.add(node);
      } else if (record.attributeName === SHARED_BG) {
        pendingTrees.add(target);
      } else if (record.attributeName === "class" || STATE_ATTRIBUTES.includes(record.attributeName)) {
        if (record.attributeName === 'class') {
          const roots = classPaintRoots(target, backgroundScopes);
          classSnapshots.set(target, target.getAttribute('class'));
          if (roots) { for (const node of roots) pendingTrees.add(node); continue; }
        }
        // Sites often switch their own theme with a class on <html>/<body>.
        if (target === document.documentElement || target === document.body) polarityDirty = true;
        // Class changes can restyle the whole subtree through descendant selectors.
        if (record.attributeName === "class" && fastBackgroundState(target, backgroundScopes)) continue;
        pendingTrees.add(target);
        // Expanded controls commonly reveal a sibling menu. Its existing
        // descendants can acquire a new surface without their own mutation.
        if (record.attributeName === "aria-expanded") {
          const controlled = target.getAttribute("aria-controls");
          const menu = controlled && target.getRootNode().getElementById?.(controlled);
          if (menu) pendingTrees.add(menu);
          else if (target.parentElement && target.parentElement !== document.body && target.parentElement !== document.documentElement && target.parentElement.children.length <= 20) pendingTrees.add(target.parentElement);
        }
      } else if (!overridesIntact(target)) {
        // Frameworks can replace style/attributes without changing any page
        // color property. The cached decision is not proof it is still applied.
        pendingTrees.add(target);
      } else if (record.attributeName === "style") {
        const signature = inlineSignature(target);
        if (signature !== (inlineStyles.get(target) || "")) {
          inlineStyles.set(target, signature);
          if (target === document.documentElement || target === document.body) polarityDirty = true;
          // Custom properties and inherited ink can restyle descendants.
          pendingTrees.add(target);
        }

      }
    }
    // Navigation and virtualized lists discard entire component trees. Release
    // our strong references on that mutation, including in background tabs,
    // rather than waiting for the sheet health timer or frame polling.
    if (removed.length) releaseDetachedComponents(removed);
    for (const root of changedRoots) if (shadowRoots.has(root)) ensureShadowSheet(root);
    if (scheduleBatch && (pendingTrees.size || pendingSelf.size || polarityDirty)) schedule(true);
  }

  function overrideRules() {
    // Use ID-level specificity without requiring an ID on page elements.
    // Multi-class + tag !important selection rules must not beat our colors.
    // The outer marker still scopes every override; measurement still opts out.
    const on = `:is([${MARK}], #oled-night-color-priority):not([${MEASURE}], [${MEASURE}] *):not([${MEASURE_SELF}])`;
    const onPseudo = `:is([${MARK}], #oled-night-color-priority):not([${MEASURE}], [${MEASURE}] *):not([${MEASURE_PSEUDO}])`;
    return `
      /* Each paint variable belongs to its marked element (and its pseudos).
         Inheriting thousands of unused values makes updates invalidate and
         retain style data throughout unrelated descendants. Theme controls
         such as --oln-strength still inherit. Generated-paint variables must
         also reach their originating element's before/after/placeholder. */
      ${PROPS.map(key => `@property --oln-${key} { syntax: "*"; inherits: false; }`).join("\n")}
      [${MARK}~="bg"]${on} { background-color: var(--oln-bg) !important; }
      [${MARK}~="img"]${on} { background-image: var(--oln-img) !important; }
      [${MARK}~="shadow"]${on} { box-shadow: var(--oln-shadow) !important; }
      [${MARK}~="fg"]${on} { color: var(--oln-fg) !important; }
      [${MARK}~="ink"]${on} { -webkit-text-fill-color: var(--oln-ink) !important; }
      [${MARK}~="caret"]${on} { caret-color: var(--oln-caret) !important; }
      [${MARK}~="placeholder"]${onPseudo}::placeholder { --oln-placeholder: inherit !important; color: var(--oln-placeholder) !important; -webkit-text-fill-color: var(--oln-placeholder) !important; }
      [${MARK}~="field"]${on} { color-scheme: dark !important; }
      /* Native popup paint may use white for transparent <option> rows even
         when the closed select inherits a dark color scheme (Chrome/Windows).
         Give unmodified rows a real dark surface and readable text. */
      select[${MARK}~="field"] :is(option, optgroup):not([${MARK}~="bg"]):not([${MEASURE}], [${MEASURE}] *):not([${MEASURE_SELF}]) { background-color: #18181c !important; }
      select[${MARK}~="field"] option:checked:not([${MARK}~="bg"]):not([${MEASURE}], [${MEASURE}] *):not([${MEASURE_SELF}]) { background-color: #1b3c60 !important; }
      select[${MARK}~="field"] :is(option, optgroup):not([${MARK}~="fg"]):not([${MEASURE}], [${MEASURE}] *):not([${MEASURE_SELF}]) { color: hsl(0 0% var(--oln-light, 88%)) !important; }
      select[${MARK}~="field"] :is(option, optgroup):not([${MEASURE}], [${MEASURE}] *):not([${MEASURE_SELF}]) { -webkit-text-fill-color: currentColor !important; }
      [${MARK}~="field"]${on}:is(:autofill, :-webkit-autofill) { -webkit-text-fill-color: var(--oln-fg, #ddd) !important; caret-color: var(--oln-fg, #ddd) !important; box-shadow: 0 0 0 1000px var(--oln-bg, #101014) inset !important; }
      [${MARK}~="bt"]${on} { border-top-color: var(--oln-bt) !important; }
      [${MARK}~="br"]${on} { border-right-color: var(--oln-br) !important; }
      [${MARK}~="bb"]${on} { border-bottom-color: var(--oln-bb) !important; }
      [${MARK}~="bl"]${on} { border-left-color: var(--oln-bl) !important; }
      [${MARK}~="outline"]${on} { outline-color: var(--oln-outline) !important; }
      [${MARK}~="fill"]${on} { fill: var(--oln-fill) !important; }
      [${MARK}~="stroke"]${on} { stroke: var(--oln-stroke) !important; }
      [${MARK}~="stop"]${on} { stop-color: var(--oln-stop) !important; }
      [${MARK}~="blend"]${on} { mix-blend-mode: normal !important; }
      /* Small, meaningful icons faded for a light page need some contrast
         after their surrounding light surface becomes black. */
      img[${MARK}~="faded-icon"]${on} { opacity: 0.65 !important; filter: drop-shadow(0 0 1px #888) !important; }
      [${MARK}~="asset-icon"]${on} { filter: drop-shadow(0 0 0.75px #ddd) drop-shadow(0 0 0.75px #ddd) !important; }
      [${MARK}~="icon-invert"]${on} { filter: invert(1) !important; }
      [${NOANIM}], [${NOANIM}] *, [${NOANIM}]::before, [${NOANIM}]::after, [${NOANIM}] *::before, [${NOANIM}] *::after { transition: none !important; }
      [${NOANIM_SELF}], [${NOANIM_SELF}]::before, [${NOANIM_SELF}]::after { transition: none !important; }
      [${NOANIM}][${MOTION}], [${NOANIM}] [${MOTION}], [${NOANIM_SELF}][${MOTION}] { transition: var(--oln-motion) !important; }
      [${MARK}~="before-bg"]${onPseudo}::before { --oln-before-bg: inherit !important; background-color: var(--oln-before-bg) !important; }
      [${MARK}~="before-img"]${onPseudo}::before { --oln-before-img: inherit !important; background-image: var(--oln-before-img) !important; }
      [${MARK}~="before-shadow"]${onPseudo}::before { --oln-before-shadow: inherit !important; box-shadow: var(--oln-before-shadow) !important; }
      [${MARK}~="before-fg"]${onPseudo}::before { --oln-before-fg: inherit !important; color: var(--oln-before-fg) !important; }
      [${MARK}~="after-bg"]${onPseudo}::after { --oln-after-bg: inherit !important; background-color: var(--oln-after-bg) !important; }
      [${MARK}~="after-img"]${onPseudo}::after { --oln-after-img: inherit !important; background-image: var(--oln-after-img) !important; }
      [${MARK}~="after-shadow"]${onPseudo}::after { --oln-after-shadow: inherit !important; box-shadow: var(--oln-after-shadow) !important; }
      [${MARK}~="after-fg"]${onPseudo}::after { --oln-after-fg: inherit !important; color: var(--oln-after-fg) !important; }
      input[${MARK}~="bg"], textarea[${MARK}~="bg"], select[${MARK}~="bg"], button[${MARK}~="bg"] { color-scheme: dark !important; accent-color: #66a3ff; }
    `;
  }

  // Painted before the page has any content, so a white page never flashes.
  function installEarly() {
    // A transparent embed must be allowed to show the host's backdrop.
    // Its paint cannot be classified before <body> and stylesheets exist.
    if (!isTopFrame) return;
    if (Settings.prefersNativeColors(hostname())) return;
    if (colorsApi().usesNativeChatTheme(hostname())) return;
    // Wait for the parsed form/provider on auth URLs before touching the page.
    if (AUTH_PATH.test(location.pathname)) return;
    if (document.getElementById("oled-night-early")) return;
    const early = document.createElement("style");
    early.id = "oled-night-early";
    early.textContent = "html, body { background: #000 !important; color-scheme: dark !important; }";
    (document.head || document.documentElement).appendChild(early);
  }

  function removeEarly() {
    document.getElementById("oled-night-early")?.remove();
  }

  function installSheet() {
    if (document.getElementById("oled-night-sheet")) return;
    const root = `html[data-oled-night-root]:is(*, #oled-night-profile-priority):not([${MEASURE}])`;
    const surface = `${root}:not([${MEASURE_ROOT}])`;
    const sheet = document.createElement("style");
    sheet.id = "oled-night-sheet";
    sheet.textContent = `
      ${root}:not([data-oled-night-page="none"]), ${root}:not([data-oled-night-page="none"]) body { color-scheme: dark !important; }
      ${surface}:not([data-oled-night-page="none"]), ${surface}:not([data-oled-night-page="none"]) body { background: var(--oled-night-page, #000) !important; }
      ${surface}[data-oled-night-transparent-frame]:not([data-oled-night-page="none"]), ${surface}[data-oled-night-transparent-frame]:not([data-oled-night-page="none"]) body { background: transparent !important; }
      ${overrideRules()}
      html[data-oled-night-root] :focus-visible { outline-color: #66a3ff !important; }
      /* Both properties inherit. A descendant-wide highlight rule makes Blink
         maintain highlight paint on every changing row, even with no range
         selected. Set one document highlight and let nested text inherit it. */
      ${root}:not([data-oled-night-page="none"]) { scrollbar-color: rgb(58 58 66) transparent; }
      ${root}:not([data-oled-night-page="none"])::selection { background: rgb(38 79 140) !important; color: #fff !important; }
      /* Gecko still uses originating-element selection styles. Its prefixed
         alias supplies that fallback without a descendant highlight in Blink. */
      ${root}:not([data-oled-night-page="none"]) ::-moz-selection { background: rgb(38 79 140) !important; color: #fff !important; }
      html[data-oled-night-root][data-oled-night-dim]:not([data-oled-night-invert]) :is(img, video) { filter: brightness(0.78) !important; }
      html[data-oled-night-invert] { filter: invert(1) hue-rotate(180deg) !important; background: #fff !important; }
      html[data-oled-night-root]:not([data-oled-night-invert]) img[${LOGO}] { filter: invert(1) hue-rotate(180deg) !important; }
      html[data-oled-night-root]:not([data-oled-night-invert]) img[${LOGO_EDGE}] { filter: drop-shadow(0 0 1px #ddd) drop-shadow(0 0 1px #ddd) !important; }
      /* Apple's auth widget paints autofill with an inset shadow and explicit
         text-fill, independently of color. Cover UA autofill/preview paint in
         every input state; keep a separate focus outline visible. */
      ${root}[data-oled-night-site="apple-auth"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) .form-textbox :is(input.form-textbox-input, textarea.form-textarea) {
        background-color: var(--oled-night-page, #000) !important;
        color: hsl(0 0% var(--oln-light, 88%)) !important;
        -webkit-text-fill-color: hsl(0 0% var(--oln-light, 88%)) !important;
        caret-color: hsl(0 0% var(--oln-light, 88%)) !important;
        box-shadow: inset 0 0 0 1000px var(--oled-night-page, #000) !important;
      }
      ${root}[data-oled-night-site="apple-auth"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) .form-textbox :is(input.form-textbox-input, textarea.form-textarea):focus-visible {
        outline: 2px solid #66a3ff !important;
        outline-offset: -2px !important;
      }
      /* Amazon's monochrome disclosure/close sprites do not inherit text color.
         Limit the filter to these controls: the same sheet contains colored art. */
      ${root}[data-oled-night-site="amazon"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) :is(.a-expander-header .a-icon-section-expand, .a-expander-header .a-icon-section-collapse, .a-popover .a-icon-close, #nav-bell .nav-bell-icon, #abn-hamburger-menu .abn-hm-icon) {
        filter: brightness(0) invert(1) !important;
      }
      ${root}[data-oled-night-site="amazon"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) .a-expander-header :is(.a-icon-extender-expand, .a-icon-extender-collapse) {
        border-color: currentColor !important;
      }
      /* Amazon's white Compare SVG sits over darkened product cards. Reduce
         only the collapsed icon glare; restore full contrast when expanded. */
      ${root}[data-oled-night-site="amazon"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) .copilot-compare-on-image-button.cp-comparison-button-animated-collapsed {
        filter: brightness(0.72) !important;
      }
      /* RES adds a light toolbar even on native-dark Reddit. Do not recolor
         unrelated white content or invert images elsewhere on the page. */
      ${root}[data-oled-night-site="reddit"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) .res-floater-belowNavbar {
        background-color: var(--oled-night-page, #000) !important;
        color: hsl(0 0% var(--oln-light, 88%)) !important;
        border: 1px solid #38383e !important;
      }
      ${root}[data-oled-night-site="reddit"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) .res-floater-belowNavbar :is(a, span, button) {
        color: hsl(0 0% var(--oln-light, 88%)) !important;
      }
      ${root}[data-oled-night-site="reddit"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) .res-floater-belowNavbar #RESAccountSwitcherIcon {
        filter: invert(1) !important;
      }
      /* Gmail: on black, unread (tr.zE) and read (tr.yO) rows only differ by
         font weight. Mark unread with an accent bar and full-brightness text,
         and step read rows down to the muted text level. */
      ${root}[data-oled-night-site="gmail"] tr.zA.zE { box-shadow: inset 3px 0 0 #8ab4f8 !important; }
      /* Gmail shows authored HTML mail on its own light canvas. Inheriting our
         dark color scheme resolves system colors such as WindowText to white,
         hiding whole paragraphs in mail with a white background. */
      ${root}[data-oled-night-site="gmail"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) .a3s {
        color-scheme: light !important;
      }
      ${root}[data-oled-night-site="gmail"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) :is(.ajR, .ajV)[role="button"] img.ajT { filter: brightness(0) invert(1) !important; opacity: .85 !important; }
      ${root}[data-oled-night-site="gmail"] tr.zA.zE td, ${root}[data-oled-night-site="gmail"] tr.zA.zE td * { color: hsl(0 0% var(--oln-light, 88%)) !important; }
      ${root}[data-oled-night-site="gmail"] tr.zA.yO td, ${root}[data-oled-night-site="gmail"] tr.zA.yO td * { color: hsl(0 0% max(40%, calc(var(--oln-light, 88%) * 0.66))) !important; }
      html[data-oled-night-invert] :is(img, video, iframe, embed, object) { filter: invert(1) hue-rotate(180deg) !important; }
      html[data-oled-night-root][data-oled-night-youtube] body,
      html[data-oled-night-root][data-oled-night-youtube] ytd-app,
      html[data-oled-night-root][data-oled-night-youtube] #content,
      html[data-oled-night-root][data-oled-night-youtube] ytd-page-manager { background-color: var(--oled-night-page) !important; }
      html[data-oled-night-root][data-oled-night-youtube] ytd-app {
        --yt-spec-text-primary: var(--oled-night-youtube-primary) !important;
        --yt-spec-text-secondary: var(--oled-night-youtube-secondary) !important;
      }
      /* Native ChatGPT tokens (current app shell and legacy web UI). Only its
         dark theme's base surfaces change: code, dialogs, controls, selection,
         photographic media and inherited native ink retain their own palette. */
      html[data-oled-night-chatgpt]:is([data-theme="dark"], .dark) {
        --app-color-background-surface: var(--oled-night-page, #000) !important;
        --app-color-background-surface-under: var(--oled-night-page, #000) !important;
        --main-surface-primary: var(--oled-night-page, #000) !important;
        --bg-primary: var(--oled-night-page, #000) !important;
      }
      html[data-oled-night-chatgpt]:is([data-theme="dark"], .dark),
      html[data-oled-night-chatgpt]:is([data-theme="dark"], .dark) body {
        background-color: var(--oled-night-page, #000) !important;
      }
    `;
    (document.head || document.documentElement).appendChild(sheet);
  }

  function disable() {
    for (const entry of spriteDocuments.values()) { entry.controller.abort(); entry.waiting.clear(); }
    spriteDocuments.clear();
    stopYouTubeTheme?.();
    stopYouTubeTheme = null;
    document.removeEventListener("load", onSheetLoad, true);
    document.removeEventListener("loadeddata", onSheetLoad, true);
    for (const type of INTERACTION_EVENTS) document.removeEventListener(type, onInteraction, true);
    if (flushHandle !== null) {
      if (flushTimer) clearTimeout(flushHandle); else cancelAnimationFrame(flushHandle);
    }
    flushHandle = null;
    flushScheduled = false;
    flushMicrotask = false;
    flushEpoch++;
    clearTimeout(settleTimer);
    settleTimer = null;
    settleSelf.clear();
    settleTrees.clear();
    if (interactionFrame !== null) cancelAnimationFrame(interactionFrame);
    interactionFrame = null;
    interactionSelf.clear();
    interactionTrees.clear();
    parsedShadowCursor = null;
    inlineStyles = new WeakMap();
    active = false;
    clearInterval(challengeTimer);
    challengeTimer = null;
    clearInterval(shadowHealthTimer);
    shadowHealthTimer = null;
    document.removeEventListener("visibilitychange", repairShadowSheets);
    document.removeEventListener("visibilitychange", scheduleShadowDiscovery);
    document.removeEventListener("visibilitychange", scheduleRefresh);
    if (shadowDiscoveryFrame !== null) cancelAnimationFrame(shadowDiscoveryFrame);
    shadowDiscoveryFrame = null;
    if (refreshFrame !== null) {
      if (refreshIdle) cancelIdleCallback(refreshFrame); else cancelAnimationFrame(refreshFrame);
    }
    refreshFrame = null;
    refreshBatchLimit = 32;
    refreshRoots.clear();
    unresolvedShadowHosts.clear();
    observer?.disconnect();
    observer = null;
    viewportObserver?.disconnect();
    viewportObserver = null;
    deferredPaint.clear();
    observedPaint.clear();
    paintContainers.clear();
    pendingTrees.clear();
    pendingSelf.clear();
    applied = new WeakMap();
    containerPaint = new WeakMap();
    nativeInk = new WeakMap();
    recentBackgroundWrites.clear();
    recentSharedBackgrounds.clear();
    sharedBackgrounds.clear();
    sharedBackgroundScope = null;
    document.getElementById('oled-night-row-paint')?.remove();
    simpleScopeFingerprint = null;
    compiledPaintScope = null;
    simpleScopeEpoch = 0;
    originalSurface = new WeakMap();
    mediaCopies = new WeakMap();
    mediaCopyMeasurements = new WeakSet();
    textTiers = new WeakMap();
    removeEarly();
    const root = document.documentElement;
    for (const name of ["data-oled-night-root", "data-oled-night-youtube", "data-oled-night-chatgpt", "data-oled-night-page", "data-oled-night-transparent-frame", "data-oled-night-dim", "data-oled-night-invert", "data-oled-night-site", "data-oled-night-mode"]) root.removeAttribute(name);
    for (const name of ["--oled-night-page", "--oled-night-youtube-primary", "--oled-night-youtube-secondary", "--oln-light", "--oln-strength"]) root.style.removeProperty(name);
    document.getElementById("oled-night-sheet")?.remove();
    logoChecked = new WeakSet();
    logoBudget = 80;
    for (const scope of [document, ...shadowRoots]) {
      if (scope !== document) for (const type of INTERACTION_EVENTS) scope.removeEventListener(type, onInteraction, true);
      for (const node of scope.querySelectorAll(`[${MEASURE}], [${NOANIM}], [${MEASURE_SELF}], [${NOANIM_SELF}], [${MEASURE_PSEUDO}], [${MEASURE_ROOT}], [${LOGO}], [${LOGO_EDGE}], [${SHARED_BG}]`)) {
        for (const name of [MEASURE, NOANIM, MEASURE_SELF, NOANIM_SELF, MEASURE_PSEUDO, MEASURE_ROOT, LOGO, LOGO_EDGE, SHARED_BG]) node.removeAttribute(name);
      }
      for (const element of scope.querySelectorAll(`[${MARK}]`)) {
        element.removeAttribute(MARK);
        for (const key of PROPS) element.style.removeProperty(`--oln-${key}`);
      }
      if (scope !== document && shadowSheet) {
        try { scope.adoptedStyleSheets = scope.adoptedStyleSheets.filter((sheet) => sheet !== shadowSheet); } catch {}
      }
    }
    shadowRoots.clear();
    handledInteractions = new WeakSet();
  }

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

  // Brightness/contrast live in two root custom properties that every mapped
  // color references (custom properties also inherit into shadow trees).
  function applyTuning() {
    const tuning = Settings.tuningFor(settings, hostname());
    const root = document.documentElement.style;
    const brightness = clamp(tuning.brightness, 40, 100);
    root.setProperty("--oln-light", `${brightness}%`);
    root.setProperty("--oln-strength", String(clamp(tuning.contrast, 0, 100) / 100));
    if (tuning.dimImages) document.documentElement.setAttribute("data-oled-night-dim", "");
    else document.documentElement.removeAttribute("data-oled-night-dim");
    root.setProperty("--oled-night-youtube-primary", `hsl(0 0% ${brightness}%)`);
    root.setProperty("--oled-night-youtube-secondary", `hsl(0 0% ${Math.max(40, brightness - 18)}%)`);
  }

  function enable() {
    disable();
    if (isCaptchaProtectedAuth()) { active = true; return; }
    // A design editor's UI and canvas share color-bearing elements. Preserve
    // the entire document even for explicit recolor/invert overrides.
    if (Settings.prefersNativeColors(hostname())) { active = true; return; }
    if (isChallengePage()) {
      removeEarly();
      active = true;
      // Some challenges (press-and-hold, overlays) reveal the page in place.
      challengeTimer = setInterval(() => { if (!isChallengePage()) enable(); }, 1500);
      return;
    }
    const site = currentSiteMode();
    // Read the page's own background before any of our rules paint over it.
    const transparentFrame = isTransparentFrame();
    const nativeChat = colorsApi().usesNativeChatTheme(hostname());
    darkPage = !nativeChat && !colorsApi().usesNativeSafeMode(hostname()) && detectDarkPage();
    installSheet();
    active = true;
    const root = document.documentElement;
    root.setAttribute("data-oled-night-root", "");
    root.setAttribute("data-oled-night-version", VERSION);
    if (transparentFrame) root.setAttribute("data-oled-night-transparent-frame", "");
    const profile = colorsApi().siteProfile(location.hostname) || colorsApi().siteProfile(hostname());
    if (profile) root.setAttribute("data-oled-night-site", profile);
    applyTuning();
    // Canvas-drawn apps (Sheets, Figma) can't be recolored element by element:
    // invert the whole page and flip real imagery back.
    if (site === "invert") {
      root.setAttribute('data-oled-night-mode', 'invert');
      root.setAttribute("data-oled-night-invert", "");
      root.setAttribute("data-oled-night-page", "none");
      return;
    }
    // ChatGPT owns a complete native palette. Long streaming conversations must
    // never enter per-element measurement, mutation or interaction processing.
    // CSS follows its authored theme; light mode and raised surfaces stay native.
    if (nativeChat) {
      root.setAttribute('data-oled-night-mode', 'native');
      root.setAttribute('data-oled-night-chatgpt', '');
      root.setAttribute('data-oled-night-page', 'none');
      root.style.setProperty('--oled-night-page', resolvedAppearance(settings) === 'soft' ? '#101014' : '#000');
      return;
    }
    const mode = modeFor();
    root.setAttribute('data-oled-night-mode', mode);
    if (mode === "none") root.setAttribute("data-oled-night-page", "none");
    root.style.setProperty("--oled-night-page", mode === "soft" ? "#101014" : "#000");
    // YouTube watch pages hydrate incrementally. Apply its native color palette
    // through CSS only; never traverse or mutate its custom elements/player.
    if (colorsApi().usesNativeSafeMode(hostname())) {
      root.setAttribute("data-oled-night-youtube", "");
      stopYouTubeTheme = globalThis.OledNightYouTube.start();
      return;
    }
    // Observer first so shadow roots found during the first pass get watched too.
    // A page background that follows color-scheme reads differently under our
    // forced dark scheme; such pages keep the full switch for polarity checks.
    const original = pageColor;
    remeasurePolarity(false);
    schemeSensitive = ["r", "g", "b", "a"].some((channel) => pageColor[channel] !== original[channel]);
    pageColor = original;
    observer = new MutationObserver(onMutations);
    for(const node of document.querySelectorAll('style, link[rel~="stylesheet"]')) if(isPageSheet(node)) sheetSnapshots.set(node,{selectors:pageSheetSelectors(node),fingerprint:pageSheetFingerprint(node),scope:document});
    observer.observe(root, OBSERVE);
    document.addEventListener("visibilitychange", scheduleShadowDiscovery);
    document.addEventListener("visibilitychange", scheduleRefresh);
    document.addEventListener("load", onSheetLoad, true);
    document.addEventListener("loadeddata", onSheetLoad, true);
    for (const type of INTERACTION_EVENTS) document.addEventListener(type, onInteraction, true);
    process([root], [], true);
    observer.takeRecords();
  }

  let scheduleTimer = null;
  const structureKey = (config) => `${resolvedAppearance(config)}|${Settings.siteMode(config, hostname())}|${config.openClosedShadows}`;

  function applySettings(config) {
    revision += 1;
    const previous = settings;
    settings = Settings.normalize(config);
    clearTimeout(scheduleTimer);
    const wait = Settings.msUntilScheduleChange(settings.schedule);
    if (wait !== null) scheduleTimer = setTimeout(() => applySettings(settings), wait + 500);
    const enabled = isEnabled(settings);
    if (!enabled) { disable(); return; }
    if (!domReady) return; // enable() runs on DOMContentLoaded; the early sheet covers until then
    // A body may appear before the auth form and its CAPTCHA bootstrap. Do not
    // enable from the asynchronous settings callback until parsing finishes.
    if (AUTH_PATH.test(location.pathname) && document.readyState === "loading") return;
    if (isCaptchaProtectedAuth()) { if (!active || observer) enable(); return; }
    // Slider moves, per-site tuning and image dimming only retune variables; no page re-scan.
    if (active && structureKey(previous) === structureKey(settings)) { if (!Settings.prefersNativeColors(hostname())) applyTuning(); return; }
    enable();
  }

  // Diagnostic snapshot for "Report a broken site": what the extension decided
  // and which visible text still reads poorly. Only short text labels are kept.
  function report() {
    const colors = colorsApi();
    const lowContrast = [];
    const lowContrastGraphics = [];
    const up = (node) => node.parentElement || node.parentNode?.host || null;
    const shownBg = (el) => {
      for (let n = el; n; n = up(n)) {
        const c = colors.parseColor(getComputedStyle(n).backgroundColor);
        if (c && c.a >= 0.5) return c;
      }
      return { r: 0, g: 0, b: 0, a: 1 };
    };
    const describe = (el) => {
      const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3) : [];
      return el.localName + (el.id ? `#${el.id}` : "") + (cls.length ? `.${cls.join(".")}` : "");
    };
    const scan = (root) => {
      for (const el of root.querySelectorAll("*")) {
        if (lowContrast.length >= 40) return;
        if (el.shadowRoot) scan(el.shadowRoot);
        if (lowContrastGraphics.length < 40 && el.getAttribute(MARK)?.split(" ").includes("data")) {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (rect.width && rect.height && rect.bottom >= 0 && rect.top <= innerHeight && style.visibility === "visible" && +style.opacity > 0) {
            const svg = el instanceof SVGElement;
            const pseudo = el.getAttribute(MARK).includes("before-bg") ? "::before" : el.getAttribute(MARK).includes("after-bg") ? "::after" : null;
            const paint = colors.parseColor(pseudo ? getComputedStyle(el,pseudo).backgroundColor : svg ? (style.fill === "none" ? style.stroke : style.fill) : style.backgroundColor);
            const bg = shownBg(pseudo ? el : up(el));
            if (paint) {
              const alpha = paint.a * +style.opacity;
              const seen = {r:paint.r*alpha+bg.r*(1-alpha),g:paint.g*alpha+bg.g*(1-alpha),b:paint.b*alpha+bg.b*(1-alpha)};
              const a = colors.luminance(seen), b = colors.luminance(bg);
              const ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
              if (ratio < 3) lowContrastGraphics.push({element:describe(el),ratio:+ratio.toFixed(2),mark:el.getAttribute(MARK)});
            }
          }
        }
        const field = el.matches("input, textarea, select") || el.isContentEditable;
        if (!field && ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const rect = el.getBoundingClientRect();
        if (!rect.width || rect.bottom < 0 || rect.top > innerHeight) continue;
        const style = getComputedStyle(el);
        if (style.visibility !== "visible" || +style.opacity === 0) continue;
        const ink = style.getPropertyValue("-webkit-text-fill-color") || style.color;
        const fg = colors.parseColor(ink), bg = shownBg(el);
        if (!fg || fg.a < 0.08) continue;
        const alpha = fg.a * +style.opacity;
        const blended = { r: fg.r * alpha + bg.r * (1 - alpha), g: fg.g * alpha + bg.g * (1 - alpha), b: fg.b * alpha + bg.b * (1 - alpha) };
        const a = colors.luminance(blended), b = colors.luminance(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < 3) {
          lowContrast.push({ element: describe(el), inShadow: !!el.getRootNode().host, text: field ? "[field content omitted]" : [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(" ").trim().slice(0, 30),
            color: ink, background: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, ratio: +ratio.toFixed(2), mark: el.getAttribute(MARK) });
        }
      }
    };
    if (active) scan(document);
    return {
      extension: "OLED Night", version: VERSION, host: hostname(), when: new Date().toISOString(), userAgent: navigator.userAgent,
      active, siteMode: currentSiteMode(), mode: active ? document.documentElement.getAttribute('data-oled-night-mode') || modeFor() : "off", darkPage, pageColor,
      settings: { appearance: settings.appearance, ...Settings.tuningFor(settings, hostname()), schedule: settings.schedule },
      counts: { styled: document.querySelectorAll(`[${MARK}]`).length, shadowRoots: shadowRoots.size, deferredPaint: deferredPaint.size, observedPaint: observedPaint.size, paintContainers: paintContainers.size, refreshRoots: refreshRoots.size, frames: document.querySelectorAll("iframe").length },
      // Only each frame's origin and state are recorded, never its address path or content.
      frames: [...document.querySelectorAll("iframe")].slice(0, 20).map((frame) => {
        const rect = frame.getBoundingClientRect();
        let origin = "", reachable = false, darkened = null;
        try { origin = new URL(frame.src || "about:blank", location.href).origin; } catch {}
        try {
          const root = frame.contentDocument?.documentElement;
          if (root) { reachable = true; darkened = root.hasAttribute("data-oled-night-root"); }
        } catch {}
        return { origin, size: `${Math.round(rect.width)}x${Math.round(rect.height)}`, reachable, darkened };
      }),
      lowContrast, lowContrastGraphics
    };
  }


  if (frameIsUntouched()) return;
  installEarly();
  // Start as soon as <body> exists rather than after the whole document has
  // loaded, so heavy pages don't show their own white panels first. The page's
  // light/dark character is re-checked once its styles have fully loaded.
  if (!domReady) {
    const start = () => {
      if (domReady) return;
      domReady = true;
      bodyWatch.disconnect();
      if (isEnabled(settings) && revision > 0 && !AUTH_PATH.test(location.pathname)) enable();
    };
    const bodyWatch = new MutationObserver(() => { if (document.body) start(); });
    bodyWatch.observe(document.documentElement, { childList: true });
    if (document.body) start();
    document.addEventListener("DOMContentLoaded", () => {
      start();
      if (AUTH_PATH.test(location.pathname) && isEnabled(settings)) enable();
      // Challenge markers usually arrive after <body> opens, when darkening
      // already began; enable() now leaves the parsed challenge alone.
      if (active && isChallengePage()) enable();
      else if (active && observer) {
        polarityDirty = true; schedule();
        parsedShadowCursor = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT, {
          acceptNode: node => node.matches(PRESERVE) || isExternalOverlay(node) || isMedia(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
        });
        scheduleShadowDiscovery();
      }
    }, { once: true });
    addEventListener("load", () => { if (active) { polarityDirty = true; schedule(); } }, { once: true });
  }
  if (globalThis.browser) chrome.storage.sync.get(DEFAULTS).then(applySettings);
  else chrome.storage.sync.get(DEFAULTS, applySettings);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (globalThis.browser) chrome.storage.sync.get(DEFAULTS).then(applySettings);
    else chrome.storage.sync.get(DEFAULTS, applySettings);
  });
  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applySettings(settings));
  } catch {}
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "oled-night-status") {
      if (!isTopFrame) return;
      const mode = active ? document.documentElement.getAttribute('data-oled-night-mode') || modeFor() : "off";
      sendResponse({ active, darkPage, mode: mode !== "native" && active && currentSiteMode() === "invert" ? "invert" : mode, version: VERSION });
      return;
    }
    if (message?.type === "oled-night-report") {
      if (!isTopFrame) return;
      sendResponse(report());
      return;
    }
    if (message?.type !== "oled-night-preview") return;
    applySettings({ ...settings, ...message.patch });
    if (isTopFrame) sendResponse({ ok: true, revision });
  });
})();
