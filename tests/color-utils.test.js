const assert = require("node:assert/strict");
require("../color-utils.js");
const colors = global.OledNightColors;
assert.deepEqual(colors.parseColor("rgba(255, 0, 12, 0.5)"), { r: 255, g: 0, b: 12, a: 0.5 });
assert.match(colors.mapBackground(colors.parseColor("rgb(255,255,255)"), "oled"), /^rgb\(calc\(14 \+ 10 \*/);
assert.notEqual(colors.mapBackground(colors.parseColor("rgb(255,255,255)"), "oled"), colors.mapBackground(colors.parseColor("rgb(242,242,242)"), "oled"));
assert.equal(colors.mapBackground(colors.parseColor("rgba(0,0,0,0)"), "oled"), null);
assert.match(colors.mapBackground(colors.parseColor("rgb(0,120,255)"), "oled"), /^hsl\(.*var\(--oln-strength/);
assert.equal(colors.mapForeground(colors.parseColor("rgb(15,15,15)")), "hsl(0 0% var(--oln-light, 88%))");
assert.equal(colors.mapForeground(colors.parseColor("rgb(240,240,240)")), "hsl(0 0% var(--oln-light, 88%))");
assert.match(colors.mapForeground(colors.parseColor("rgb(0,90,200)")), /calc\(var\(--oln-light, 88%\) \* 0\.86\)/);
assert.match(colors.mapBackground(colors.parseColor("rgb(80,80,80)"), "oled"), /var\(--oln-strength/);
assert.equal(colors.mapBorder(colors.parseColor("rgb(40,40,40)")), "rgb(255 255 255 / calc(12% + 18% * var(--oln-strength, 0.72)))");
assert.equal(colors.isProtectedMediaTag("shreddit-player"), true);
assert.equal(colors.isProtectedMediaTag("example-gallery-carousel"), true);
assert.equal(colors.isProtectedMediaTag("div"), false);
assert.equal(colors.usesNativeSafeMode("youtube.com"), true);
assert.equal(colors.usesNativeSafeMode("www.youtube.com"), true);
assert.equal(colors.usesNativeSafeMode("music.youtube.com"), true);
assert.equal(colors.usesNativeSafeMode("notyoutube.com"), false);
assert.equal(colors.usesNativeSafeMode("reddit.com"), false);
for(const host of ['chatgpt.com','www.chatgpt.com','chat.openai.com']) assert.equal(colors.usesNativeChatTheme(host),true);
for(const host of ['notchatgpt.com','chatgpt.com.example.org','openai.com','youtube.com']) assert.equal(colors.usesNativeChatTheme(host),false);
console.log("color-utils: 17 assertions passed");
const cachedColor = colors.parseColor('rgb(12, 34, 56)');
assert.ok(Object.isFrozen(cachedColor));
assert.strictEqual(colors.parseColor('rgb(12, 34, 56)'), cachedColor);
const mutableColor = {r:0,g:0,b:0,a:1};
const darkLuminance = colors.luminance(mutableColor);
mutableColor.r=mutableColor.g=mutableColor.b=255;
assert.ok(colors.luminance(mutableColor)>darkLuminance);
for(let i=0;i<600;i++) colors.parseColor(`rgba(12,34,56,${i/600})`);
assert.deepEqual(colors.parseColor('rgb(12, 34, 56)'),cachedColor);
assert.equal(colors.parseColor('invalid'),null);
console.log('Color cache preserves correctness after eviction and mutable inputs');

assert.equal(colors.siteProfile('www.amazon.com'), 'amazon');
assert.equal(colors.siteProfile('amazon.com.evil.example'), '');
for (const host of ['www.amazon.ca', 'www.amazon.co.uk', 'www.amazon.de', 'www.amazon.co.jp', 'www.amazon.com.au']) assert.equal(colors.siteProfile(host), 'amazon', host);
for (const host of ['amazon.ca.evil.example', 'notamazon.ca', 'www.amazon.example']) assert.equal(colors.siteProfile(host), '', host);
assert.equal(colors.siteProfile('analytics.google.com'), 'google-analytics');
assert.equal(colors.siteProfile('ANALYTICS.GOOGLE.COM'), 'google-analytics');
assert.equal(colors.siteProfile('analytics.google.com.evil.example'), '');
assert.equal(colors.siteProfile('maps.google.com'), '');
assert.equal(colors.siteProfile('docs.google.com'), 'google-docs');
assert.equal(colors.siteProfile('DOCS.GOOGLE.COM'), 'google-docs');
assert.equal(colors.siteProfile('docs.google.com.evil.example'), '');
// Dark drop shadows that vanish on black become a faint light edge, scaled
// to the original lift. Inset, light or tiny shadows are left to other rules.
{
  const lift = colors.liftShadow("rgba(0, 0, 0, 0.15) 0px 2px 10px 0px");
  assert.match(lift, /^0 0 0 1px rgb\(255 255 255 \/ \.09\), 0 2px 15px rgb\(255 255 255 \/ \.035\)$/);
  assert.equal(colors.liftShadow("rgba(0, 0, 0, 0.2) 0px 1px 2px 0px"), "0 0 0 1px rgb(255 255 255 / .09)");
  assert.equal(colors.liftShadow("rgba(0, 0, 0, 0.3) 0px 2px 4px 0px inset"), null);
  assert.equal(colors.liftShadow("rgb(200, 200, 200) 0px 2px 10px 0px"), null);
  assert.equal(colors.liftShadow("rgba(0, 0, 0, 0.02) 0px 2px 10px 0px"), null);
  assert.equal(colors.liftShadow("none"), null);
  assert.match(colors.liftShadow("rgba(0,0,0,.1) 0px 1px 3px 0px, rgba(0,0,0,.2) 0px 20px 60px -10px"), /, 0 4px 24px rgb\(255 255 255 \/ \.035\)$/);
}
// Dark brand ink (navy icons and wordmarks) would vanish on black; lighten it
// with its hue. Mid-tone brand colors keep their authored paint.
{
  const navy = colors.mapIconPaint(colors.parseColor("rgb(8, 33, 65)"));
  assert.ok(navy, "dark navy icon paint is mapped");
  assert.equal(colors.mapIconPaint(colors.parseColor("rgb(200, 30, 40)")), null);
  // A vivid dark control keeps its hue instead of collapsing to near black.
  assert.match(colors.mapBackground(colors.parseColor("rgb(10, 38, 140)"), "oled"), /^hsl\(22\d /);
  assert.equal(colors.mapBackground(colors.parseColor("rgb(8, 33, 65)"), "oled"), "#000000");
}
