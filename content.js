(function () {
  "use strict";
  const chrome = globalThis.browser || globalThis.chrome;

  const VERSION = "0.6.42";
  const Settings = globalThis.OledNightSettings;
  const DEFAULTS = Settings.DEFAULTS;
  const MEDIA_SELECTOR = "img, picture, video, canvas, svg, iframe, object, embed, shreddit-player, shreddit-async-loader, shreddit-media-lightbox, zoomable-img";
  // Explicit color controls carry data, not decorative page colors.
  const COLOR_CONTROL = 'input[type="color"], [data-oled-night-preserve-colors], .react-colorful, .color-picker, .color-swatch, [role="slider"][aria-label*="hue" i], [role="slider"][aria-label*="saturation" i], [role="slider"][aria-label*="color" i]';

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
  const STATE_ATTRIBUTES = ["aria-selected", "aria-checked", "aria-expanded", "aria-disabled", "data-state", "data-highlighted", "selected", "disabled", "open"];
  const OBSERVE = { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "href", "media", MARK, SHARED_BG, ...STATE_ATTRIBUTES] };
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
  let textTiers = new WeakMap();
  let logoChecked = new WeakSet();
  let logoBudget = 80;
  let inlineStyles = new WeakMap();
  const pendingTrees = new Set();
  const pendingSelf = new Set();
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
        if (!sibling || node.parentElement?.childElementCount > 4 ||
            !(directMedia || ctx.style(node).position === "absolute" || ctx.style(sibling).position === "absolute")) continue;
        const frame = node.parentElement?.getBoundingClientRect();
        const underlay = sibling.getBoundingClientRect();
        const content = node.getBoundingClientRect();
        const media = frame && mediaUnderlay(sibling, frame, content, ctx, node);
        if (frame && underlay.width >= frame.width * 0.7 && underlay.height >= frame.height * 0.7 &&
            media) {
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
  function isControlAsset(element, computed, source) {
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
    // Protect native links/buttons before their first interaction too. CSSOM
    // hydration can change their surface without a mutation or input event.
    // Other semantic controls gain the same protection on interaction. Native
    // tag checks avoid another selector query during the full-page scan.
    if ((mode === "oled" || mode === "soft") && !found.bg &&
        (element.localName === "a" || element.localName === "button" || interactionSurfaces.has(element)) &&
        computed.backgroundImage === "none" && !paintsInk(computed))
      found.bg = computed.backgroundColor;
    if (mode === "oled" && isPageLayout(element, computed, colors.parseColor(computed.backgroundColor))) found.bg = "#000000";
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
    if (element.matches("input, textarea, select")) found.field = "1";
    if (mode === "crush") {
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
      return found;
    }
    if (DARKENING_BLENDS.test(computed.mixBlendMode)) found.blend = "normal";
    for (const [side, key] of SIDES) {
      if (computed[`border${side}Width`] === "0px" || computed[`border${side}Style`] === "none") continue;
      const border = colors.mapBorder(colors.parseColor(computed[`border${side}Color`]));
      if (border) found[key] = border;
    }
    if (computed.outlineWidth !== "0px" && computed.outlineStyle !== "none") {
      const outline = colors.mapBorder(colors.parseColor(computed.outlineColor));
      if (outline) found.outline = outline;
    }
    for (const pseudo of (ctx.generated(element) ? ["before", "after"] : [])) {
      const pseudoStyle = getComputedStyle(element, `::${pseudo}`);
      if (pseudoStyle.content && pseudoStyle.content !== "none" && pseudoStyle.content !== "normal") {
        mapSurface(pseudoStyle, `${pseudo}-`, mode, found);
        if (isDataFill(element, pseudoStyle, ctx, true)) {
          found[`${pseudo}-bg`] = colors.mapDataPaint(colors.parseColor(pseudoStyle.backgroundColor));
          found.data = "1";
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

  // Small inline SVG icons with a hard-coded dark fill/stroke would vanish on
  // black. Larger SVGs are charts/illustrations: their near-white area fills
  // and gradient stops (App Store Connect sparklines) are darkened instead,
  // while colored lines and bars keep their color.
  function decideSvg(svg, ctx, out) {
    const mode = modeForElement(svg, ctx);
    const nativeIcon = mode === "crush" && ctx.recolorLightRegions &&
      svg.closest('a, button, [role="button"], [role="radio"]');
    if (mode !== "oled" && mode !== "soft" && !nativeIcon) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Icons in an image creative share its authored light/dark ink.
    if (backdropOf(svg, ctx).image) return;
    const colors = colorsApi();
    const icon = rect.width <= 64 && rect.height <= 64;
    if (nativeIcon) {
      // Invert only wholly neutral badges: black-on-white details become
      // white-on-black together. SVG drop-shadow edges are not reliably painted
      // by every Chrome backend. Colored brands retain their authored paint.
      if (icon && !svg.querySelector('use,image,foreignObject')) {
        const bg = colors.luminance(backdropOf(svg, ctx).color);
        let neutral = true;
        const paints = [];
        for (const part of svg.querySelectorAll(ICON_PARTS)) {
          const s = ctx.style(part);
          for (const paint of [s.fill, s.stroke]) {
            if (paint === 'none') continue;
            const color = colors.parseColor(paint);
            // Gradients/referenced paint and translucent brand colors are not
            // evidence of a wholly neutral badge. Preserve uncertain artwork.
            if (!color || /^url\(/i.test(paint) || colors.chroma(color) > .1) neutral = false;
            if (color && color.a >= .5) paints.push(color);
          }
        }
        const unreadable = paints.some(c => {
          const ink = colors.luminance(c);
          return bg < .2 && (Math.max(bg, ink) + .05) / (Math.min(bg, ink) + .05) < 3;
        });
        out.push([svg, neutral && unreadable ? {"icon-invert":"1"} : {}]);
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
    if (backdropOf(img, ctx).image) {
      img.removeAttribute(LOGO);
      img.removeAttribute(LOGO_EDGE);
      return;
    }
    if (logoChecked.has(img) || logoBudget <= 0) return;
    const namedLogo = img.matches('[itemprop~="logo"]') ||
      /(?:^|[\s_./#-])logo(?:[\s_./?#-]|$)/i.test(`${img.alt} ${img.className} ${img.id} ${img.currentSrc || img.src}`);
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
    if (!observer || document.hidden || !unresolvedShadowHosts.size || shadowDiscoveryFrame !== null) return;
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

  function process(trees, selves) {
    const roots = new Set(trees.filter(node => node.isConnected));
    trees = [...roots].filter(node => !covered(node, roots));
    selves = [...new Set(selves)].filter(node => node.isConnected && !roots.has(node) && !covered(node, roots));
    const list = [];
    list.icons = new Set();
    list.images = new Set();
    const seen = new Set();
    for (const node of trees) collect(node, list, seen);
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
    const authored = [], fingerprint = [];
    const rules = [];
    let count = 0, length = 0, mayAnimate = false, movingPaint = false;
    try {
      for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
        if (sheet === shadowSheet || sheet.ownerNode?.id?.startsWith("oled-night-")) continue;
        if (!sheet || sheet.disabled || sheet.media?.length) return null;
        for (const rule of sheet.cssRules) {
          if (++count > 256 || rule.type !== 1 || rule.cssRules?.length) return null;
          const text = rule.cssText;
          length += text.length;
          if (length > 32768) return null;
          fingerprint.push(text);
          authored.push(rule);
        }
      }
      const key = fingerprint.join("\n");
      if (key === simpleScopeFingerprint && compiledPaintScope) return compiledPaintScope;
      for (const rule of authored) {
          const selectors = rule.selectorText?.split(",").map(selector => selector.trim());
          if (!selectors?.every(selector => /^(?:[a-z][\w-]*|\*)?(?:\.[\w-]+)*$/i.test(selector))) return null;
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
      if (key !== simpleScopeFingerprint) { simpleScopeFingerprint = key; simpleScopeEpoch++; }
      // Cache only compiled strings/colors. Every call still checks the full
      // CSSOM fingerprint, including insertRule and adopted sheet changes.
      compiledPaintScope = { epoch: simpleScopeEpoch, rules, mayAnimate, movingPaint };
      return compiledPaintScope;
    } catch { return null; }
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

  function processBatch(list, trees, selves) {
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
    for (const element of paintList) if (deferredPaint.has(element)) forgetDeferredPaint(element);
    const paintTrees = trees.filter(node => !deferredPaint.has(node));
    // Already-styled elements hide their original colors behind our overrides.
    // Read original colors with our overrides switched off (no paint happens in
    // between, so nothing flickers). A subtree switch restyles every descendant,
    // which is expensive on large pages, so when no re-read override is inherited
    // switch off just those elements. Inherited overrides (text, fill, stroke)
    // restyle their subtree either way, so they keep one switch per root.
    const measured = [], measuredSelf = [], measuredPseudo = [], calm = [], calmSelf = new Set();
    let scoped = false;
    const marked = [...paintList, ...list.images].filter((element) => element.isConnected && element.hasAttribute(MARK));
    // Form fields have (almost) no subtree, so their inherited overrides are cheap to switch.
    const deep = (element) => INHERITED_KEYS.test(element.getAttribute(MARK)) && !element.matches("input, textarea, select");
    if (marked.length <= MANY_MARKED && !marked.some(deep)) {
      for (const element of marked) {
        const keys = element.getAttribute(MARK);
        measuredSelf.push(element);
        if (PSEUDO_KEYS.test(keys)) measuredPseudo.push(element);
        if (INHERITED_KEYS.test(keys)) calm.push(element); else calmSelf.add(element);
      }
      scoped = true;
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
      const retained = [];
      properties.forEach((property, index) => {
        if (parseFloat(durations[index % durations.length]) <= 0) return;
        const props = property === "all" ? ["opacity", "transform", "translate", "rotate", "scale", "height", "width", "max-height", "max-width", "min-height", "min-width", "top", "right", "bottom", "left", "grid-template-rows", "grid-template-columns", "clip-path"] : [property];
        for (const prop of props) if (prop !== "none" && !COLOR_TRANSITION.test(prop)) retained.push(`${prop} ${durations[index % durations.length]} ${easing[index % easing.length]} ${delays[index % delays.length]}`);
      });
      if (retained.length) {
        node.style.setProperty("--oln-motion", retained.join(", "));
        node.setAttribute(MOTION, "");
        motion.push(node);
      }
    }
    for (const node of calm) node.setAttribute(NOANIM, "");
    for (const node of calmSelf) node.setAttribute(NOANIM_SELF, "");
    for (const node of measured) node.setAttribute(MEASURE, "");
    for (const node of measuredSelf) node.setAttribute(MEASURE_SELF, "");
    for (const node of measuredPseudo) node.setAttribute(MEASURE_PSEUDO, "");
    if (scoped && needsCalm) {
      // Like a subtree switch, finish the page's own color transitions before reading.
      const batch = new Set([...paintList, ...list.images]);
      for (const animation of document.getAnimations()) {
        const target = animation.effect?.target;
        if (animation instanceof CSSTransition && batch.has(target) && !calmSelf.has(target) && COLOR_TRANSITION.test(animation.transitionProperty)) {
          calmSelf.add(target);
          target.setAttribute(NOANIM_SELF, "");
        }
      }
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
        const found = recolor && DARKENING_BLENDS.test(computed.mixBlendMode) ? { blend: "normal" } : {};
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
    const writes = [...paintList.map((element, index) => [element, decisions[index]]), ...iconDecisions, ...imageDecisions];
    // Elements about to gain, lose or change an override also skip transitions.
    const changed = new Set();
    for (const [element, found] of writes) {
      if (unchanged(element, found)) continue;
      changed.add(element);
      if (!needsCalm && !PSEUDO_KEYS.test(Object.keys(found).join(" "))) continue;
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
      if (paintContainers.has(node) && paintScope && !paintScope.mayAnimate && plainDocumentContext(node, documentContexts)) containerPaint.set(node, {
        found: { ...found }, classes: node.getAttribute("class") || "", scopeEpoch: paintScope.epoch
      });
      else containerPaint.delete(node);
    }
    for (const img of logoCandidates) checkLogo(img, ctx);
    // Commit the new colors with transitions still off, then restore them.
    const first = calm[0] || calmSelf.values().next().value;
    if (first) getComputedStyle(first).color;
    for (const node of calm) node.removeAttribute(NOANIM);
    for (const node of calmSelf) node.removeAttribute(NOANIM_SELF);
    for (const node of motion) { node.removeAttribute(MOTION); node.style.removeProperty("--oln-motion"); }
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
      const nowDark = remeasurePolarity();
      if (nowDark !== darkPage && !["recolor", "deepen"].includes(currentSiteMode())) { enable(); return; }
    }
    const trees = [...pendingTrees];
    const selves = [...pendingSelf];
    pendingTrees.clear();
    pendingSelf.clear();
    process(trees, selves);
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
      if (path[0] && path[0] !== stop) queueInteraction(path[0], true, currentPaint);
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
      // Native copy can inherit its color from above the tile. Measure those
      // ancestors individually, without switching off their other descendants.
      for (let parent = parentAcrossShadow(copy); parent; parent = parentAcrossShadow(parent)) pendingSelf.add(parent);
    }
  }

  function onSheetLoad(event) {
    if (!observer) return;
    const copies = mediaCopies.get(event.target);
    if (copies) { queueMediaCopies(copies); schedule(); }
    if (!isPageSheet(event.target)) return;
    polarityDirty = true;
    pendingTrees.add(document.documentElement);
    schedule();
  }

  function fastBackgroundState(node, scopes) {
    if (!scopes.has('mode')) scopes.set('mode', modeFor());
    if (!scopes.has('contexts')) scopes.set('contexts', new Map());
    const mode = scopes.get('mode'), snapshot = containerPaint.get(node);
    if (!["oled", "soft"].includes(mode) || !paintContainers.has(node) || !snapshot ||
        !plainDocumentContext(node, scopes.get('contexts')) || !overridesIntact(node) || inlineSignature(node) !== "") return false;
    if (node.getAttribute(SHARED_BG) !== (snapshot.sharedToken ?? null)) return false;
    if (!scopes.has(document)) scopes.set(document, simplePaintScope());
    const scope = scopes.get(document);
    if (!scope || scope.mayAnimate || snapshot.scopeEpoch !== scope.epoch) return false;
    const current = node.getAttribute("class") || "";
    if (snapshot.classes === current) { forgetDeferredPaint(node); return true; }
    const oldClasses = new Set(snapshot.classes.split(/\s+/)), newClasses = new Set(current.split(/\s+/));
    const changed = new Set([...oldClasses, ...newClasses].filter(name => oldClasses.has(name) !== newClasses.has(name)));
    let affected = false, background = null, winner = null;
    for (const { selector, classes, backgroundOnly, background: paint, priority } of scope.rules) {
      if (classes.some(name => changed.has(name.slice(1)))) {
        // Shorthand backgrounds serialize their unused longhands as initial.
        // Any other paint/layout/custom-property change needs a native reread.
        if (!backgroundOnly) return false;
        affected = true;
      }
      if (paint && node.matches(selector)) {
        if (!winner || priority[0] > winner[0] || (priority[0] === winner[0] &&
            (priority[1] > winner[1] || (priority[1] === winner[1] && priority[2] >= winner[2])))) {
          winner = priority;
          background = paint;
        }
      }
    }
    const colors = colorsApi(), source = originalSurface.get(node)?.color, found = snapshot.found;
    const light = color => color?.a === 1 && colors.chroma(color) < 0.1 && colors.luminance(color) >= 0.8;
    if (!affected || !light(background) || !light(source) || (snapshot.effectivePaint || found.bg) !== colors.mapBackground(source, mode)) return false;
    const proofKey = `${background.r},${background.g},${background.b}`;
    if (!snapshot.inkProof?.has(proofKey)) {
    const branch = [node], walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode() && branch.length <= 16) branch.push(walker.currentNode);
    if (branch.length > 16) return false;
    for (const item of branch) {
      const ink = nativeInk.get(item), signature = applied.get(item), keys = (item.getAttribute(MARK) || "").split(" ");
      const foreground = signature?.match(/(?:^|;)fg=([^;]+)(?:;|$)/)?.[1];
      if (!ink || item.shadowRoot || item.matches(MEDIA_SELECTOR) || !/^(div|span|b|strong|em|i|small)$/.test(item.localName) ||
          (item !== node && originalSurface.get(item)) || !overridesIntact(item) || inlineSignature(item) !== "" ||
          keys.some(key => !["bg", "fg", "bt", "br", "bb", "bl"].includes(key)) ||
          foreground !== colors.mapForeground(ink, colors.textTier(ink, background))) return false;
    }
    // The observer invalidates the whole snapshot before descendant mutations.
    // Retain only two proven neutral backgrounds, never a DOM subtree or an
    // unbounded color history. Unknown colors still check every leaf.
    if (!snapshot.inkProof) snapshot.inkProof = new Set();
    if (snapshot.inkProof.size < 2) snapshot.inkProof.add(proofKey);
    }
    if (nearViewport.get(node) === false && !scope.movingPaint &&
        (deferredPaint.size < MAX_DEFERRED_PAINT || deferredPaint.has(node)) && observePaint(node, true)) {
      deferredPaint.add(node);
      return true;
    }
    // Only the neutral container background changed; every descendant keeps
    // exactly its existing ink tier. No temporary subtree style switch.
    originalSurface.set(node, { color: background });
    const next = { ...found, bg: colors.mapBackground(background, mode) };
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
    if (!records.length) return;
    const seenAttributes = new Map();
    const backgroundScopes = new Map();
    const changedRoots = new Set();
    const removed = [];
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
      for (; node; node = parentAcrossShadow(node)) containerPaint.delete(node);
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
      if (record.type === "attributes") {
        let names = seenAttributes.get(target);
        if (!names) seenAttributes.set(target, names = new Set());
        if (names.has(record.attributeName)) continue;
        names.add(record.attributeName);
      }
      if (isPageSheet(target) || (record.type === "characterData" && isPageSheet(target.parentElement))) {
        polarityDirty = true;
        pendingTrees.add(document.documentElement);
      } else if (record.type === "childList") {
        removed.push(...record.removedNodes);
        const changedSheets = [...record.addedNodes, ...record.removedNodes].some(node => isPageSheet(node) || (node instanceof Element && [...node.querySelectorAll('style, link[rel~="stylesheet"]')].some(isPageSheet)));
        if (changedSheets) { polarityDirty = true; pendingTrees.add(document.documentElement); }
        for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) pendingTrees.add(node);
      } else if (record.attributeName === SHARED_BG) {
        pendingTrees.add(target);
      } else if (record.attributeName === "class" || STATE_ATTRIBUTES.includes(record.attributeName)) {
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
      ${root}:not([data-oled-night-page="none"]) * { scrollbar-color: rgb(58 58 66) transparent; }
      ${root}:not([data-oled-night-page="none"]) ::selection { background: rgb(38 79 140) !important; color: #fff !important; }
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
    `;
    (document.head || document.documentElement).appendChild(sheet);
  }

  function disable() {
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
    inlineStyles = new WeakMap();
    active = false;
    clearInterval(challengeTimer);
    challengeTimer = null;
    clearInterval(shadowHealthTimer);
    shadowHealthTimer = null;
    document.removeEventListener("visibilitychange", repairShadowSheets);
    document.removeEventListener("visibilitychange", scheduleShadowDiscovery);
    if (shadowDiscoveryFrame !== null) cancelAnimationFrame(shadowDiscoveryFrame);
    shadowDiscoveryFrame = null;
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
    simpleScopeFingerprint = null;
    compiledPaintScope = null;
    simpleScopeEpoch = 0;
    originalSurface = new WeakMap();
    mediaCopies = new WeakMap();
    textTiers = new WeakMap();
    removeEarly();
    const root = document.documentElement;
    for (const name of ["data-oled-night-root", "data-oled-night-youtube", "data-oled-night-page", "data-oled-night-transparent-frame", "data-oled-night-dim", "data-oled-night-invert", "data-oled-night-site"]) root.removeAttribute(name);
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
    darkPage = !colorsApi().usesNativeSafeMode(hostname()) && detectDarkPage();
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
      root.setAttribute("data-oled-night-invert", "");
      root.setAttribute("data-oled-night-page", "none");
      return;
    }
    const mode = modeFor();
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
    observer.observe(root, OBSERVE);
    document.addEventListener("visibilitychange", scheduleShadowDiscovery);
    document.addEventListener("load", onSheetLoad, true);
    document.addEventListener("loadeddata", onSheetLoad, true);
    for (const type of INTERACTION_EVENTS) document.addEventListener(type, onInteraction, true);
    process([root], []);
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
      active, siteMode: currentSiteMode(), mode: active ? modeFor() : "off", darkPage, pageColor,
      settings: { appearance: settings.appearance, ...Settings.tuningFor(settings, hostname()), schedule: settings.schedule },
      counts: { styled: document.querySelectorAll(`[${MARK}]`).length, shadowRoots: shadowRoots.size, deferredPaint: deferredPaint.size, observedPaint: observedPaint.size, paintContainers: paintContainers.size, frames: document.querySelectorAll("iframe").length },
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
      else if (active && observer) { polarityDirty = true; schedule(); }
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
      const mode = active ? modeFor() : "off";
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
