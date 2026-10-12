(function () {
  "use strict";
  const ID = "oled-night-youtube-sheet";
  const ROOT = "html[data-oled-night-root][data-oled-night-youtube]";
  const DARK_ROOT = /^(?:html|:root)?\[dark(?:=(?:"true"|'true'|true))?\]$/;
  const TOKEN = /^--(?:t[\da-f]+$|yt-|ytd-)/;
  // Attributed text and Lottie icons receive literal paint from YouTube's
  // renderer instead of theme tokens. CSS handles hydration without observing
  // or rewriting the body. Match neutral ink only, not links or authored hues.
  function literalPaint() {
    const colors = [0, 15, 19, 241, 255];
    const text = [];
    for (const channel of colors) {
      const rgb = `rgb(${channel}, ${channel}, ${channel})`;
      const compact = `rgb(${channel},${channel},${channel})`;
      const hex = `#${channel.toString(16).padStart(2, "0").repeat(3)}`;
      for (const value of [rgb, compact, hex]) for (const space of ["", " "]) {
        text.push(`${ROOT} :is(ytd-watch-metadata #description, ytd-video-secondary-info-renderer #description, ytd-comment-view-model #content-text) :is(yt-attributed-string, yt-formatted-string) span[style*="color:${space}${value}"]:not([style*="background"]):not(:is(yt-attributed-string,yt-formatted-string)[style*="background"] *,:is(yt-attributed-string,yt-formatted-string) [style*="background"] *)`);
      }
    }
    const icon = `${ROOT} like-button-view-model button[aria-pressed="false"] svg path:is([fill="rgb(0,0,0)"],[fill="rgb(0, 0, 0)"],[fill="#000"],[fill="#000000"]):not(defs *,mask *,clipPath *)`;
    return `${text.join(",")}{color:var(--oled-night-youtube-primary) !important;}
${ROOT} :is(ytd-watch-metadata #description,ytd-video-secondary-info-renderer #description) .ytAttributedStringLinkCallToActionColor{color:var(--yt-spec-call-to-action,#3ea6ff) !important;}
${ROOT} .ytSearchboxComponentSearchButton{background-color:var(--yt-spec-badge-chip-background,#272727) !important;color:var(--oled-night-youtube-primary) !important;}
${icon}{fill:var(--oled-night-youtube-primary) !important;}`;
  }

  // YouTube changes the names of its color tokens. Read its native dark palette
  // rather than pinning hashed names or changing the site's [dark] state. Only
  // literal colors from root theme rules are eligible: no geometry, selectors,
  // images, URLs, or declarations from individual components are copied.
  function palette(sheets, supportsColor) {
    const colors = new Map();
    for (const sheet of sheets) {
      if (sheet.disabled || sheet.ownerNode?.id?.startsWith("oled-night-")) continue;
      try {
        for (const rule of sheet.cssRules) {
          if (!rule.selectorText?.split(",").some(selector => DARK_ROOT.test(selector.trim()))) continue;
          for (const name of rule.style) {
            const value = rule.style.getPropertyValue(name).trim();
            if (!TOKEN.test(name) || /var\(|url\(|[;{}]/i.test(value) || !supportsColor(value)) continue;
            const lower = value.toLowerCase();
            colors.set(name, lower === "#0f0f0f" ? "var(--oled-night-page)"
              : lower === "#f1f1f1" ? "var(--oled-night-youtube-primary)"
              : lower === "#aaa" || lower === "#aaaaaa" ? "var(--oled-night-youtube-secondary)" : value);
          }
        }
      } catch { /* Cross-origin sheets are not readable; never fetch them. */ }
    }
    return [...colors].map(([name, value]) => `${name}:${value} !important;`).join("");
  }

  function start(doc = document) {
    let timer = null;
    const sheet = doc.createElement("style");
    sheet.id = ID;
    doc.head.appendChild(sheet);
    const refresh = () => {
      timer = null;
      const text = `${ROOT}{${palette(doc.styleSheets, value => CSS.supports("color", value))}}\n${literalPaint()}`;
      if (sheet.textContent !== text) sheet.textContent = text;
    };
    const schedule = () => { if (timer === null) timer = setTimeout(refresh, 50); };
    const owned = node => node?.id?.startsWith("oled-night-");
    // Watch styles in the head only. No player/body traversal, per-element
    // recoloring, interaction handlers, or native YouTube attribute changes.
    const observer = new MutationObserver(records => {
      if (records.some(record => !owned(record.target) && !owned(record.target.parentElement)
        && (/^(STYLE|LINK)$/.test(record.target.nodeName) || record.target.parentElement?.nodeName === "STYLE"
          || [...record.addedNodes, ...record.removedNodes].some(node => /^(STYLE|LINK)$/.test(node.nodeName) && !owned(node))))) schedule();
    });
    observer.observe(doc.head, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["href", "media", "disabled"] });
    const loaded = event => { if (event.target?.tagName === "LINK" && doc.head.contains(event.target)) schedule(); };
    doc.addEventListener("load", loaded, true);
    refresh();
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      doc.removeEventListener("load", loaded, true);
      sheet.remove();
    };
  }
  globalThis.OledNightYouTube = { palette, start };
})();
