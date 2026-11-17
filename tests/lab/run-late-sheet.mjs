// A page sheet that a script inserts before content and the network answers
// later (a wiki skin). Whether the sheet arrives before, during or after the
// content, and whether it takes the narrow recheck or the whole-page path,
// the finished page must match a page that linked the sheet from the start.
import {resolve,join} from 'node:path';
import {serveLab} from './server.mjs';
import {launchChrome,wait} from './browser.mjs';
const root=resolve(import.meta.dirname,'../..'),server=await serveLab(join(root,'tests/e2e/site'));
const extension=process.env.EXT_PATH||join(root,'dist/chrome');
const rows=process.env.LATE_ROWS||3000;
// [label, path]. /stream/<ms>/ pauses the document before its rows.
const cases=[
 ...['0','60','150','300','600','1200'].map(ms=>[`script-inserted sheet answered after ${ms} ms`,`/late-sheet.html?ms=${ms}`]),
 ...['0','300','1200'].map(ms=>[`sheet answered after ${ms} ms while the document streams for 600 ms`,`/stream/600/late-sheet.html?ms=${ms}`]),
];
const quiet=`new Promise(resolve=>{let timer;const finish=ok=>{clearTimeout(timer);clearTimeout(deadline);observer.disconnect();resolve(ok)},arm=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(true),400)},observer=new MutationObserver(records=>{if(records.some(r=>r.attributeName?.startsWith('data-oled-night')))arm()}),deadline=setTimeout(()=>finish(false),15000);observer.observe(document.documentElement,{attributes:true,subtree:true});arm()})`;
const snapshot=`(()=>{const out=[];const add=e=>{if(e.localName==='script'||e.localName==='style')return;const c=getComputedStyle(e);out.push([e.localName+(e.className&&typeof e.className==='string'?'.'+e.className.split(' ')[0]:''),c.color,c.backgroundColor,c.webkitTextFillColor,c.borderTopColor].join('|'))};
 for(const e of document.querySelectorAll('html, body, body *')){add(e);if(e.shadowRoot)for(const s of e.shadowRoot.querySelectorAll('*'))add(s)}return out})()`;
let b;const checks=[];
try{
 b=await launchChrome();await b.send('Extensions.loadUnpacked',{path:extension});await wait(500);
 const page=await b.open('about:blank');
 // The shadow style leaves after 900 ms; wait past it and the slowest sheet.
 const load=async path=>{await page.go(`${server.origin}${path}${path.includes('?')?'&':'?'}rows=${rows}`);await wait(1900);const settled=await page.eval(quiet);return{settled,snap:await page.eval(snapshot)}};
 const ref=await load('/late-sheet.html?ms=ref');
 for(const [label,path] of cases){
  const run=await load(path);
  const diff=run.snap.flatMap((line,i)=>line===ref.snap[i]?[]:[`${i}: ${ref.snap[i]} -> ${line}`]);
  checks.push({name:`${label}: the finished page matches a page that had the sheet from the start`,ok:run.settled&&run.snap.length===ref.snap.length&&!diff.length,detail:JSON.stringify({settled:run.settled,elements:run.snap.length,mismatches:diff.length,first:diff.slice(0,3)})});
 }
}finally{await b?.close();await server.close()}
console.log(JSON.stringify(checks,null,1));
const failed=checks.filter(c=>!c.ok).length;console.log(`${checks.length-failed}/${checks.length} late stylesheet checks passed`);if(failed)process.exitCode=1;
