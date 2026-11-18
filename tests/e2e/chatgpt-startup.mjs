import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {launchChrome, wait} from '../lab/browser.mjs';

const url = 'https://chatgpt.com/oled-startup-test';
const nativeCSS = 'html,body{background:#fcfcfc}html[data-theme=dark],html[data-theme=dark] body{background:#0e0e0e}';
const captureFrames = `window.startupColors = new Promise(resolve => {
  const colors = [];
  requestAnimationFrame(function next() {
    colors.push(getComputedStyle(document.body).backgroundColor);
    if (colors.length === 12) resolve(colors); else requestAnimationFrame(next);
  });
});`;
let theme = 'dark';
const browser = await launchChrome({onEvent(event) {
  if (event.method !== 'Fetch.requestPaused') return;
  const html = `<!doctype html><html data-theme="${theme}"><head><style>${nativeCSS}</style></head><body>${theme === 'dark' ? '<main>Chat</main>' : ''}<script>${captureFrames}</script></body></html>`;
  browser.send('Fetch.fulfillRequest', {requestId:event.params.requestId,responseCode:200,
    responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from(html).toString('base64')}, event.sessionId);
}});
try {
  const {id} = await browser.send('Extensions.loadUnpacked',{path:resolve(process.env.EXT_PATH || resolve(import.meta.dirname,'../..'))});
  const options = await browser.open(`chrome-extension://${id}/options.html`);
  const tab = await browser.open();
  await browser.send('Fetch.enable',{patterns:[{urlPattern:url,resourceType:'Document'}]},tab.sessionId);
  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]},tab.sessionId);
  const frame = () => tab.eval(`new Promise(resolve => requestAnimationFrame(() => resolve({
    background:getComputedStyle(document.body).backgroundColor,
    marker:document.documentElement.getAttribute('data-oled-night-mode')})))`);
  const enabled = async value => {
    await options.eval(`chrome.storage.sync.set({extensionEnabled:${value}})`);
    await wait(150);
  };
  await tab.go(url);
  assert.equal((await frame()).background,'rgb(0, 0, 0)','the signed-in dark shell starts black');
  // Hydration can remove the attributes while keeping the document and head.
  await tab.eval(`for(const a of [...document.documentElement.attributes]) {
    if(a.name.startsWith('data-oled-night') || a.name==='style') document.documentElement.removeAttribute(a.name);
  }`);
  assert.deepEqual(await frame(),{background:'rgb(0, 0, 0)',marker:'native'},'hydration keeps the dark shell black and active');
  // ChatGPT briefly renders a light, empty shell before the dark app mounts.
  await tab.eval(`const replacement=document.createElement('html');replacement.dataset.theme='light';
    replacement.innerHTML='<head><style>'+ ${JSON.stringify(nativeCSS)} +'</style></head><body></body>';
    document.documentElement.replaceWith(replacement);`);
  assert.equal((await frame()).background,'rgb(0, 0, 0)','an empty provisional light shell does not flash white');
  await tab.eval(`document.documentElement.dataset.theme='dark';document.body.innerHTML='<main>Chat</main>'`);
  assert.deepEqual(await frame(),{background:'rgb(0, 0, 0)',marker:'native'},'the rebuilt document keeps the active dark theme');
  theme='light';
  await tab.go(url);
  assert.equal((await frame()).background,'rgb(0, 0, 0)','the previous dark choice covers a fresh empty shell even on a light OS');
  const startupColors = await tab.eval('window.startupColors');
  assert.deepEqual([...new Set(startupColors)], ['rgb(0, 0, 0)'], 'the first twelve loading frames stay black');
  await tab.eval(`document.body.innerHTML='<main>Chat</main>'`);
  assert.equal((await frame()).background,'rgb(252, 252, 252)','an actual light ChatGPT page keeps its light canvas');
  await enabled(false);
  await tab.eval(`document.body.replaceChildren();document.documentElement.dataset.theme='dark'`);
  assert.deepEqual(await frame(),{background:'rgb(14, 14, 14)',marker:null},'turning OLED Night off removes the dark paint and guard');
  const firstColors = async () => {
    await tab.go(url);
    return [...new Set(await tab.eval('window.startupColors'))];
  };
  const change = async patch => {
    await options.eval(`chrome.storage.sync.set(${JSON.stringify(patch)})`);
    await wait(250);
  };
  assert.deepEqual(await firstColors(), ['rgb(252, 252, 252)'], 'a paused extension leaves every starting frame native');
  theme='dark';
  await change({extensionEnabled:true,appearance:'soft'});
  await tab.go(url);
  assert.equal((await frame()).background,'rgb(16, 16, 20)','soft mode keeps its chosen surface');
  theme='light';
  assert.deepEqual(await firstColors(), ['rgb(16, 16, 20)'], 'the soft startup color is available on the first frame');
  await change({appearance:'auto'});
  assert.deepEqual(await firstColors(), ['rgb(252, 252, 252)'], 'automatic appearance respects a light OS on startup');
  await browser.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]},tab.sessionId);
  assert.deepEqual(await firstColors(), ['rgb(0, 0, 0)'], 'automatic appearance protects a dark OS startup');
  await change({siteRules:{'chatgpt.com':'off'}});
  assert.deepEqual(await firstColors(), ['rgb(252, 252, 252)'], 'the site-off rule also disables early paint');
  const outsideSchedule = await tab.eval(`(() => {
    const hour = new Date().getHours();
    const time = offset => String((hour + offset) % 24).padStart(2,'0') + ':00';
    return {enabled:true,start:time(1),end:time(2)};
  })()`);
  await change({siteRules:{},schedule:outsideSchedule});
  assert.deepEqual(await firstColors(), ['rgb(252, 252, 252)'], 'a scheduled-off page stays native from the first frame');
  console.log('ChatGPT startup, hydration, native light and disable passed');
} finally { await browser.close(); }
