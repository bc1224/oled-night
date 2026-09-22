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

global.location = { hostname: "www.figma.com" };
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
  removeEventListener() {},
  addEventListener() { throw new Error("Figma interaction traversal must stay disabled"); },
  documentElement: root,
  head: { appendChild(node) { nodesById.set(node.id, node); if (node.id === "oled-night-sheet") sheet = node; } },
  querySelectorAll() { return []; },
  getElementById(id) { return nodesById.get(id) || null; },
  createElement() { return { id: "", textContent: "", remove() { nodesById.delete(this.id); if (sheet === this) sheet = null; } }; },
  createTreeWalker() { walkerStarted = true; throw new Error("Figma DOM traversal must stay disabled"); }
};

global.chrome = {
  runtime: { onMessage: { addListener(listener) { messageListener = listener; } } },
  storage: {
    sync: { get(defaults, callback) { callback(defaults); } },
    onChanged: { addListener(listener) { storageListener = listener; } }
  }
};

require("../content.js");

assert.equal(attributes.has('data-oled-night-root'), false);
assert.equal(walkerStarted,false);
assert.equal(observerStarted,false);
assert.equal(sheet,null);
let status;
messageListener({type:'oled-night-status'},{},v=>status=v);
assert.equal(status.active,false);
console.log('figma-native: no recoloring, observer or DOM traversal by default');

for(const mode of ['on','recolor','deepen','invert']) {
 messageListener({type:'oled-night-preview',patch:{siteRules:{'www.figma.com':mode},brightness:40,dimImages:true}},{},()=>{});
 messageListener({type:'oled-night-status'},{},v=>status=v);
 assert.equal(status.active,true);
 assert.equal(status.mode,'native');
 assert.equal(sheet,null);
 assert.equal(walkerStarted,false);
 assert.equal(observerStarted,false);
 assert.equal(styleValues.has('--oln-light'),false);
}
console.log('figma-native: explicit on/recolor/deepen/invert all preserve native editor');
