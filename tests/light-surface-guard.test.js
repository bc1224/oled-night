// Light surface guard: light ink is only kept where the paint behind it is
// proven dark. Anything the mapper did not rewrite counts as light.
const assert = require("node:assert/strict");
require("../color-utils.js");
const colors = global.OledNightColors;

// Colors: clear, mapped and dark paint is proven dark; light or unknown is not.
for (const dark of ["", "transparent", "rgba(255, 255, 255, 0.04)", "#000000", "rgb(20, 20, 24)",
  "rgb(calc(14 + 10 * var(--oln-strength, 0.72)) 0 0)"]) assert.equal(colors.provenDarkColor(dark), true, dark);
for (const light of ["rgb(255, 255, 255)", "#f4f6f8", "rgb(240, 193, 75)", "rgb(128, 128, 128)", "not-a-color"])
  assert.equal(colors.provenDarkColor(light), false, light);

// Images: url() layers are photos and never block; gradients must be dark in
// every stop, wherever they are nested (image-set, prefixed, unprefixed).
assert.equal(colors.provenDarkImage("none"), true);
assert.equal(colors.provenDarkImage('url("photo.png")'), true);
assert.equal(colors.provenDarkImage("linear-gradient(rgb(0, 0, 0), rgb(20, 20, 20))"), true);
for (const light of [
  "linear-gradient(rgb(255, 255, 255), rgb(248, 249, 250))",
  "-webkit-linear-gradient(top, rgb(247, 223, 165), rgb(240, 193, 75))",
  "image-set(linear-gradient(rgb(255, 255, 255), rgb(244, 246, 248)) 1x)",
  'url("photo.png"), linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))',
]) assert.equal(colors.provenDarkImage(light), false, light);

// The 0.6.90 Amazon button: a prefixed gradient maps to proven-dark stops.
const amazon = colors.mapGradient("-webkit-linear-gradient(top, rgb(247, 223, 165), rgb(240, 193, 75))", "oled");
assert.ok(amazon && colors.provenDarkImage(amazon), amazon);

// Any-layer mapping covers gradient layers the named-function pattern misses,
// and still leaves url() layers byte-for-byte intact.
const wrapped = "image-set(linear-gradient(rgb(255, 255, 255), rgb(244, 246, 248)) 1x)";
assert.equal(colors.mapGradient(wrapped, "oled"), null, "the default pattern skips image-set");
const anyLayer = colors.mapGradient(wrapped, "oled", true, true);
assert.ok(anyLayer && colors.provenDarkImage(anyLayer), anyLayer);
const photo = 'url("photo(1).png")';
const mixed = colors.mapGradient(`${photo}, ${wrapped}`, "oled", true, true);
assert.ok(mixed.startsWith(photo + ", "), mixed);
assert.ok(colors.provenDarkImage(mixed), mixed);

console.log("light surface guard: ok");
