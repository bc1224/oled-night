import {wait} from '../lab/browser.mjs';
import {darkLayoutInkScenario} from './dark-layout-ink-scenario.mjs';

// Native CDP input measures dispatch waiting as well as the next render boundary.
export async function darkLayoutScenario(browser,options,page,checks){
  const percentile=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
  for(const host of ['mail.google.com','dark-layout.invalid']){
    const pairs=[];
    for(const order of [[false,true],[true,false]]){
      const pair={};
      for(const active of order){
        await options.eval(`chrome.storage.sync.set(${JSON.stringify({extensionEnabled:active,brightness:88,appearance:'oled',siteRules:{[host]:'global'}})})`);
        await page.go(`https://${host}/oled-night-synthetic-dark-layout`);await wait(1800);
        await browser.send('Target.activateTarget',{targetId:page.targetId});
        const state=await page.eval(`({active:document.documentElement.hasAttribute('data-oled-night-root'),mode:document.documentElement.getAttribute('data-oled-night-mode')})`);
        if(state.active!==active||(active&&state.mode!=='crush'))throw Error('Dark layout comparison used the wrong extension mode');
        await browser.send('Performance.enable',{},page.sessionId);
        const metrics=async()=>Object.fromEntries((await browser.send('Performance.getMetrics',{},page.sessionId)).metrics.map(metric=>[metric.name,metric.value]));
        const before=await metrics();
        await page.eval(`(()=>{globalThis.rootMeasurements=0;globalThis.rootObserver=new MutationObserver(records=>rootMeasurements+=records.filter(record=>record.oldValue===null).length);for(const node of [document.body,document.documentElement])rootObserver.observe(node,{attributes:true,attributeOldValue:true,attributeFilter:['data-oled-night-measure','data-oled-night-measure-self']})})()`);
        const colors=await page.eval(`Array.from(document.querySelectorAll('.row span')).slice(0,20).map(node=>getComputedStyle(node).color)`);
        const pointers=[],keys=[];
        for(let i=0;i<30;i++){
          const start=performance.now();await page.hover(200,100+(i%20)*24);pointers.push(performance.now()-start);await wait(25);
        }
        await page.eval(`(()=>{const editor=document.getElementById('editor');editor.focus();const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(range)})()`);
        await wait(250);
        const expected='Synthetic reply text. Synthetic reply.';
        for(const char of expected){
          const start=performance.now();
          await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:char},page.sessionId);
          await browser.send('Input.insertText',{text:char},page.sessionId);keys.push(performance.now()-start);await wait(25);
          await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:char},page.sessionId);
        }
        await wait(100);
        const after=await metrics();
        const rootMeasurements=await page.eval(`(()=>{rootObserver.disconnect();return globalThis.rootMeasurements})()`);
        const result=await page.eval(`({text:document.getElementById('editor').textContent,pointer:samples.pointer,typing:samples.typing,colors:Array.from(document.querySelectorAll('.row span')).slice(0,20).map(node=>getComputedStyle(node).color)})`);
        checks.push({name:`${host}: ${active?'enabled':'disabled'} dark layout preserves text during hover and typing`,ok:result.text==='Draft:'+expected&&result.typing.length===expected.length&&JSON.stringify(result.colors)===JSON.stringify(colors),colors,after:result.colors});
        pair[active?'active':'native']={pointerP95:percentile(result.pointer),typingP95:percentile(result.typing),pointerDeliveryP95:percentile(pointers),keyDeliveryP95:percentile(keys),styleSeconds:after.RecalcStyleDuration-before.RecalcStyleDuration,rootMeasurements};
        if(active){
          const ink=await page.eval(`(${darkLayoutInkScenario.toString()})()`);
          for(const [name,ok] of Object.entries(ink))checks.push({name:`${host}: native dark layout ${name}`,ok});
        }
      }
      pairs.push(pair);
    }
    checks.push({name:`${host}: large native dark layout stays responsive during hover and reply typing`,ok:pairs.every(pair=>['pointerP95','typingP95','pointerDeliveryP95','keyDeliveryP95'].every(key=>pair.active[key]<=pair.native[key]+33)),pairs});
    checks.push({name:`${host}: local interaction avoids repeatedly invalidating the document's inherited ink`,ok:pairs.every(pair=>pair.active.rootMeasurements===0&&pair.active.styleSeconds<=pair.native.styleSeconds+.15),pairs});
  }
}
