// Contrast floors for mapped colors, checked with independent WCAG math.
// Gradient buttons must keep light labels readable, and icon paint that the
// mapper leaves unchanged must still show against true black.
const assert = require("node:assert/strict");
require("../color-utils.js");
const colors = global.OledNightColors;

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
function relativeLuminance([r, g, b]) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const contrast = (a, b) => { const x = relativeLuminance(a), y = relativeLuminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// Resolve one mapped stop, "hsl(H S% calc(B% + 10% * var(--oln-strength, 0.72)))".
function vividStop(css, strength) {
  const m = /^hsl\((\d+) (\d+)% calc\((\d+)% \+ 10% \* var\(--oln-strength, [\d.]+\)\)\)/.exec(css);
  return m && { rgb: hslToRgb(+m[1], +m[2] / 100, (+m[3] + 10 * strength) / 100), base: +m[3] };
}
const firstStop = (rgb) => colors.mapGradient(`linear-gradient(rgb(${rgb.join(", ")}), rgb(${rgb.join(", ")}))`, "oled")?.match(/hsl\([^()]*\([^()]*\([^()]*\)\)\)/)?.[0];

// Default brightness (88%) light label on every saturated gradient stop, at the
// default and the maximum surface contrast.
const label = hslToRgb(0, 0, 0.88);
const failures = [];
const order = new Map();
for (let h = 0; h < 360; h += 10) for (const s of [0.6, 0.8, 1]) for (const l of [0.4, 0.5, 0.6, 0.7, 0.8]) {
  const css = firstStop(hslToRgb(h, s, l));
  for (const strength of [0.72, 1]) {
    const stop = css && vividStop(css, strength);
    if (!stop) continue;
    const ratio = contrast(label, stop.rgb);
    if (ratio < 4.5) failures.push(`hsl(${h} ${s} ${l}) at ${strength}: ${ratio.toFixed(2)}`);
    if (strength === 1) (order.get(`${h}/${s}`) || order.set(`${h}/${s}`, []).get(`${h}/${s}`)).push([l, stop.base]);
  }
}
assert.deepEqual(failures, [], `light labels on mapped gradient stops fall below 4.5:1:\n${failures.slice(0, 8).join("\n")}`);
// Lighter authored stops of one hue never map visibly darker than darker
// stops. One point of slack covers RGB round-trip noise in saturation.
for (const [key, stops] of order) for (let i = 1; i < stops.length; i++) assert.ok(stops[i][1] >= stops[i - 1][1] - 1, `gradient stop order inverted for ${key}: ${JSON.stringify(stops)}`);
// Unclamped stops (dark blue and red) keep their full light/dark spread.
assert.ok(vividStop(firstStop([102, 153, 255]), 1).base - vividStop(firstStop([0, 51, 153]), 1).base >= 6, "blue gradient keeps its spread");
// The two failing hues from the 0.6.89 audit, by name.
assert.ok(contrast(label, vividStop(firstStop([255, 255, 153]), 0.72).rgb) >= 4.5, "pale yellow #ffff99");
assert.ok(contrast(label, vividStop(firstStop([204, 255, 153]), 0.72).rgb) >= 4.5, "pale lime #ccff99");

// Icon paint left unchanged must reach 3:1 against true black.
const kept = [];
for (let h = 0; h < 360; h += 5) for (const s of [0.4, 0.7, 1]) for (let l = 0.1; l <= 0.6; l += 0.05) {
  const rgb = hslToRgb(h, s, l);
  if (colors.mapIconPaint(colors.parseColor(`rgb(${rgb.join(", ")})`)) !== null) continue;
  const ratio = contrast(rgb, [0, 0, 0]);
  if (ratio < 3) kept.push(`rgb(${rgb.join(",")}) ${ratio.toFixed(2)}`);
}
assert.deepEqual(kept, [], `kept icon colors under 3:1 on black:\n${kept.slice(0, 8).join("\n")}`);
assert.notEqual(colors.mapIconPaint(colors.parseColor("rgb(31, 71, 48)")), null, "dark green icon is lifted");
// Mid-tone brand colors still keep their own paint.
for (const brand of ["rgb(204, 0, 0)", "rgb(0, 112, 74)", "rgb(230, 0, 35)"]) assert.equal(colors.mapIconPaint(colors.parseColor(brand)), null, brand);
console.log("contrast floors: gradient labels and kept icon paint pass");
