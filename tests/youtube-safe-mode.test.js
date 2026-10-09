const assert = require("node:assert/strict");

require("../settings.js");
require("../color-utils.js");
require("../youtube-theme.js");

let sheet = null;
const nodesById = new Map();
let walkerStarted = false;
let observedTarget = null;
let storageListener = null;
let messageListener = null;
let stored = {};
const attributes = new Set();
const styleValues = new Map();
const attributeValues = new Map();

global.location = { hostname: "www.youtube.com" };
global.matchMedia = () => ({ matches: true });
global.Element = class Element {};
global.NodeFilter = { SHOW_ELEMENT: 1 };
global.Node = { ELEMENT_NODE: 1 };
global.MutationObserver = class MutationObserver {
  disconnect() {}
  observe(target) { observedTarget = target; }
};
global.CSS = { supports() { return true; } };

const root = {
  setAttribute(name, value = "") { attributes.add(name); attributeValues.set(name, value); },
  getAttribute(name) { return attributeValues.get(name) ?? null; },
  removeAttribute(name) { attributes.delete(name); attributeValues.delete(name); },
  style: {
    setProperty(name, value) { styleValues.set(name, value); },
    removeProperty(name) { styleValues.delete(name); }
  }
};

global.document = {
  removeEventListener() {},
  addEventListener(type) { assert.equal(type, "load", "Only stylesheet loading is watched"); },
  styleSheets: [],
  documentElement: root,
  head: { appendChild(node) { nodesById.set(node.id, node); if (node.id === "oled-night-sheet") sheet = node; } },
  querySelectorAll() { return []; },
  getElementById(id) { return nodesById.get(id) || null; },
  createElement() { return { id: "", textContent: "", remove() { nodesById.delete(this.id); if (sheet === this) sheet = null; } }; },
  createTreeWalker() { walkerStarted = true; throw new Error("YouTube DOM traversal must stay disabled"); }
};

global.chrome = {
  runtime: { onMessage: { addListener(listener) { messageListener = listener; } } },
  storage: {
    sync: { get(defaults, callback) { callback({ ...defaults, ...stored }); } },
    onChanged: { addListener(listener) { storageListener = listener; } }
  }
};

require("../content.js");

assert.equal(attributes.has("data-oled-night-root"), true);
assert.equal(styleValues.get("--oled-night-page"), "#000");
assert.equal(walkerStarted, false);
assert.equal(observedTarget, document.head);
assert.equal(attributes.has("data-oled-night-youtube"), true);
assert.equal(root.getAttribute?.("data-oled-night-version"), require("../manifest.json").version);
assert.equal(root.getAttribute("dark"), null, "Native theme preference is never changed");
assert.match(sheet.textContent, /--yt-spec-text-primary/);
messageListener({ type: "oled-night-preview", patch: { brightness: 70 } }, {}, () => {});
assert.equal(styleValues.get("--oled-night-youtube-primary"), "hsl(0 0% 70%)");
assert.equal(walkerStarted, false);
assert.equal(observedTarget, document.head);
storageListener({ contrast: { newValue: 84 } }, "sync");
assert.equal(walkerStarted, false);
stored.extensionEnabled = false;
storageListener({ extensionEnabled: { newValue: false } }, "sync");
assert.equal(nodesById.has("oled-night-youtube-sheet"), false, "Pausing removes palette overrides");
assert.equal(attributes.has("data-oled-night-youtube"), false);
console.log("youtube-safe-mode: safety and cleanup assertions passed");
