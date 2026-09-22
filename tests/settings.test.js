const assert = require("node:assert/strict");
require("../settings.js");
const S = global.OledNightSettings;
const base = S.normalize();
const at = (h, m = 0) => new Date(2026, 8, 19, h, m, 0);

// Site modes
assert.equal(S.isEnabled(base, "a.com"), true);
assert.equal(S.isEnabled({ ...base, globalEnabled: false }, "a.com"), false);
assert.equal(S.isEnabled({ ...base, globalEnabled: false, siteRules: { "a.com": "deepen" } }, "a.com"), true);
assert.equal(S.isEnabled({ ...base, siteRules: { "a.com": "off" } }, "a.com"), false);
assert.equal(S.siteMode({ ...base, siteRules: { "a.com": "bogus" } }, "a.com"), "global");
// Auto follows the OS
assert.equal(S.isEnabled({ ...base, appearance: "auto" }, "a.com", false), false);
assert.equal(S.isEnabled({ ...base, appearance: "auto" }, "a.com", true), true);
// Per-site tuning overrides global only where set
const tuned = S.normalize({ siteTuning: { "a.com": { brightness: 60, dimImages: true } } });
assert.deepEqual(S.tuningFor(tuned, "a.com"), { brightness: 60, contrast: 72, dimImages: true, custom: true });
assert.deepEqual(S.tuningFor(tuned, "b.com"), { brightness: 88, contrast: 72, dimImages: false, custom: false });
// Schedule wraps midnight
const night = S.normalize({ schedule: { enabled: true, start: "20:00", end: "07:00" } });
assert.equal(S.isEnabled(night, "a.com", true, at(23)), true);
assert.equal(S.isEnabled(night, "a.com", true, at(6, 59)), true);
assert.equal(S.isEnabled(night, "a.com", true, at(12)), false);
assert.equal(S.msUntilScheduleChange(night.schedule, at(19, 30)), 30 * 60000);
assert.equal(S.msUntilScheduleChange(base.schedule, at(19, 30)), null);
const invalid = S.normalize({ appearance: '\"]', brightness: NaN, contrast: 500, globalEnabled: 'false', openClosedShadows: 'yes', siteRules: {'a.com':'toString', 'b.com':'off'}, siteTuning: {'a.com': {brightness:-50, contrast:Infinity,dimImages:'yes'}}, schedule:{enabled:true,start:'99:90',end:null} });
assert.equal(invalid.appearance, 'oled');
assert.equal(invalid.brightness, 88);
assert.equal(invalid.contrast, 100);
assert.equal(invalid.globalEnabled, true);
assert.equal(invalid.openClosedShadows, false);
assert.deepEqual(invalid.siteRules, {'b.com':'off'});
assert.deepEqual(invalid.siteTuning, {'a.com':{brightness:40}});
assert.deepEqual(invalid.schedule, {enabled:true,start:'20:00',end:'07:00'});
assert.deepEqual(S.normalize(JSON.parse(JSON.stringify(tuned))), tuned);
assert.deepEqual(S.normalize([]), base);
assert.equal(S.siteMode({siteRules:{'a.com':'constructor'}}, 'a.com'), 'global');
console.log("settings: normal behavior and malformed-backup checks passed");

assert.equal(S.isEnabled(base,'www.figma.com'),false);
assert.equal(S.isEnabled(base,'figma.com.evil.test'),true);
assert.equal(S.isEnabled({...base,siteRules:{'www.figma.com':'on'}},'www.figma.com'),true);
