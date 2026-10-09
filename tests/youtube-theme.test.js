const assert = require("node:assert/strict");
require("../youtube-theme.js");
const rule = (selectorText, values) => ({ selectorText, style: Object.assign(Object.keys(values), {getPropertyValue: key => values[key]}) });
const sheets = [{cssRules:[
  rule(":root", {"--tabc123":"#fff"}),
  rule("[dark], html[dark]", {"--tabc123":"#0f0f0f", "--yt-spec-text-primary":"#f1f1f1", "--yt-spec-text-secondary":"#aaa", "--yt-spec-call-to-action":"#3ea6ff", "--yt-geometry":"24px", "--yt-image":"url(https://example.com/x)", "--yt-ref":"var(--anything)", color:"red"}),
  rule("[dark] ytd-player", {"--tabc123":"red"}),
  rule("[light]", {"--tabc123":"white"})
]}, {get cssRules(){throw Error("cross-origin");}}, {ownerNode:{id:"oled-night-sheet"}, cssRules:[rule("[dark]",{"--tabc123":"red"})]}];
const output = globalThis.OledNightYouTube.palette(sheets, v => /^#/.test(v));
assert.match(output, /--tabc123:var\(--oled-night-page\)/);
assert.match(output, /--yt-spec-text-primary:var\(--oled-night-youtube-primary\)/);
assert.match(output, /--yt-spec-text-secondary:var\(--oled-night-youtube-secondary\)/);
assert.match(output, /--yt-spec-call-to-action:#3ea6ff/);
assert.doesNotMatch(output, /red|white|url|24px|anything|geometry|image|ref:/);
console.log("youtube-theme: native palette selection and declaration safety passed");
