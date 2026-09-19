const assert = require("node:assert/strict");

require("../settings.js");
require("../color-utils.js");

let sheet = null;
const nodesById = new Map();
let walkerStarted = false;
let observerStarted = false;
let storageListener = null;
let messageListener = null;
const attributes = new Set();
const styleValues = new Map();
const attributeValues = new Map();

global.location = { hostname: "www.youtube.com" };
global.matchMedia = () => ({ matches: true });
global.Element = class Element {};
global.NodeFilter = { SHOW_ELEMENT: 1 };
global.Node = { ELEMENT_NODE: 1 };
global.MutationObserver = class MutationObserver {
  constructor() { observerStarted = true; }
  disconnect() {}
  observe() {}
};

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
    sync: { get(defaults, callback) { callback(defaults); } },
    onChanged: { addListener(listener) { storageListener = listener; } }
  }
};

require("../content.js");

assert.equal(attributes.has("data-oled-night-root"), true);
assert.equal(styleValues.get("--oled-night-page"), "#000");
assert.equal(walkerStarted, false);
assert.equal(observerStarted, false);
assert.equal(attributes.has("data-oled-night-youtube"), true);
assert.equal(root.getAttribute?.("data-oled-night-version"), "0.6.2");
assert.doesNotMatch(sheet.textContent, /--yt-spec-base-background/);
assert.match(sheet.textContent, /--yt-spec-text-primary/);
messageListener({ type: "oled-night-preview", patch: { brightness: 70 } }, {}, () => {});
assert.equal(styleValues.get("--oled-night-youtube-primary"), "hsl(0 0% 70%)");
assert.equal(walkerStarted, false);
assert.equal(observerStarted, false);
storageListener({ contrast: { newValue: 84 } }, "sync");
assert.equal(walkerStarted, false);
console.log("youtube-safe-mode: 12 assertions passed");
