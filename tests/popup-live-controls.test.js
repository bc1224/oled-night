const assert = require("node:assert/strict");

const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { id, value: "", checked: false, disabled: false, style: {}, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } });
  return elements.get(id);
}
for (const id of ["globalEnabled", "siteRule", "hostname", "brightness", "brightnessValue", "contrast", "contrastValue", "siteSettings"]) element(id);
const appearance = ["oled", "soft", "auto"].map((value) => ({ value, checked: false, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } }));
const statusDot = { style: {} };
global.document = {
  getElementById: element,
  querySelector(selector) {
    if (selector === ".status-dot") return statusDot;
    const match = selector.match(/value="([^"]+)"/);
    return appearance.find((item) => item.value === match?.[1]);
  },
  querySelectorAll() { return appearance; }
};
const writes = [];
const messages = [];
global.chrome = {
  storage: { sync: { async get(defaults) { return defaults; }, async set(patch) { writes.push(patch); } } },
  tabs: { async query() { return [{ id: 7, url: "https://example.com/" }]; }, sendMessage(id, message) { messages.push({ id, message }); return Promise.resolve(); } },
  runtime: { openOptionsPage() {} }
};
require("../settings.js");
require("../popup.js");

setImmediate(async () => {
  element("brightness").listeners.input({ target: { value: "73" } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(element("brightnessValue").value, "73%");
  assert.deepEqual(messages.at(-1), { id: 7, message: { type: "oled-night-preview", patch: { siteTuning: { "example.com": {brightness:73} } } } });
  element("brightness").listeners.change({ target: { value: "73" } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(writes.at(-1), {siteTuning:{"example.com":{brightness:73}}});
  element('globalContrast').listeners.input({target:{value:'85'}});
  element('globalBrightness').listeners.input({target:{value:'95'}});
  element('globalBrightness').listeners.change({target:{value:'95'}});
  await new Promise(r=>setTimeout(r,20));
  assert.deepEqual(writes.at(-1),{contrast:85,brightness:95});
  assert.equal(element('brightness').value,73);
  element('siteEnabled').listeners.change({target:{checked:false}});
  await new Promise(r=>setTimeout(r,20));
  assert.deepEqual(writes.at(-1),{siteRules:{'example.com':'off'}});
  console.log("popup-live-controls: 6 assertions passed");
});
