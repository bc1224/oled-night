// Real unpacked extension and native pointer input, with synthetic responses.
// Fetch interception prevents this fixture from accessing a live mailbox.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {launchChrome,wait} from '../lab/browser.mjs';
import {runtimeDigest} from '../lab/runtime-proof.mjs';
import {textHoverEvents} from './text-hover-scenario.mjs';
import {startReplyTyping} from './reply-typing-scenario.mjs';
import {inkLocalityScenario} from './ink-locality-scenario.mjs';
import {darkLayoutScenario} from './dark-layout-scenario.mjs';

const root=resolve(import.meta.dirname,'../..');
const extension=resolve(process.env.EXT_PATH||root);
const version=JSON.parse(readFileSync(join(extension,'manifest.json'))).version;
const runtimeHash=runtimeDigest(file=>readFileSync(join(extension,file)));
let sha=null;
try{sha=execFileSync('git',['rev-parse','HEAD'],{cwd:extension,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']}).trim()}catch{}
const fixture=readFileSync(join(root,'tests/e2e/site/text-hover.html'),'utf8');
const localityFixture=readFileSync(join(root,'tests/e2e/site/ink-locality.html'),'utf8');
const darkLayoutFixture=readFileSync(join(root,'tests/e2e/site/dark-layout.html'),'utf8');
const ids=['first','second','third','fourth','last','control','shadowFirst','shadowSecond','symbol','cssSymbol','vectorLabel','slottedFirst','slottedSecond'];
const checks=[],requestErrors=[];
let browser;
let browserVersion;
try {
  browser=await launchChrome({onEvent:message=>{
    if(message.method!=='Fetch.requestPaused')return;
    browser.send('Fetch.fulfillRequest',{
      requestId:message.params.requestId,responseCode:200,
      responseHeaders:[{name:'Content-Type',value:'text/html'}],
      body:Buffer.from(message.params.request.url.includes('synthetic-dark-layout')?darkLayoutFixture:message.params.request.url.includes('synthetic-ink-locality')?localityFixture:fixture).toString('base64')
    },message.sessionId).catch(error=>requestErrors.push(error.message));
  }});
  browserVersion=await browser.send('Browser.getVersion');
  const {id}=await browser.send('Extensions.loadUnpacked',{path:extension});
  assert(id,'the actual extension must load');
  const options=await browser.open(`chrome-extension://${id}/options.html`);
  const page=await browser.open();
  await browser.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},page.sessionId);
  for(const test of [
    {name:'Gmail automatic OLED',host:'mail.google.com',mode:'global',appearance:'oled'},
    {name:'Gmail automatic Soft Dark',host:'mail.google.com',mode:'global',appearance:'soft'},
    {name:'Gmail lower text brightness',host:'mail.google.com',mode:'global',appearance:'oled',brightness:50},
    {name:'generic dark full recolor OLED',host:'hover-fixture.invalid',mode:'recolor',appearance:'oled'},
    {name:'generic dark full recolor Soft Dark',host:'hover-fixture.invalid',mode:'recolor',appearance:'soft'},
    {name:'generic light automatic OLED',host:'hover-fixture.invalid',mode:'global',appearance:'oled',original:'light'},
    {name:'generic light automatic Soft Dark',host:'hover-fixture.invalid',mode:'global',appearance:'soft',original:'light'},
    {name:'generic light lower text brightness',host:'hover-fixture.invalid',mode:'global',appearance:'oled',original:'light',brightness:50},
    {name:'generic native dark automatic',host:'hover-fixture.invalid',mode:'global',appearance:'oled'},
    {name:'generic explicit deepen',host:'hover-fixture.invalid',mode:'deepen',appearance:'oled'}
  ]){
  if(process.env.OLED_INK_LOCALITY_ONLY)continue;
  if(process.env.OLED_REPLY_TYPING_ONLY)continue;
  if(process.env.OLED_REPLY_TYPING_CASE)continue;
  if(process.env.OLED_TEXT_HOVER_CASE&&!test.name.includes(process.env.OLED_TEXT_HOVER_CASE))continue;
  await options.eval(`chrome.storage.sync.set(${JSON.stringify({extensionEnabled:true,brightness:test.brightness||88,appearance:test.appearance,siteRules:{[test.host]:test.mode}})})`);
  const url=`https://${test.host}/oled-night-synthetic-text-hover?original=${test.original||'dark'}`;
  await page.go(url);
  await wait(450);
  const status=await options.eval(`(async()=>{const [tab]=await chrome.tabs.query({url:${JSON.stringify(url)}});return chrome.tabs.sendMessage(tab.id,{type:'oled-night-status'})})()`);
  assert.equal(status.version,version);
  assert.equal(status.active,true);
  const expectedMode=test.mode==='recolor'||test.original==='light'?(test.appearance==='soft'?'soft':'oled'):test.mode==='deepen'||test.appearance==='oled'?'crush':'none';
  assert.equal(status.mode,expectedMode,`${test.name} must exercise its intended mode`);
  if(test.host==='mail.google.com')assert.equal(await page.eval(`document.documentElement.getAttribute('data-oled-night-site')`),'gmail');
  const snapshotExpression=`Object.fromEntries(${JSON.stringify(ids)}.map(id=>{const node=document.getElementById(id)||document.getElementById('shadowHost').shadowRoot.getElementById(id),style=getComputedStyle(node);return[id,node instanceof SVGElement?style.fill+';'+style.stroke:style.color]}))`;
  const snapshot=()=>page.eval(snapshotExpression);
  await page.hover(1,1);await wait(180);
  const before=await snapshot();
  for(const target of ['first','second','third','last','control','shadowFirst','shadowSecond','slottedFirst','slottedSecond','symbol','cssSymbol','vectorLabel','first']) {
    const point=await page.eval(`(()=>{const e=document.getElementById('${target}')||document.getElementById('shadowHost').shadowRoot.getElementById('${target}');const r=e.getBoundingClientRect();return{x:r.x+Math.min(10,r.width/2),y:r.y+r.height/2}})()`);
    await page.eval(`(()=>{globalThis.__textHoverFrames=[];const until=performance.now()+260;function sample(){globalThis.__textHoverFrames.push(${snapshotExpression});if(performance.now()<until)requestAnimationFrame(sample)}requestAnimationFrame(sample)})()`);
    await page.hover(point.x,point.y);
    await wait(300);
    const after=await snapshot();
    const frames=await page.eval('globalThis.__textHoverFrames');
    const hovered=await page.eval(`(document.getElementById('${target}')||document.getElementById('shadowHost').shadowRoot.getElementById('${target}')).matches(':hover')`);
    const changedFrame=frames.find(frame=>JSON.stringify(frame)!==JSON.stringify(before));
    checks.push({name:`${test.name}: brightness stays stable during native hover ${target}`,ok:hovered&&frames.length>1&&!changedFrame&&JSON.stringify(after)===JSON.stringify(before),before,after,samples:frames.length,changedFrame,status});
  }
  const events=await page.eval(`(${textHoverEvents.toString()})()`);
  for(const property of ['hoverStable','slotMutationStable','focusStable','mutationStable','insertionStable','artworkUpdateStable','keyboardControlStable','artworkPreserved'])checks.push({name:`${test.name}: ${property}`,ok:events[property],events,status});
  const linkPoint=await page.eval(`(()=>{const r=document.getElementById('stateLink').getBoundingClientRect();return{x:r.x+10,y:r.y+r.height/2}})()`);
  await page.eval(`document.activeElement.blur()`);await page.hover(1,1);await wait(150);
  const restingLink=await page.eval(`getComputedStyle(document.getElementById('stateLink')).color`);
  await page.hover(linkPoint.x,linkPoint.y);await wait(180);
  const activeLink=await page.eval(`({color:getComputedStyle(document.getElementById('stateLink')).color,hover:document.getElementById('stateLink').matches(':hover')})`);
  await page.hover(1,1);await wait(180);
  const restoredLink=await page.eval(`getComputedStyle(document.getElementById('stateLink')).color`);
  checks.push({name:`${test.name}: genuine authored hover still changes and restores text`,ok:activeLink.hover&&activeLink.color!==restingLink&&restoredLink===restingLink,restingLink,activeLink,restoredLink,status});
  if(test.mode==='recolor'||test.original==='light'){
    const restingPanel=await page.eval(`getComputedStyle(document.getElementById('stateCopy')).color`);
    const point=await page.eval(`(()=>{const r=document.getElementById('stateCopy').getBoundingClientRect();return{x:r.x+10,y:r.y+r.height/2}})()`);
    await page.hover(point.x,point.y);await wait(250);
    const activePanel=await page.eval(`getComputedStyle(document.getElementById('stateCopy')).color`);
    await page.hover(1,1);await wait(250);
    const restoredPanel=await page.eval(`getComputedStyle(document.getElementById('stateCopy')).color`);
    checks.push({name:`${test.name}: a genuinely darkened hover backdrop remeasures its original text`,ok:activePanel!==restingPanel&&restoredPanel===restingPanel,restingPanel,activePanel,restoredPanel,status});
  }
  await options.eval('chrome.storage.sync.set({extensionEnabled:false})');await wait(450);
  const original=await snapshot(),expected=test.original==='light'?'rgb(85, 85, 85)':'rgb(34, 34, 34)';
  checks.push({name:`${test.name}: disabling restores authored text and vector ink`,ok:ids.every(id=>original[id]===(id.startsWith('slotted')?'rgb(34, 34, 34)':['symbol','cssSymbol','vectorLabel'].includes(id)?expected+';none':expected)),original,expected,status});
  }
  if(!process.env.OLED_TEXT_HOVER_CASE&&!process.env.OLED_INK_LOCALITY_ONLY)for(const host of ['mail.google.com','hover-fixture.invalid']){
    if(process.env.OLED_REPLY_TYPING_CASE&&!host.includes(process.env.OLED_REPLY_TYPING_CASE))continue;
    const pairs=[];
    for(const [index,order] of [[true,false],[false,true],[true,false]].entries()){
      const editable=host==='mail.google.com'?'true':index===1?'plaintext-only':'';
      const pair={editable};
      for(const active of order){
        await options.eval(`chrome.storage.sync.set(${JSON.stringify({extensionEnabled:active,brightness:88,appearance:'oled',siteRules:{[host]:host==='mail.google.com'?'global':'recolor'}})})`);
        await page.go(`https://${host}/oled-night-synthetic-reply`);await wait(450);
        await page.eval(`(()=>{const rows=Array.from({length:1500},(_,i)=>'<p><span>Synthetic message '+i+'</span></p>').join('');const history=document.createElement('div');history.id='replyHistory';history.innerHTML=rows;document.body.prepend(history);const box=document.createElement('div');box.className='a3s';box.innerHTML='<div id="replyEditor" role="textbox" aria-label="Synthetic reply" contenteditable="true" style="min-height:60px"><div id="replyDraft"></div><span id="replyFlag">Draft state</span><blockquote id="replyQuote">'+rows+'</blockquote></div>';document.body.prepend(box);const style=document.createElement('style');style.textContent='#replyFlag{background:#ffeedd;color:#111}#replyEditor:has(#replyDraft:empty) #replyFlag{background:#aaddff}';document.head.append(style)})()`);
        await page.eval(`document.getElementById('replyEditor').setAttribute('contenteditable',${JSON.stringify(editable)})`);
        await wait(650);
        const enabled=await page.eval(`document.documentElement.hasAttribute('data-oled-night-root')`);
        assert.equal(enabled,active,'typing comparison must use the intended extension state');
        await page.eval(`(${startReplyTyping.toString()})()`);await wait(500);
        const expected='Synthetic reply text. '.repeat(3).trimEnd();
        const deliveries=[];
        for(const char of expected){
          const dispatched=performance.now();
          await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:char},page.sessionId);
          await browser.send('Input.insertText',{text:char},page.sessionId);deliveries.push(performance.now()-dispatched);await wait(25);
          await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:char},page.sessionId);
        }
        await wait(50);
        pair[active?'active':'native']=await page.eval('globalThis.__replyTyping.finish()');
        const sorted=deliveries.sort((a,b)=>a-b);pair[active?'active':'native'].deliveryP95=sorted[Math.ceil(sorted.length*.95)-1];
        checks.push({name:`${host}: ${active?'enabled':'disabled'} native reply input is preserved`,ok:pair[active?'active':'native'].text==='Draft:'+expected&&pair[active?'active':'native'].inputs===expected.length,detail:pair[active?'active':'native']});
        if(active){
          const state=await page.eval(`(async()=>{const flag=document.getElementById('replyFlag'),draft=document.getElementById('replyDraft'),before=getComputedStyle(flag).backgroundColor;draft.textContent='';document.getElementById('replyEditor').dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'deleteContentBackward'}));await new Promise(resolve=>setTimeout(resolve,800));return{before,after:getComputedStyle(flag).backgroundColor,empty:!draft.textContent}})()`);
          checks.push({name:`${host}: rich editor descendant state converges after typing pauses`,ok:state.empty&&state.before!==state.after&&state.after.match(/[\d.]+/g).slice(0,3).every(value=>Number(value)<128),state});
        }
      }
      pairs.push(pair);
    }
    checks.push({name:`${host}: reply typing stays responsive without repeatedly measuring message history`,ok:pairs.every(pair=>pair.active.latencies.length===pair.active.inputs&&pair.active.p95<=pair.native.p95+33&&pair.active.deliveryP95<=pair.native.deliveryP95+33&&Math.max(0,...pair.active.longTasks)<150&&pair.active.repeatedMeasurements===0&&pair.active.subtreeSwitches===0),pairs});
  }
  if(!process.env.OLED_TEXT_HOVER_CASE&&!process.env.OLED_REPLY_TYPING_ONLY&&!process.env.OLED_REPLY_TYPING_CASE)for(const appearance of ['oled','soft']){
    await options.eval(`chrome.storage.sync.set(${JSON.stringify({extensionEnabled:true,appearance,brightness:88,siteRules:{'hover-fixture.invalid':'recolor'}})})`);
    await page.go('https://hover-fixture.invalid/oled-night-synthetic-ink-locality');await wait(700);
    assert.equal(await page.eval(`document.documentElement.getAttribute('data-oled-night-mode')`),appearance);
    const result=await page.eval(`(${inkLocalityScenario.toString()})()`);
    for(const property of ['paddingStable','ownedColorChanges','localMeasurements','inheritedStable'])checks.push({name:`${appearance}: owned and inherited ink ${property}`,ok:result[property],result});
  }
  if(!process.env.OLED_TEXT_HOVER_CASE&&!process.env.OLED_REPLY_TYPING_ONLY&&!process.env.OLED_INK_LOCALITY_ONLY&&(!process.env.OLED_REPLY_TYPING_CASE||process.env.OLED_REPLY_TYPING_CASE==='dark-layout'))await darkLayoutScenario(browser,options,page,checks);
  assert.deepEqual(requestErrors,[]);
  assert.deepEqual(browser.errors,[]);
  assert(checks.length>0,'at least one text-hover case must run');
}finally{if(browser)await browser.close()}
mkdirSync(join(root,'dist/lab-results'),{recursive:true});
writeFileSync(join(root,'dist/lab-results/text-hover-chrome.json'),JSON.stringify({engine:'Chrome',browser:browserVersion.product,version,sha,runtimeHash,checkedAt:new Date().toISOString(),completed:true,candidate:!!(process.env.OLED_TEXT_HOVER_CASE||process.env.OLED_REPLY_TYPING_ONLY||process.env.OLED_REPLY_TYPING_CASE||process.env.OLED_INK_LOCALITY_ONLY),fixtures:['text-hover.html','ink-locality.html','dark-layout.html'],modes:['automatic','recolor','deepen','oled','soft','brightness50'],states:['rest','pointer-frames','focus','mutation','slot-update','insert','authored-hover','disabled','reply-typing','ancestor-locality','native-dark-layout'],checks:checks.map(check=>({...check,coverage:check.name.endsWith('artworkPreserved')?'media':'text'}))},null,2));
for(const check of checks)console.log(`${check.ok?'PASS':'FAIL'} ${check.name}${check.ok?'':' '+JSON.stringify(check)}`);
console.log(`${checks.filter(check=>check.ok).length}/${checks.length} text hover checks passed (${version})`);
process.exitCode=checks.some(check=>!check.ok)?1:0;
