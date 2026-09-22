const assert=require('node:assert/strict');
const m=require('../theme/manifest.json');
const c=m.theme.colors;
const lum=a=>a.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
for(const [fg,bg] of [['toolbar_text','toolbar'],['tab_text','toolbar'],['tab_background_text','frame'],['bookmark_text','toolbar'],['omnibox_text','omnibox_background'],['ntp_text','ntp_background'],['ntp_link','ntp_background']]) assert.ok((lum(c[fg])+.05)/(lum(c[bg])+.05)>=4.5,fg);
assert.ok(!m.permissions && !m.background && !m.content_scripts);
console.log('theme: 7 text pair contrast checks and script-free manifest passed');
