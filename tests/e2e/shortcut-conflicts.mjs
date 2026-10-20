import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {launchChrome} from '../lab/browser.mjs';
const root=resolve(import.meta.dirname,'../..'),fixture=join(root,'dist/shortcut-conflict');
mkdirSync(fixture,{recursive:true});
// A real competing extension owns both legacy keys before OLED is installed.
writeFileSync(join(fixture,'manifest.json'),JSON.stringify({manifest_version:3,name:'OLED shortcut conflict test',version:'1.0',commands:{'other-master':{suggested_key:{default:'Alt+Shift+E'},description:'Synthetic conflict'},'other-site':{suggested_key:{default:'Alt+Shift+D'},description:'Synthetic conflict'}}}));
const browser=await launchChrome();
try{
 await browser.send('Extensions.loadUnpacked',{path:fixture});
 const {id}=await browser.send('Extensions.loadUnpacked',{path:join(root,'dist/chrome')});
 const options=await browser.open(`chrome-extension://${id}/options.html`);
 const commands=await options.eval('chrome.commands.getAll()');
 assert.equal(commands.find(c=>c.name==='toggle-extension')?.shortcut,'','legacy master conflict is reproduced by Chrome');
 assert.equal(commands.find(c=>c.name==='toggle-site')?.shortcut,'','legacy site conflict is reproduced by Chrome');
 assert.ok(commands.find(c=>c.name==='toggle-extension-backup')?.shortcut,'master has an independently registered fallback when its original key is unavailable');
 assert.ok(commands.find(c=>c.name==='toggle-site-backup')?.shortcut,'site has an independently registered fallback when its original key is unavailable');
 assert.match(await options.eval("document.getElementById('extensionShortcut').textContent"),/Ctrl\+Shift\+9/,'settings displays the actually assigned master fallback');
 assert.match(await options.eval("document.getElementById('shortcut').textContent"),/Ctrl\+Shift\+8/,'settings displays the actually assigned site fallback');
 const popup=await browser.open(`chrome-extension://${id}/popup.html`);
 assert.match(await popup.eval("document.getElementById('extensionShortcut').textContent"),/Ctrl\+Shift\+9/,'popup displays the assigned master fallback');
 assert.match(await popup.eval("document.getElementById('shortcut').textContent"),/Ctrl\+Shift\+8/,'popup displays the assigned site fallback');
 console.log('PASS Chrome shortcut collisions retain registered master/site fallback keys and show the real assignments');
}finally{await browser.close();}
