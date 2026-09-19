(function () {
  "use strict";

  const VERSION = "0.6.4";
  const Settings = globalThis.OledNightSettings;
  const DEFAULTS = Settings.DEFAULTS;
  const MEDIA_SELECTOR = "img, picture, video, canvas, svg, iframe, object, embed, shreddit-player, shreddit-async-loader, shreddit-media-lightbox, zoomable-img";
  const ICON_PARTS = "path, circle, rect, ellipse, polygon, polyline, line, text, use, g";
  const CHART_PARTS = `${ICON_PARTS}, stop`;
  const MARK = "data-oled-night";
  const MEASURE = "data-oled-night-measure";
  // Set while we swap overrides in and out, so site CSS transitions on colors
  // never animate between our dark value and the original light one.
  const NOANIM = "data-oled-night-noanim";
  const LOGO = "data-oled-night-logo";
  // "Multiply"-style blends hide a photo's white background on a light page;
  // over black they turn the whole photo black (Amazon product images).
  const DARKENING_BLENDS = /^(multiply|darken|color-burn|plus-darker)$/;
  const PROPS = ["bg", "img", "shadow", "fg", "bt", "br", "bb", "bl", "fill", "stroke", "stop", "blend",
    "before-bg", "before-img", "before-shadow", "after-bg", "after-img", "after-shadow"];
  const SIDES = [["Top", "bt"], ["Right", "br"], ["Bottom", "bb"], ["Left", "bl"]];
  // Frames that are players, maps, ads or challenges are left exactly as they are.
  const UNTOUCHED_FRAMES = /(youtube(-nocookie)?\.com|vimeo\.com|player\.|twitch\.tv|spotify\.com|soundcloud\.com|maps\.google|google\.[a-z.]+\/maps|doubleclick\.net|googlesyndication\.com|recaptcha|hcaptcha\.com|challenges\.cloudflare\.com)/i;
  const OBSERVE = { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] };
  const isTopFrame = (() => { try { return typeof window === "undefined" || window.top === window; } catch { return false; } })();

  let observer = null;
  let active = false;
  let darkPage = false;
  let pageColor = { r: 255, g: 255, b: 255, a: 1 };
  let polarityDirty = false;
  let domReady = document.readyState !== "loading";
  let settings = DEFAULTS;
  let revision = 0;
  let applied = new WeakMap();
  let originalSurface = new WeakMap();
  let textTiers = new WeakMap();
  let logoChecked = new WeakSet();
  let logoBudget = 80;
  const hadInlineColor = new WeakSet();
  const pendingTrees = new Set();
  const pendingSelf = new Set();
  let flushScheduled = false;
  // Open shadow roots (web components) we style and watch. Page stylesheets
  // never reach inside them, so each gets our rules adopted directly.
  const shadowRoots = new Set();
  let shadowSheet = null;

  const colorsApi = () => globalThis.OledNightColors;

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
      if (UNTOUCHED_FRAMES.test(location.href)) return true;
      return innerWidth < 80 || innerHeight < 40;
    } catch { return true; }
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
    if (shadowRoots.has(root)) return;
    shadowRoots.add(root);
    try {
      if (!shadowSheet) { shadowSheet = new CSSStyleSheet(); shadowSheet.replaceSync(overrideRules()); }
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, shadowSheet];
    } catch {}
    observer?.observe(root, OBSERVE);
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
    }
    for (const node of chain) ctx.backdrop.set(node, result);
    return result;
  }

  function mapSurface(computed, prefix, mode, found) {
    const colors = colorsApi();
    const original = colors.parseColor(computed.backgroundColor);
    const alreadyBlack = original && mode !== "soft" && original.r <= 2 && original.g <= 2 && original.b <= 2;
    const background = alreadyBlack ? null : colors.mapBackground(original, mode);
    const gradient = colors.mapGradient(computed.backgroundImage, mode);
    const shadow = colors.mapShadow(computed.boxShadow, mode);
    if (background) found[`${prefix}bg`] = background;
    if (gradient) found[`${prefix}img`] = gradient;
    if (shadow) found[`${prefix}shadow`] = shadow;
  }

  // Read-only: decides overrides from original computed styles. No DOM writes
  // happen here, so the whole batch costs a single style recalculation.
  function decide(element, ctx) {
    const colors = colorsApi();
    const computed = ctx.style(element);
    const found = {};
    originalSurface.set(element, surfaceInfo(computed));
    if (ctx.mode === "none") return found;
    mapSurface(computed, "", ctx.mode, found);
    if (ctx.mode === "crush") return found;
    if (DARKENING_BLENDS.test(computed.mixBlendMode)) found.blend = "normal";
    for (const [side, key] of SIDES) {
      if (computed[`border${side}Width`] === "0px" || computed[`border${side}Style`] === "none") continue;
      const border = colors.mapBorder(colors.parseColor(computed[`border${side}Color`]));
      if (border) found[key] = border;
    }
    for (const pseudo of ["before", "after"]) {
      const pseudoStyle = getComputedStyle(element, `::${pseudo}`);
      if (pseudoStyle.content && pseudoStyle.content !== "none" && pseudoStyle.content !== "normal") mapSurface(pseudoStyle, `${pseudo}-`, ctx.mode, found);
    }
    // Text over real imagery keeps its own color; everything else is
    // lightened, keeping its original primary/secondary/muted emphasis.
    const text = colors.parseColor(computed.color);
    if (text && text.a >= 0.08) {
      const backdrop = backdropOf(element, ctx);
      if (!backdrop.image) {
        let tier = colors.textTier(text, backdrop.color);
        // Light text on a light original surface is text that inherited our
        // already-lightened color (e.g. a newly streamed chat line): keep the
        // parent's emphasis instead of treating it as faint.
        if (colors.luminance(text) > 0.5 && colors.luminance(backdrop.color) > 0.5) tier = textTiers.get(parentAcrossShadow(element)) ?? 1;
        textTiers.set(element, tier);
        found.fg = colors.mapForeground(text, tier);
      }
    }
    return found;
  }

  // Small inline SVG icons with a hard-coded dark fill/stroke would vanish on
  // black. Larger SVGs are charts/illustrations: their near-white area fills
  // and gradient stops (App Store Connect sparklines) are darkened instead,
  // while colored lines and bars keep their color.
  function decideSvg(svg, ctx, out) {
    if (ctx.mode !== "oled" && ctx.mode !== "soft") return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const colors = colorsApi();
    const icon = rect.width <= 64 && rect.height <= 64;
    const paleToDark = (color) => (color && color.a >= 0.08 && colors.luminance(color) > 0.6 && colors.chroma(color) < 0.25
      ? colors.mapBackground(color, ctx.mode) : null);
    for (const part of [svg, ...svg.querySelectorAll(icon ? ICON_PARTS : CHART_PARTS)]) {
      const computed = getComputedStyle(part);
      const found = {};
      if (icon) {
        const fill = colors.mapIconPaint(colors.parseColor(computed.fill));
        const stroke = colors.mapIconPaint(colors.parseColor(computed.stroke));
        if (fill) found.fill = fill;
        if (stroke) found.stroke = stroke;
      } else if (part.localName === "stop") {
        const stop = paleToDark(colors.parseColor(computed.stopColor));
        if (stop) found.stop = stop;
      } else {
        const fill = paleToDark(colors.parseColor(computed.fill));
        if (fill) found.fill = fill;
      }
      out.push([part, found]);
    }
  }

  // Dark, mostly transparent images (logos and wordmarks like Wikipedia's)
  // disappear on black. Sample a thumbnail of the pixels; if the visible part
  // is dark and colorless, flip its lightness. Cross-origin images can't be
  // sampled (the browser forbids it) and are left alone.
  function checkLogo(img) {
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
        if (clear / total > 0.3 && solid / total > 0.02 && light / solid < 0.2 && colorful / solid < 0.25) img.setAttribute(LOGO, "");
      } catch {}
    };
    if (img.complete) run(); else img.addEventListener("load", run, { once: true });
  }

  function write(element, found) {
    const keys = Object.keys(found);
    const signature = keys.map((key) => `${key}=${found[key]}`).join(";");
    if ((applied.get(element) || "") === signature) return;
    for (const key of PROPS) if (!(key in found)) element.style.removeProperty(`--oln-${key}`);
    for (const key of keys) element.style.setProperty(`--oln-${key}`, found[key]);
    if (keys.length) element.setAttribute(MARK, keys.join(" ")); else element.removeAttribute(MARK);
    applied.set(element, signature);
  }

  function visit(element, list, seen) {
    if (seen.has(element)) return;
    seen.add(element);
    list.push(element);
    if (element.shadowRoot) {
      adoptShadowRoot(element.shadowRoot);
      walkChildren(element.shadowRoot, list, seen, list.icons);
    }
  }

  function walkChildren(root, list, seen, icons) {
    list.images ||= new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        if (!isMedia(node)) return NodeFilter.FILTER_ACCEPT;
        if (node.localName === "svg") icons.add(node);
        else if (node.localName === "img") list.images.add(node);
        return NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) visit(walker.currentNode, list, seen);
  }

  function collect(root, list, seen) {
    if (!(root instanceof Element) || !root.isConnected || seen.has(root)) return;
    if (root.localName === "svg") { list.icons.add(root); return; }
    if (root.localName === "img") { list.images.add(root); return; }
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

  function modeFor() {
    const appearance = resolvedAppearance(settings);
    const site = currentSiteMode();
    if (site === "recolor") return appearance;
    if (site === "deepen") return "crush";
    if (!darkPage) return appearance;
    return appearance === "oled" ? "crush" : "none";
  }

  function process(trees, selves) {
    const list = [];
    list.icons = new Set();
    list.images = new Set();
    const seen = new Set();
    for (const node of trees) collect(node, list, seen);
    for (const node of selves) {
      if (!seen.has(node) && node.isConnected && !isMedia(node) && !node.closest(MEDIA_SELECTOR)) { seen.add(node); list.push(node); }
    }
    if (!list.length && !list.icons.size && !list.images.size) return;
    // Already-styled elements hide their original colors behind our overrides.
    // Switch overrides off inside just the affected subtrees for the read phase
    // (no paint happens in between, so nothing flickers).
    const measured = [...trees, ...selves].filter((node) => node instanceof Element && node.isConnected
      && (node.hasAttribute(MARK) || node.querySelector(`[${MARK}]`)));
    // "[measure] *" cannot see into shadow trees, so switch those off at their top level too.
    if (measured.length) for (const element of list) if (element.parentNode?.host && element.hasAttribute(MARK)) measured.push(element);
    for (const icon of list.icons) if (icon.hasAttribute(MARK) || icon.querySelector(`[${MARK}]`)) measured.push(icon);
    const calm = [...trees, ...selves, ...list.icons].filter((node) => node instanceof Element && node.isConnected);
    for (const element of list) if (element.parentNode?.host) calm.push(element);
    for (const node of calm) node.setAttribute(NOANIM, "");
    for (const node of measured) node.setAttribute(MEASURE, "");
    const styles = new Map();
    const ctx = {
      mode: modeFor(),
      pageColor,
      backdrop: new Map(),
      style(node) {
        let computed = styles.get(node);
        if (!computed) { computed = getComputedStyle(node); styles.set(node, computed); }
        return computed;
      }
    };
    const decisions = list.map((element) => decide(element, ctx));
    const iconDecisions = [];
    for (const icon of list.icons) if (icon.isConnected) decideSvg(icon, ctx, iconDecisions);
    const recolor = ctx.mode === "oled" || ctx.mode === "soft";
    const imageDecisions = [];
    const logoCandidates = [];
    if (recolor) {
      for (const img of list.images) {
        if (!img.isConnected) continue;
        imageDecisions.push([img, DARKENING_BLENDS.test(ctx.style(img).mixBlendMode) ? { blend: "normal" } : {}]);
        const rect = img.getBoundingClientRect();
        if (rect.width >= 12 && rect.height >= 12 && rect.width <= 420 && rect.height <= 160) logoCandidates.push(img);
      }
    }
    for (const node of measured) node.removeAttribute(MEASURE);
    list.forEach((element, index) => write(element, decisions[index]));
    for (const [part, found] of iconDecisions) write(part, found);
    for (const [img, found] of imageDecisions) write(img, found);
    for (const img of logoCandidates) checkLogo(img);
    // Commit the new colors with transitions still off, then restore them.
    if (calm.length) getComputedStyle(calm[0]).color;
    for (const node of calm) node.removeAttribute(NOANIM);
  }

  function flush() {
    flushScheduled = false;
    if (!observer) { pendingTrees.clear(); pendingSelf.clear(); return; }
    if (polarityDirty) {
      polarityDirty = false;
      document.documentElement.setAttribute(MEASURE, "");
      const nowDark = detectDarkPage();
      document.documentElement.removeAttribute(MEASURE);
      if (nowDark !== darkPage && !["recolor", "deepen"].includes(currentSiteMode())) { enable(); return; }
    }
    const trees = [...pendingTrees];
    const selves = [...pendingSelf];
    pendingTrees.clear();
    pendingSelf.clear();
    process(trees, selves);
    observer.takeRecords();
  }

  // Busy apps (Gmail, streaming chat) mutate constantly; coalesce into one pass
  // when the page is idle, but never later than 250 ms.
  function schedule() {
    if (flushScheduled) return;
    flushScheduled = true;
    if (document.readyState === "loading") setTimeout(flush, 16);
    else if (globalThis.requestIdleCallback) requestIdleCallback(flush, { timeout: 250 });
    else setTimeout(flush, 100);
  }

  function hasInlineColor(element) {
    const style = element.style;
    return !!style && !!(style.background || style.backgroundColor || style.backgroundImage || style.color || style.boxShadow || style.borderColor || style.fill || style.stroke);
  }

  function onMutations(records) {
    for (const record of records) {
      const target = record.target;
      if (record.type === "childList") {
        for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) pendingTrees.add(node);
      } else if (record.attributeName === "class") {
        // Sites often switch their own theme with a class on <html>/<body>.
        if (target === document.documentElement || target === document.body) polarityDirty = true;
        // Class changes can restyle the whole subtree through descendant selectors.
        pendingTrees.add(target);
      } else if (hasInlineColor(target)) {
        // Inline style churn is mostly transforms/opacity from animations and
        // virtual scrollers. Only colors matter, so skip everything else.
        hadInlineColor.add(target); pendingSelf.add(target);
      } else if (hadInlineColor.has(target)) {
        hadInlineColor.delete(target); pendingSelf.add(target);
      }
    }
    if (pendingTrees.size || pendingSelf.size || polarityDirty) schedule();
  }

  function overrideRules() {
    const on = `:not([${MEASURE}], [${MEASURE}] *)`;
    return `
      [${MARK}~="bg"]${on} { background-color: var(--oln-bg) !important; }
      [${MARK}~="img"]${on} { background-image: var(--oln-img) !important; }
      [${MARK}~="shadow"]${on} { box-shadow: var(--oln-shadow) !important; }
      [${MARK}~="fg"]${on} { color: var(--oln-fg) !important; }
      [${MARK}~="bt"]${on} { border-top-color: var(--oln-bt) !important; }
      [${MARK}~="br"]${on} { border-right-color: var(--oln-br) !important; }
      [${MARK}~="bb"]${on} { border-bottom-color: var(--oln-bb) !important; }
      [${MARK}~="bl"]${on} { border-left-color: var(--oln-bl) !important; }
      [${MARK}~="fill"]${on} { fill: var(--oln-fill) !important; }
      [${MARK}~="stroke"]${on} { stroke: var(--oln-stroke) !important; }
      [${MARK}~="stop"]${on} { stop-color: var(--oln-stop) !important; }
      [${MARK}~="blend"]${on} { mix-blend-mode: normal !important; }
      [${NOANIM}], [${NOANIM}] *, [${NOANIM}]::before, [${NOANIM}]::after, [${NOANIM}] *::before, [${NOANIM}] *::after { transition: none !important; }
      [${MARK}~="before-bg"]${on}::before { background-color: var(--oln-before-bg) !important; }
      [${MARK}~="before-img"]${on}::before { background-image: var(--oln-before-img) !important; }
      [${MARK}~="before-shadow"]${on}::before { box-shadow: var(--oln-before-shadow) !important; }
      [${MARK}~="after-bg"]${on}::after { background-color: var(--oln-after-bg) !important; }
      [${MARK}~="after-img"]${on}::after { background-image: var(--oln-after-img) !important; }
      [${MARK}~="after-shadow"]${on}::after { box-shadow: var(--oln-after-shadow) !important; }
      input[${MARK}~="bg"], textarea[${MARK}~="bg"], select[${MARK}~="bg"], button[${MARK}~="bg"] { color-scheme: dark !important; accent-color: #66a3ff; }
    `;
  }

  // Painted before the page has any content, so a white page never flashes.
  function installEarly() {
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
    const root = `html[data-oled-night-root]:not([${MEASURE}])`;
    const sheet = document.createElement("style");
    sheet.id = "oled-night-sheet";
    sheet.textContent = `
      ${root}:not([data-oled-night-page="none"]), ${root}:not([data-oled-night-page="none"]) body { color-scheme: dark !important; background: var(--oled-night-page, #000) !important; }
      ${overrideRules()}
      html[data-oled-night-root] :focus-visible { outline-color: #66a3ff !important; }
      ${root}:not([data-oled-night-page="none"]) * { scrollbar-color: rgb(58 58 66) transparent; }
      ${root}:not([data-oled-night-page="none"]) ::selection { background: rgb(38 79 140) !important; color: #fff !important; }
      html[data-oled-night-root][data-oled-night-dim]:not([data-oled-night-invert]) :is(img, video) { filter: brightness(0.78) !important; }
      html[data-oled-night-invert] { filter: invert(1) hue-rotate(180deg) !important; background: #fff !important; }
      html[data-oled-night-root]:not([data-oled-night-invert]) img[${LOGO}] { filter: invert(1) hue-rotate(180deg) !important; }
      /* Gmail: on black, unread (tr.zE) and read (tr.yO) rows only differ by
         font weight. Mark unread with an accent bar and full-brightness text,
         and step read rows down to the muted text level. */
      html[data-oled-night-root][data-oled-night-site="gmail"] tr.zA.zE { box-shadow: inset 3px 0 0 #8ab4f8 !important; }
      html[data-oled-night-root][data-oled-night-site="gmail"] tr.zA.zE td, html[data-oled-night-root][data-oled-night-site="gmail"] tr.zA.zE td * { color: hsl(0 0% var(--oln-light, 88%)) !important; }
      html[data-oled-night-root][data-oled-night-site="gmail"] tr.zA.yO td, html[data-oled-night-root][data-oled-night-site="gmail"] tr.zA.yO td * { color: hsl(0 0% max(40%, calc(var(--oln-light, 88%) * 0.66))) !important; }
      html[data-oled-night-invert] :is(img, video, iframe, embed, object) { filter: invert(1) hue-rotate(180deg) !important; }
      html[data-oled-night-root][data-oled-night-youtube] body,
      html[data-oled-night-root][data-oled-night-youtube] ytd-app,
      html[data-oled-night-root][data-oled-night-youtube] #content,
      html[data-oled-night-root][data-oled-night-youtube] ytd-page-manager { background-color: #000 !important; }
      html[data-oled-night-root][data-oled-night-youtube] ytd-app {
        --yt-spec-text-primary: var(--oled-night-youtube-primary) !important;
        --yt-spec-text-secondary: var(--oled-night-youtube-secondary) !important;
      }
    `;
    (document.head || document.documentElement).appendChild(sheet);
  }

  function disable() {
    active = false;
    observer?.disconnect();
    observer = null;
    pendingTrees.clear();
    pendingSelf.clear();
    applied = new WeakMap();
    originalSurface = new WeakMap();
    textTiers = new WeakMap();
    removeEarly();
    const root = document.documentElement;
    for (const name of ["data-oled-night-root", "data-oled-night-youtube", "data-oled-night-page", "data-oled-night-dim", "data-oled-night-invert", "data-oled-night-site"]) root.removeAttribute(name);
    for (const name of ["--oled-night-page", "--oled-night-youtube-primary", "--oled-night-youtube-secondary", "--oln-light", "--oln-strength"]) root.style.removeProperty(name);
    document.getElementById("oled-night-sheet")?.remove();
    logoChecked = new WeakSet();
    logoBudget = 80;
    for (const scope of [document, ...shadowRoots]) {
      for (const node of scope.querySelectorAll(`[${MEASURE}], [${NOANIM}], [${LOGO}]`)) { node.removeAttribute(MEASURE); node.removeAttribute(NOANIM); node.removeAttribute(LOGO); }
      for (const element of scope.querySelectorAll(`[${MARK}]`)) {
        element.removeAttribute(MARK);
        for (const key of PROPS) element.style.removeProperty(`--oln-${key}`);
      }
      if (scope !== document && shadowSheet) {
        try { scope.adoptedStyleSheets = scope.adoptedStyleSheets.filter((sheet) => sheet !== shadowSheet); } catch {}
      }
    }
    shadowRoots.clear();
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
    const site = currentSiteMode();
    // Read the page's own background before any of our rules paint over it.
    darkPage = !colorsApi().usesNativeSafeMode(hostname()) && detectDarkPage();
    installSheet();
    active = true;
    const root = document.documentElement;
    root.setAttribute("data-oled-night-root", "");
    root.setAttribute("data-oled-night-version", VERSION);
    const profile = colorsApi().siteProfile(hostname());
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
    // YouTube watch pages hydrate incrementally. Never traverse or mutate their
    // custom elements and never replace their structural background tokens.
    if (colorsApi().usesNativeSafeMode(hostname())) {
      root.setAttribute("data-oled-night-youtube", "");
      return;
    }
    // Observer first so shadow roots found during the first pass get watched too.
    observer = new MutationObserver(onMutations);
    observer.observe(root, OBSERVE);
    process([root], []);
    observer.takeRecords();
  }

  let scheduleTimer = null;
  const structureKey = (config) => `${resolvedAppearance(config)}|${Settings.siteMode(config, hostname())}`;

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
    // Slider moves, per-site tuning and image dimming only retune variables; no page re-scan.
    if (active && structureKey(previous) === structureKey(settings)) { applyTuning(); return; }
    enable();
  }

  // Diagnostic snapshot for "Report a broken site": what the extension decided
  // and which visible text still reads poorly. Only short text labels are kept.
  function report() {
    const colors = colorsApi();
    const lowContrast = [];
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
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const rect = el.getBoundingClientRect();
        if (!rect.width || rect.bottom < 0 || rect.top > innerHeight) continue;
        const style = getComputedStyle(el);
        const fg = colors.parseColor(style.color), bg = shownBg(el);
        if (!fg) continue;
        const a = colors.luminance(fg), b = colors.luminance(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < 3) {
          lowContrast.push({ element: describe(el), inShadow: !!el.getRootNode().host, text: el.textContent.trim().slice(0, 30),
            color: style.color, background: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, ratio: +ratio.toFixed(2), mark: el.getAttribute(MARK) });
        }
      }
    };
    if (active) scan(document);
    return {
      extension: "OLED Night", version: VERSION, host: hostname(), when: new Date().toISOString(), userAgent: navigator.userAgent,
      active, siteMode: currentSiteMode(), mode: active ? modeFor() : "off", darkPage, pageColor,
      settings: { appearance: settings.appearance, ...Settings.tuningFor(settings, hostname()), schedule: settings.schedule },
      counts: { styled: document.querySelectorAll(`[${MARK}]`).length, shadowRoots: shadowRoots.size, frames: document.querySelectorAll("iframe").length },
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
      lowContrast
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
      if (isEnabled(settings) && revision > 0) enable();
    };
    const bodyWatch = new MutationObserver(() => { if (document.body) start(); });
    bodyWatch.observe(document.documentElement, { childList: true });
    if (document.body) start();
    document.addEventListener("DOMContentLoaded", () => {
      start();
      if (active) { polarityDirty = true; schedule(); }
    }, { once: true });
    addEventListener("load", () => { if (active) { polarityDirty = true; schedule(); } }, { once: true });
  }
  chrome.storage.sync.get(DEFAULTS, applySettings);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    chrome.storage.sync.get(DEFAULTS, applySettings);
  });
  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applySettings(settings));
  } catch {}
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "oled-night-status") {
      if (!isTopFrame) return;
      sendResponse({ active, darkPage, mode: active ? modeFor() : "off", version: VERSION });
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
