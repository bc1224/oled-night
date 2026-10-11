const assert = require('node:assert/strict');
require('../color-utils.js');
const c = global.OledNightColors;
assert.equal(c.mapDataPaint(c.parseColor('transparent')),null);
assert.equal(c.mapDataPaint(c.parseColor('rgb(0,0,0)')),'rgb(190 190 190)');
assert.equal(c.mapDataPaint(c.parseColor('rgb(255,255,255)')),'rgb(190 190 190)');
assert.match(c.mapDataPaint(c.parseColor('rgb(23,50,106)')),/^hsl\(220 64% 72%\)$/);
assert.equal(c.mapDataPaint(c.parseColor('rgba(0,0,0,.5)')),'rgb(190 190 190 / 0.5)');
console.log('Data paint: neutral contrast, colored hue and transparency preserved');
