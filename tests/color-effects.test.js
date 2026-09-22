const assert = require("node:assert/strict");
require("../color-utils.js");
const colors = global.OledNightColors;

// Alpha is preserved so scrims and fades stay translucent.
assert.equal(colors.mapBackground(colors.parseColor("rgba(0, 0, 0, 0.5)"), "oled"), "rgb(0 0 0 / 0.5)");
assert.equal(colors.mapBackground(colors.parseColor("rgba(255, 255, 255, 0.8)"), "oled"), "rgb(0 0 0 / 0.8)");

// White-to-transparent chat fades become black-to-transparent.
const fade = colors.mapGradient("linear-gradient(rgba(255, 255, 255, 0), rgb(255, 255, 255))", "oled");
assert.equal(fade, "linear-gradient(rgba(255, 255, 255, 0), #000000)");
assert.equal(colors.mapGradient("url(\"a.png\"), linear-gradient(red, blue)", "oled"), null);
assert.equal(colors.mapGradient("none", "oled"), null);

// White glows become dark; dark shadows are untouched.
assert.equal(colors.mapShadow("rgb(255, 255, 255) 0px -16px 16px 0px", "oled"), "#000000 0px -16px 16px 0px");
assert.equal(colors.mapShadow("rgba(0, 0, 0, 0.3) 0px 1px 2px 0px", "oled"), null);
assert.equal(colors.mapShadow("none", "oled"), null);

// Gradient backdrop reports the lightest opaque stop.
assert.deepEqual(colors.gradientBackdrop("linear-gradient(rgb(0, 0, 0), rgb(250, 250, 250))"), { r: 250, g: 250, b: 250, a: 1 });
assert.equal(colors.parseColor("rgb(1 2 3 / 50%)").a, 0.5);
console.log("color-effects: 11 assertions passed");

// Modern color syntaxes that Chrome returns from getComputedStyle.
const near = (c, r, g, b) => Math.abs(c.r - r) <= 2 && Math.abs(c.g - g) <= 2 && Math.abs(c.b - b) <= 2;
assert.deepEqual(colors.parseColor("color(srgb 0 0 0)"), { r: 0, g: 0, b: 0, a: 1 });
assert.ok(near(colors.parseColor("color(srgb 0.235294 0.239216 0.243137)"), 60, 61, 62));
assert.equal(colors.parseColor("color(srgb 1 1 1 / 0.5)").a, 0.5);
assert.ok(near(colors.parseColor("oklch(1 0 0)"), 255, 255, 255));
assert.ok(near(colors.parseColor("oklch(0.628 0.2577 29.23)"), 255, 0, 0));
assert.ok(near(colors.parseColor("oklab(0 0 0)"), 0, 0, 0));
assert.ok(near(colors.parseColor("lab(100 0 0)"), 255, 255, 255));
assert.ok(near(colors.parseColor("lab(54.29 80.82 69.91)"), 255, 0, 0));
assert.ok(near(colors.parseColor("lch(54.29 106.84 40.85)"), 255, 0, 0));
assert.equal(colors.parseColor("rgb(10, 20, 30)").b, 30);
assert.ok(colors.mapForeground(colors.parseColor("color(srgb 0 0 0)"), 88));
assert.equal(colors.mapGradient("linear-gradient(color(srgb 1 1 1 / 0), color(srgb 1 1 1))", "oled"), "linear-gradient(color(srgb 1 1 1 / 0), #000000)");
console.log("modern-colors: 12 assertions passed");

// 0.5.0: emphasis tiers, tints, colored borders, icons, dark-page crush.
const white = { r: 255, g: 255, b: 255, a: 1 };
assert.equal(colors.textTier(colors.parseColor("rgb(32, 33, 36)"), white), 1);
assert.equal(colors.textTier(colors.parseColor("rgb(95, 99, 104)"), white), 0.82);
assert.equal(colors.textTier(colors.parseColor("rgb(154, 160, 166)"), white), 0.66);
assert.equal(colors.textTier(white, colors.parseColor("rgb(26, 115, 232)")), 1);
assert.match(colors.mapBackground(colors.parseColor("rgb(232, 240, 254)"), "oled"), /^hsl\(\d+ 35% calc\(6%/);
assert.match(colors.mapBorder(colors.parseColor("rgb(26, 115, 232)")), /^hsl\(\d+ \d+% 55%\)$/);
assert.match(colors.mapIconPaint(colors.parseColor("rgb(95, 99, 104)")), /var\(--oln-light/);
assert.equal(colors.mapIconPaint(colors.parseColor("rgb(26, 115, 232)")), null);
assert.equal(colors.mapBackground(colors.parseColor("rgb(30, 31, 34)"), "crush"), "#000000");
assert.equal(colors.mapBackground(colors.parseColor("rgb(43, 45, 49)"), "crush"), null);
assert.equal(colors.mapBackground(colors.parseColor("rgb(88, 101, 242)"), "crush"), null);
assert.equal(colors.mapShadow("rgb(255, 255, 255) 0px 0px 4px 0px", "crush"), null);
console.log("v0.5 mapping: 12 assertions passed");
assert.equal(colors.mapBackground(colors.parseColor("rgb(19, 23, 34)"), "crush"), "#000000");
console.log("navy crush: 1 assertion passed");
assert.equal(colors.siteProfile("mail.google.com"), "gmail");
assert.equal(colors.siteProfile("google.com"), "");
console.log("site profiles: 2 assertions passed");

for (const host of ["idmsa.apple.com", "appleid.apple.com", "appstoreconnect.apple.com"]) assert.equal(colors.siteProfile(host), "apple-auth");
for (const host of ["reddit.com", "www.reddit.com", "old.reddit.com"]) assert.equal(colors.siteProfile(host), "reddit");
for (const host of ["notreddit.com", "reddit.com.example.org", "idmsa.apple.com.example.org"]) assert.equal(colors.siteProfile(host), "");
