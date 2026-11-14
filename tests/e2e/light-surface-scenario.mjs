// Runs unchanged in Chrome's page context and Firefox's executeScript seam.
// The oracle is the painted result, not the extension's attributes: each
// target's ink against every opaque color of the first surface that paints
// behind it, walking up through covering generated layers and, from a frame's
// root, into the iframe element and its ancestors in the embedding page.
// Targets are "elementId" or "frameId/elementId".
export function lightSurfaceProbe(targets) {
  const channels = value => (String(value).match(/[\d.]+/g) || []).map(Number);
  const lum = value => {
    const [r, g, b] = channels(value).slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  const opaque = value => { const parts = channels(value); return /^rgba?\(/.test(value) && (parts.length < 4 || parts[3] >= .5); };
  // Every opaque color this box paints: gradient stops and its own color.
  const paints = style => {
    const image = style.backgroundImage && style.backgroundImage !== "none" && !/url\(/.test(style.backgroundImage)
      ? (style.backgroundImage.match(/rgba?\([^)]*\)/g) || []).filter(opaque) : [];
    return opaque(style.backgroundColor) ? [...image, style.backgroundColor] : image;
  };
  const faces = (node, view) => ["::before", "::after"].flatMap(pseudo => {
    const style = view.getComputedStyle(node, pseudo);
    if (!style.content || style.content === "none" || style.content === "normal" || style.position !== "absolute") return [];
    const own = view.getComputedStyle(node);
    return parseFloat(style.width) >= parseFloat(own.width) * .7 && parseFloat(style.height) >= parseFloat(own.height) * .7 ? paints(style) : [];
  });
  return targets.map(target => {
    const [frameId, id] = target.includes("/") ? target.split("/") : [null, target];
    const doc = frameId ? document.getElementById(frameId).contentDocument : document;
    const element = doc?.getElementById(id);
    if (!element) return { target, missing: true, ratio: 0 };
    const ink = doc.defaultView.getComputedStyle(element).color;
    let backdrop = [], node = element, view = doc.defaultView;
    while (node && !backdrop.length) {
      backdrop = [...faces(node, view), ...paints(view.getComputedStyle(node))];
      if (backdrop.length) break;
      const parent = node.parentElement || node.getRootNode().host;
      if (parent) { node = parent; continue; }
      // A frame's root is see-through: continue with the iframe element.
      node = view.frameElement;
      view = node?.ownerDocument.defaultView;
    }
    if (!backdrop.length) backdrop = ["rgb(255, 255, 255)"];
    const themed = doc.documentElement.hasAttribute("data-oled-night-mode");
    return { target, themed, ink, backdrop, ratio: Math.min(...backdrop.map(paint => ratio(ink, paint))),
      transparentFrame: doc.documentElement.hasAttribute("data-oled-night-transparent-frame") };
  });
}
