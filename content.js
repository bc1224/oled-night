(function () {
  "use strict";
  const chrome = globalThis.browser || globalThis.chrome;

  const VERSION = "0.6.12";
  const Settings = globalThis.OledNightSettings;
  const DEFAULTS = Settings.DEFAULTS;
  const MEDIA_SELECTOR = "img, picture, video, canvas, svg, iframe, object, embed, shreddit-player, shreddit-async-loader, shreddit-media-lightbox, zoomable-img";
  // Explicit color controls carry data, not decorative page colors.
  const COLOR_CONTROL = 'input[type="color"], [data-oled-night-preserve-colors], .react-colorful, .color-picker, .color-swatch, [role="slider"][aria-label*="hue" i], [role="slider"][aria-label*="saturation" i], [role="slider"][aria-label*="color" i]';

  const ICON_PARTS = "path, circle, rect, ellipse, polygon, polyline, line, text, use, g";
  const CHART_PARTS = `${ICON_PARTS}, stop`;
  const MARK = "data-oled-night";
  const MEASURE = "data-oled-night-measure";
  // Set while we swap overrides in and out, so site CSS transitions on colors
  // never animate between our dark value and the original light one.
  const NOANIM = "data-oled-night-noanim";
  const LOGO = "data-oled-night-logo";
  const LOGO_EDGE = "data-oled-night-logo-edge";
  // "Multiply"-style blends hide a photo's white background on a light page;
  // over black they turn the whole photo black (Amazon product images).
  const DARKENING_BLENDS = /^(multiply|darken|color-burn|plus-darker)$/;
  const PROPS = ["bg", "img", "shadow", "fg", "ink", "caret", "placeholder", "field", "bt", "br", "bb", "bl", "fill", "stroke", "stop", "blend",
    "before-bg", "before-img", "before-shadow", "after-bg", "after-img", "after-shadow"];
  const SIDES = [["Top", "bt"], ["Right", "br"], ["Bottom", "bb"], ["Left", "bl"]];
  // Frames that are players, maps, ads or challenges are left exactly as they are.
  const UNTOUCHED_FRAMES = /(youtube(-nocookie)?\.com|vimeo\.com|player\.|twitch\.tv|spotify\.com|soundcloud\.com|maps\.google|google\.[a-z.]+\/maps|doubleclick\.net|googlesyndication\.com|recaptcha|hcaptcha\.com|challenges\.cloudflare\.com)/i;
  const STATE_ATTRIBUTES = ["aria-selected", "aria-checked", "aria-expanded", "aria-disabled", "data-state", "data-highlighted", "selected", "disabled"];
  const OBSERVE = { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "href", "media", MARK, ...STATE_ATTRIBUTES] };
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
  let inlineStyles = new WeakMap();
  const pendingTrees = new Set();
  const pendingSelf = new Set();
  let flushScheduled = false;
  let flushHandle = null;
  let flushTimer = false;
  const INTERACTION_EVENTS = ["pointerover", "pointerout", "pointerdown", "pointerup", "pointercancel", "focusin", "focusout", "input", "change", "keydown", "keyup"];
  const CONTROL = 'a, button, input, textarea, select, option, label, li, [role="option"], [role^="menuitem"], [role="button"], [role="combobox"], [contenteditable="true"], [tabindex]';
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

  function preservesColor(element) {
    for (let node = element; node; node = parentAcrossShadow(node)) if (node.matches?.(COLOR_CONTROL)) return true;
    return false;
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

  // Read-only: decides overrides from original computed styles. No DOM writes
  // happen here, so the whole batch costs a single style recalculation.
  function decide(element, ctx) {
    const colors = colorsApi();
    const computed = ctx.style(element);
    const found = {};
    originalSurface.set(element, surfaceInfo(computed));
    if (ctx.mode === "none") return found;
    mapSurface(computed, "", ctx.mode, found);
    if (element.matches("input, textarea, select")) found.field = "1";
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
  // sampled (the browser forbids it). Explicit compact logo assets get a light
  // edge instead: it reveals dark lettering without changing brand colors.
  function checkLogo(img) {
    if (logoChecked.has(img) || logoBudget <= 0) return;
    const namedLogo = /(?:^|[\s_./#-])logo(?:[\s_./?#-]|$)/i.test(`${img.alt} ${img.currentSrc || img.src}`);
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
          if (light / solid < 0.2 && colorful / solid < 0.25) img.setAttribute(LOGO, "");
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

  function write(element, found) {
    inlineStyles.set(element, inlineSignature(element));
    const keys = Object.keys(found);
    const signature = keys.map((key) => `${key}=${found[key]}`).join(";");
    if ((applied.get(element) || "") === signature && overridesIntact(element, signature)) return;
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
        if (node.matches(COLOR_CONTROL)) return NodeFilter.FILTER_REJECT;
        if (!isMedia(node)) return NodeFilter.FILTER_ACCEPT;
        if (node.localName === "svg") icons.add(node);
        else if (node.localName === "img") list.images.add(node);
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
    flushHandle = null;
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

  // Batch mutations before the next paint. Idle callbacks run after painting,
  // allowing newly inserted white sections to flash for up to 250 ms.
  function schedule() {
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
    if (!observer) return;
    const path = event.composedPath().filter(node => node instanceof Element);
    const control = path.find(node => node.matches(CONTROL));
    if (control && control !== document.body && control !== document.documentElement) pendingTrees.add(control);
    for (const node of path) {
      if (node === document.body || node === document.documentElement) break;
      pendingSelf.add(node);
    }
    schedule();
  }

  function isPageSheet(node) {
    return node instanceof Element && node.matches('style, link[rel~="stylesheet"]') && !node.id.startsWith("oled-night-");
  }

  function onSheetLoad(event) {
    if (!observer || !isPageSheet(event.target)) return;
    polarityDirty = true;
    pendingTrees.add(document.documentElement);
    schedule();
  }

  function onMutations(records) {
    const seenAttributes = new Map();
    for (const record of records) {
      const target = record.target;
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
        const changedSheets = [...record.addedNodes, ...record.removedNodes].some(node => isPageSheet(node) || (node instanceof Element && [...node.querySelectorAll('style, link[rel~="stylesheet"]')].some(isPageSheet)));
        if (changedSheets) { polarityDirty = true; pendingTrees.add(document.documentElement); }
        for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) pendingTrees.add(node);
      } else if (record.attributeName === "class" || STATE_ATTRIBUTES.includes(record.attributeName)) {
        // Sites often switch their own theme with a class on <html>/<body>.
        if (target === document.documentElement || target === document.body) polarityDirty = true;
        // Class changes can restyle the whole subtree through descendant selectors.
        pendingTrees.add(target);
      } else if (!overridesIntact(target)) {
        // Frameworks can replace style/attributes without changing any page
        // color property. The cached decision is not proof it is still applied.
        pendingTrees.add(target);
      } else if (record.attributeName === "style") {
        const signature = inlineSignature(target);
        if (signature !== (inlineStyles.get(target) || "")) {
          inlineStyles.set(target, signature);
          // Custom properties and inherited ink can restyle descendants.
          pendingTrees.add(target);
        }

      }
    }
    if (pendingTrees.size || pendingSelf.size || polarityDirty) schedule();
  }

  function overrideRules() {
    // Use ID-level specificity without requiring an ID on page elements.
    // Multi-class + tag !important selection rules must not beat our colors.
    // The outer marker still scopes every override; measurement still opts out.
    const on = `:is([${MARK}], #oled-night-color-priority):not([${MEASURE}], [${MEASURE}] *)`;
    return `
      [${MARK}~="bg"]${on} { background-color: var(--oln-bg) !important; }
      [${MARK}~="img"]${on} { background-image: var(--oln-img) !important; }
      [${MARK}~="shadow"]${on} { box-shadow: var(--oln-shadow) !important; }
      [${MARK}~="fg"]${on} { color: var(--oln-fg) !important; }
      [${MARK}~="ink"]${on} { -webkit-text-fill-color: var(--oln-ink) !important; }
      [${MARK}~="caret"]${on} { caret-color: var(--oln-caret) !important; }
      [${MARK}~="placeholder"]${on}::placeholder { color: var(--oln-placeholder) !important; -webkit-text-fill-color: var(--oln-placeholder) !important; }
      [${MARK}~="field"]${on} { color-scheme: dark !important; }
      [${MARK}~="field"]${on}:is(:autofill, :-webkit-autofill) { -webkit-text-fill-color: var(--oln-fg, #ddd) !important; caret-color: var(--oln-fg, #ddd) !important; box-shadow: 0 0 0 1000px var(--oln-bg, #101014) inset !important; }
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
    if (Settings.prefersNativeColors(hostname())) return;
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
      ${root}[data-oled-night-site="amazon"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) :is(.a-expander-header .a-icon-section-expand, .a-expander-header .a-icon-section-collapse, .a-popover .a-icon-close) {
        filter: brightness(0) invert(1) !important;
      }
      ${root}[data-oled-night-site="amazon"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) .a-expander-header :is(.a-icon-extender-expand, .a-icon-extender-collapse) {
        border-color: currentColor !important;
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
      ${root}[data-oled-night-site="gmail"]:not([data-oled-night-page="none"]):not([data-oled-night-invert]) :is(.ajR, .ajV)[role="button"] img.ajT { filter: brightness(0) invert(1) !important; opacity: .85 !important; }
      ${root}[data-oled-night-site="gmail"] tr.zA.zE td, ${root}[data-oled-night-site="gmail"] tr.zA.zE td * { color: hsl(0 0% var(--oln-light, 88%)) !important; }
      ${root}[data-oled-night-site="gmail"] tr.zA.yO td, ${root}[data-oled-night-site="gmail"] tr.zA.yO td * { color: hsl(0 0% max(40%, calc(var(--oln-light, 88%) * 0.66))) !important; }
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
    document.removeEventListener("load", onSheetLoad, true);
    for (const type of INTERACTION_EVENTS) document.removeEventListener(type, onInteraction, true);
    if (flushHandle !== null) {
      if (flushTimer) clearTimeout(flushHandle); else cancelAnimationFrame(flushHandle);
    }
    flushHandle = null;
    flushScheduled = false;
    inlineStyles = new WeakMap();
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
      for (const node of scope.querySelectorAll(`[${MEASURE}], [${NOANIM}], [${LOGO}], [${LOGO_EDGE}]`)) { node.removeAttribute(MEASURE); node.removeAttribute(NOANIM); node.removeAttribute(LOGO); node.removeAttribute(LOGO_EDGE); }
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
    // A design editor's UI and canvas share color-bearing elements. Preserve
    // the entire document even for explicit recolor/invert overrides.
    if (Settings.prefersNativeColors(hostname())) { active = true; return; }
    const site = currentSiteMode();
    // Read the page's own background before any of our rules paint over it.
    darkPage = !colorsApi().usesNativeSafeMode(hostname()) && detectDarkPage();
    installSheet();
    active = true;
    const root = document.documentElement;
    root.setAttribute("data-oled-night-root", "");
    root.setAttribute("data-oled-night-version", VERSION);
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
    // YouTube watch pages hydrate incrementally. Never traverse or mutate their
    // custom elements and never replace their structural background tokens.
    if (colorsApi().usesNativeSafeMode(hostname())) {
      root.setAttribute("data-oled-night-youtube", "");
      return;
    }
    // Observer first so shadow roots found during the first pass get watched too.
    observer = new MutationObserver(onMutations);
    observer.observe(root, OBSERVE);
    document.addEventListener("load", onSheetLoad, true);
    for (const type of INTERACTION_EVENTS) document.addEventListener(type, onInteraction, true);
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
    if (active && structureKey(previous) === structureKey(settings)) { if (!Settings.prefersNativeColors(hostname())) applyTuning(); return; }
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
