const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
require("../settings.js");
const S = global.OledNightSettings;
let config = { siteRules: { "forced.test": "invert", "off.test": "off" }, siteTuning: { "forced.test": { brightness: 65 } }, appearance: "soft" };
let listener, queries = 0, url = "chrome://extensions/";
const writes = [];
const context = vm.createContext({
  OledNightSettings: S, URL, console,
  chrome: {
    commands: { onCommand: { addListener(fn) { listener = fn; } } },
    storage: { sync: {
      async get(defaults) { return { ...defaults, ...structuredClone(config) }; },
      async set(patch) { writes.push(patch); config = { ...config, ...structuredClone(patch) }; }
    } },
    tabs: { async query() { queries++; return [{ url }]; } },
    runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} } }
  }
});
vm.runInContext(fs.readFileSync(require.resolve("../background.js"), "utf8"), context);
(async () => {
  const before = structuredClone(config);
  await listener("toggle-extension");
  assert.equal(config.extensionEnabled, false);
  assert.equal(queries, 0, "master shortcut must work without a web tab");
  for (const mode of ["global", "on", "recolor", "deepen", "invert"]) {
    assert.equal(S.isEnabled(S.normalize({ ...config, siteRules: { "forced.test": mode } }), "forced.test"), false);
  }
  assert.equal(writes.length, 1);
  url = "https://forced.test/";
  await listener("toggle-site");
  assert.equal(writes.length, 1, "site shortcut preserves rules while paused");
  await listener("toggle-extension");
  assert.equal(config.extensionEnabled, true);
  assert.equal(S.isEnabled(S.normalize(config), "forced.test"), true);
  assert.equal(S.isEnabled(S.normalize(config), "off.test"), false);
  for (const key of Object.keys(before)) assert.deepEqual(config[key], before[key]);
  await Promise.all([listener("toggle-extension"), listener("toggle-extension")]);
  assert.equal(config.extensionEnabled, true, "rapid double toggle restores original state");
  await listener("toggle-site");
  assert.equal(config.siteRules["forced.test"], "off");
  await listener("toggle-site");
  assert.equal(config.siteRules["forced.test"], undefined);
  const count = writes.length;
  await listener("unknown");
  url = "about:blank";
  await listener("toggle-site");
  assert.equal(writes.length, count);
  assert.equal(S.normalize().extensionEnabled, true, "existing installations remain enabled");
  assert.equal(S.normalize({ extensionEnabled: "false" }).extensionEnabled, true);
  assert.equal(S.normalize({ extensionEnabled: false }).extensionEnabled, false);
  console.log("commands: master pause/resume, preserved rules, rapid presses, and site shortcut passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
