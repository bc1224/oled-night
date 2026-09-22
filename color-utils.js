(function (scope) {
  "use strict";

  // Chrome reports computed colors as rgb()/rgba(), but sites using modern
  // color spaces (oklch, color-mix, display-p3...) come back as color(srgb ...),
  // oklch(), oklab(), lab() or lch(). All of them must be understood.
  const COLOR_TOKEN = /(?:rgba?|color|oklch|oklab|lch|lab)\([^()]*\)/gi;
  const COLOR_FN = /^\s*(rgba?|color|oklch|oklab|lch|lab)\(([^()]*)\)\s*$/i;

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const encode = (linear) => {
    const v = clamp01(linear);
    return v <= 0.0031308 ? 12.92 * v : (1.055 * (v ** (1 / 2.4))) - 0.055;
  };
  const decode = (channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

  function num(token, percentScale = 1) {
    if (token === undefined || token === "none") return 0;
    const value = parseFloat(token);
    if (Number.isNaN(value)) return 0;
    return token.endsWith("%") ? (value / 100) * percentScale : value;
  }

  function fromLinear(r, g, b, a) {
    return { r: Math.round(encode(r) * 255), g: Math.round(encode(g) * 255), b: Math.round(encode(b) * 255), a };
  }

  function oklabToRgb(L, A, B, alpha) {
    const l = (L + (0.3963377774 * A) + (0.2158037573 * B)) ** 3;
    const m = (L - (0.1055613458 * A) - (0.0638541728 * B)) ** 3;
    const s = (L - (0.0894841775 * A) - (1.2914855480 * B)) ** 3;
    return fromLinear(
      (4.0767416621 * l) - (3.3077115913 * m) + (0.2309699292 * s),
      (-1.2684380046 * l) + (2.6097574011 * m) - (0.3413193965 * s),
      (-0.0041960863 * l) - (0.7034186147 * m) + (1.7076147010 * s),
      alpha
    );
  }

  function labToRgb(L, A, B, alpha) {
    const fy = (L + 16) / 116, fx = fy + (A / 500), fz = fy - (B / 200);
    const inv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : ((116 * t) - 16) / (24389 / 27));
    const x = 0.96422 * inv(fx), y = L > 8 ? inv(fy) : L / (24389 / 27), z = 0.82521 * inv(fz);
    return fromLinear(
      (3.1341359569958707 * x) - (1.6173863321612538 * y) - (0.4906619460083532 * z),
      (-0.978795502912089 * x) + (1.916254567259524 * y) + (0.03344273116131949 * z),
      (0.07195537988411677 * x) - (0.2289768264158322 * y) + (1.405386058324125 * z),
      alpha
    );
  }

  // Color values repeat across hundreds of rows. Cache pure conversions, not
  // DOM state, so hover, late stylesheets and field resets still get re-read.
  // Bound caches to avoid growth on animations with continuously changing colors.
  const parsedColors = new Map();
  function parseColor(value) {
    const key = String(value || "");
    if (parsedColors.has(key)) return parsedColors.get(key);
    const color = parseColorUncached(key);
    if (parsedColors.size >= 512) parsedColors.clear();
    parsedColors.set(key, color && Object.freeze(color));
    return color;
  }

  function parseColorUncached(value) {
    const match = String(value || "").match(COLOR_FN);
    if (!match) return null;
    const fn = match[1].toLowerCase();
    const [body, alphaPart] = match[2].split("/");
    const parts = body.trim().split(/[\s,]+/).filter(Boolean);
    let alphaToken = alphaPart?.trim();
    if (!alphaToken && (fn === "rgba" || (fn === "rgb" && parts.length === 4))) alphaToken = parts[3];
    const a = alphaToken === undefined ? 1 : clamp01(num(alphaToken, 1));
    if (fn === "rgb" || fn === "rgba") {
      if (parts.length < 3) return null;
      return { r: num(parts[0], 255), g: num(parts[1], 255), b: num(parts[2], 255), a };
    }
    if (fn === "color") {
      const space = (parts.shift() || "").toLowerCase();
      const [r, g, b] = parts.map((part) => num(part, 1));
      if (space === "srgb-linear") return fromLinear(r, g, b, a);
      // display-p3, rec2020, etc. are treated as sRGB: close enough to judge lightness.
      return { r: Math.round(clamp01(r) * 255), g: Math.round(clamp01(g) * 255), b: Math.round(clamp01(b) * 255), a };
    }
    if (fn === "oklab") return oklabToRgb(num(parts[0], 1), num(parts[1], 0.4), num(parts[2], 0.4), a);
    if (fn === "oklch") {
      const h = (num(parts[2]) * Math.PI) / 180, c = num(parts[1], 0.4);
      return oklabToRgb(num(parts[0], 1), c * Math.cos(h), c * Math.sin(h), a);
    }
    if (fn === "lab") return labToRgb(num(parts[0], 100), num(parts[1], 125), num(parts[2], 125), a);
    if (fn === "lch") {
      const h = (num(parts[2]) * Math.PI) / 180, c = num(parts[1], 150);
      return labToRgb(num(parts[0], 100), c * Math.cos(h), c * Math.sin(h), a);
    }
    return null;
  }

  const lightnessCache = new WeakMap();
  function luminance(color) {
    if (Object.isFrozen(color) && lightnessCache.has(color)) return lightnessCache.get(color);
    const value = computeLuminance(color);
    if (Object.isFrozen(color)) lightnessCache.set(color, value);
    return value;
  }

  function computeLuminance({ r, g, b }) {
    const linear = [r, g, b].map((value) => {
      return decode(value / 255);
    });
    return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
  }

  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d) + (g < b ? 6 : 0);
      else if (max === g) h = ((b - r) / d) + 2;
      else h = ((r - g) / d) + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  // Keep the source alpha so fades, scrims, and frosted surfaces stay translucent.
  function withAlpha(color, alpha) {
    if (alpha >= 1) return color;
    const a = Math.round(alpha * 1000) / 1000;
    if (color === "#000000") return `rgb(0 0 0 / ${a})`;
    return color.replace(/\)$/, ` / ${a})`);
  }

  // Mapped colors reference two page-level custom properties instead of baked
  // numbers, so the Brightness and Contrast sliders only have to update those:
  //   --oln-light     text lightness (40%..100%)
  //   --oln-strength  surface contrast (0..1)
  const STRENGTH = "var(--oln-strength, 0.72)";
  const LIGHT = "var(--oln-light, 88%)";
  const level = (base, span) => `calc(${base} + ${span} * ${STRENGTH})`;
  const grey = (base, span, blueShift) => `rgb(${level(base, span)} ${level(base, span)} ${level(base + blueShift, span)})`;

  // How colorful a color looks (0 = grey). Unlike HSL saturation, pale tints
  // such as #e8f0fe score low, so they don't turn into loud dark blocks.
  function chroma({ r, g, b }) {
    return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  }

  // Modes: "oled" / "soft" recolor a light page; "crush" only pushes the dark
  // greys of an already-dark page to true black; "none" changes nothing.
  function mapBackground(color, mode) {
    if (!color || color.a < 0.08 || mode === "none") return null;
    const hsl = rgbToHsl(color);
    const lum = luminance(color);
    const c = chroma(color);
    // Only the darkest surfaces (page and deep panels, including navy-tinted
    // ones) go to true black, so lighter cards keep their outline.
    if (mode === "crush") return c < 0.1 && lum < 0.02 ? withAlpha("#000000", color.a) : null;
    if (c > 0.12 && lum > 0.08) {
      return withAlpha(`hsl(${Math.round(hsl.h)} ${Math.round(Math.min(hsl.s, 0.82) * 100)}% calc(16% + 10% * ${STRENGTH}))`, color.a);
    }
    // Pale tints (info/alert/selected rows) keep a hint of their hue.
    if (c > 0.03 && lum > 0.3) {
      return withAlpha(`hsl(${Math.round(hsl.h)} 35% calc(6% + 5% * ${STRENGTH}))`, color.a);
    }
    if (mode === "soft") {
      if (lum > 0.82) return withAlpha("rgb(16 16 20)", color.a);
      if (lum > 0.24) return withAlpha(grey(22, 6, 4), color.a);
      return withAlpha("rgb(13 13 17)", color.a);
    }
    if (lum > 0.93 || lum < 0.025) return withAlpha("#000000", color.a);
    return withAlpha(lum > 0.62 ? grey(4, 6, 3) : grey(7, 11, 3), color.a);
  }

  // Text keeps its original emphasis: how strongly it contrasted with the
  // surface it sat on decides primary (1), secondary (0.82) or muted (0.66).
  function textTier(text, backdrop) {
    if (!text) return 1;
    const base = backdrop || { r: 255, g: 255, b: 255 };
    const a = text.a ?? 1;
    const seen = { r: (text.r * a) + (base.r * (1 - a)), g: (text.g * a) + (base.g * (1 - a)), b: (text.b * a) + (base.b * (1 - a)) };
    const x = luminance(seen), y = luminance(base);
    const ratio = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    // Light text on a colored/dark surface (button labels, badges) is primary.
    if (x > y && ratio >= 3) return 1;
    return ratio >= 9 ? 1 : ratio >= 4.5 ? 0.82 : 0.66;
  }

  function mapForeground(color, tier = 1) {
    if (!color || color.a < 0.08) return null;
    const hsl = rgbToHsl(color);
    const colored = chroma(color) > 0.15;
    const saturation = colored ? Math.round(Math.min(hsl.s, 0.72) * 100) : 0;
    // Colored text (links, prices, errors) sits a little below neutral text.
    const factor = colored ? 0.86 : tier;
    const lightness = factor === 1 ? LIGHT : `max(40%, calc(${LIGHT} * ${factor}))`;
    return `hsl(${Math.round(hsl.h)} ${saturation}% ${lightness})`;
  }

  // Neutral borders become faint white; colored ones (active tab, focus,
  // error) keep their hue so the state they signal stays visible.
  function mapBorder(color) {
    if (!color || color.a < 0.08) return null;
    if (chroma(color) > 0.15) {
      const hsl = rgbToHsl(color);
      return `hsl(${Math.round(hsl.h)} ${Math.round(Math.min(hsl.s, 0.8) * 100)}% 55%)`;
    }
    return `rgb(255 255 255 / calc(12% + 18% * ${STRENGTH}))`;
  }

  // Dark monochrome icon strokes/fills become text-colored; colored icons stay.
  function mapIconPaint(color) {
    if (!color || color.a < 0.08 || chroma(color) > 0.15 || luminance(color) > 0.25) return null;
    return mapForeground(color, 1);
  }

  // Rewrites the colors inside a computed gradient. Returns null for url() images
  // (real imagery is never touched) or when nothing changed.
  function mapGradient(value, mode) {
    const text = String(value || "");
    if (!/gradient\(/i.test(text) || /url\(/i.test(text)) return null;
    let changed = false;
    const out = text.replace(COLOR_TOKEN, (token) => {
      const mapped = mapBackground(parseColor(token), mode);
      if (!mapped) return token;
      changed = true;
      return mapped;
    });
    return changed ? out : null;
  }

  // Light shadows/glows (e.g. white fades above chat composers) become dark.
  function mapShadow(value, mode) {
    const text = String(value || "");
    if (!text || text === "none" || mode === "crush" || mode === "none") return null;
    let changed = false;
    const out = text.replace(COLOR_TOKEN, (token) => {
      const color = parseColor(token);
      if (!color || color.a < 0.08 || luminance(color) < 0.35) return token;
      changed = true;
      return mapBackground(color, mode);
    });
    return changed ? out : null;
  }

  // Worst case (lightest) opaque-ish color in a gradient, used as a text backdrop.
  function gradientBackdrop(value) {
    let lightest = null;
    for (const token of String(value || "").match(COLOR_TOKEN) || []) {
      const color = parseColor(token);
      if (color && color.a >= 0.5 && (!lightest || luminance(color) > luminance(lightest))) lightest = color;
    }
    return lightest;
  }

  function isProtectedMediaTag(tagName) {
    const tag = String(tagName || "").toLowerCase();
    return ["img", "picture", "video", "canvas", "svg", "iframe", "object", "embed", "shreddit-player", "shreddit-async-loader", "shreddit-media-lightbox", "zoomable-img"].includes(tag)
      || (tag.includes("-") && /(?:player|media|video|image|picture|gallery|carousel|lightbox|embed|canvas)/.test(tag));
  }

  function usesNativeSafeMode(hostname) {
    return /(^|\.)youtube\.com$/i.test(String(hostname || ""));
  }

  // Sites with a small hand-tuned profile on top of the generic recoloring.
  function siteProfile(hostname) {
    const host = String(hostname || "").toLowerCase();
    if (host === "mail.google.com") return "gmail";
    if (/^(idmsa|appleid|appstoreconnect)\.apple\.com$/.test(host)) return "apple-auth";
    if (/(^|\.)reddit\.com$/.test(host)) return "reddit";
    return "";
  }

  scope.OledNightColors = { siteProfile, parseColor, luminance, chroma, textTier, mapIconPaint, mapBackground, mapForeground, mapBorder, mapGradient, mapShadow, gradientBackdrop, isProtectedMediaTag, usesNativeSafeMode };
})(globalThis);
