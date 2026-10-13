import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {launchChrome,wait} from './browser.mjs';
import {smokePassed,navigationPaint,sampleNavigationPaint} from './smoke-policy.mjs';
const root=resolve(import.meta.dirname,'../..'),out=join(root,'dist/lab-results');mkdirSync(out,{recursive:true});const checks=[];let browser;
// Anonymous public pages only. No transferred sign-ins, reports, text captures or screenshots.
try{browser=await launchChrome();await browser.send('Extensions.loadUnpacked',{path:join(process.env.OLED_LAB_PACKAGE_ROOT||root,'dist/chrome')});
  for(const url of ['https://www.apple.com/','https://www.cvs.com/','https://www.amazon.com/s?k=hawaiian+shirt','https://www.reddit.com/r/movies/']){
    const host=new URL(url).hostname;let tab;
    try{tab=await browser.open(url);await wait(3000);const ready=await tab.eval(`({active:document.documentElement.hasAttribute('data-oled-night-root'),blocked:/captcha|access denied|robot check|just a moment|blocked|unusual traffic/i.test(document.title),ready:document.querySelectorAll('a,button').length>10})`);
      if(!ready.active||ready.blocked||!ready.ready){checks.push({name:host+' live availability',kind:ready.ready&&!ready.blocked&&!ready.active?'regression':'unverified',ok:false,detail:'Unavailable, challenged, or extension inactive. Requires live verification; never counted as a pass.'});continue}
      const targets=await tab.eval(`(()=>{const all=root=>[...root.querySelectorAll('*')].flatMap(e=>e.shadowRoot?[e,...all(e.shadowRoot)]:[e]);return all(document).filter(e=>e.matches('nav a,header a,[role=navigation] a')&&e.getClientRects().length&&e.textContent.trim()&&!e.querySelector('img,svg')).slice(0,5).map(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}}).filter(p=>p.x>0&&p.x<innerWidth&&p.y>0&&p.y<innerHeight)})()`);
      if(!targets.length){checks.push({name:host+' navigation targets',kind:'unverified',ok:false,detail:'No testable navigation control; manual verification required.'});continue}
      checks.push({name:host+' extension active with testable navigation',kind:'site',ok:true});
      for(let i=0;i<targets.length;i++){const p=targets[i];await tab.hover(p.x,p.y);await wait(200);const r=await tab.eval(`(${sampleNavigationPaint.toString()})(${JSON.stringify(p)},(${navigationPaint.toString()}))`);checks.push({name:host+' navigation hover '+(i+1),kind:'regression',ok:!r.pale,detail:r.pale?'Pale control background detected in a completed frame':'No pale control background in '+r.samples+' completed frames'})}
    }catch{checks.push({name:host+' live smoke',kind:'unverified',ok:false,detail:'Page or inspection unavailable; manual verification required.'})}finally{if(tab)await browser.send('Target.closeTarget',{targetId:tab.targetId})}
  }
}finally{await browser?.close()}
writeFileSync(join(out,'live-smoke.json'),JSON.stringify({engine:'Live public Chrome smoke',gatePassed:smokePassed(checks),checks},null,2));for(const c of checks)console.log(`${c.ok?'PASS':c.kind==='unverified'?'UNVERIFIED':'FAIL'} ${c.name}: ${c.detail||''}`);if(!smokePassed(checks))process.exitCode=1;
