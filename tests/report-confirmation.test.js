const assert=require('node:assert/strict');require('../report-utils.js');
(async()=>{
 const report={host:'example.com',version:'0.6.39',text:'PRIVATE'},opened=[];
 let consent;const session=OledNightReport.createDraftSession(report,{requestConsent:()=>new Promise(r=>consent=r),openTab:tab=>opened.push(tab)});
 assert.equal(opened.length,0,'preview sends nothing');
 const first=session.send();assert.equal(await session.send(),false,'double-click cannot start another request');
 session.cancel();consent(true);assert.equal(await first,false,'cancel while consent pending prevents sharing');assert.equal(opened.length,0);
 const next=OledNightReport.createDraftSession(report,{requestConsent:()=>true,openTab:tab=>opened.push(tab)});
 assert.equal(await next.send(),true);assert.equal(await next.send(),false);assert.equal(opened.length,1);assert.ok(!opened[0].url.includes('PRIVATE'));
 let approved=false;const denied=OledNightReport.createDraftSession(report,{requestConsent:()=>approved,openTab:tab=>opened.push(tab)});
 assert.equal(await denied.send(),false);assert.equal(opened.length,1);approved=true;assert.equal(await denied.send(),true);
 let failed=true;const retry=OledNightReport.createDraftSession(report,{openTab:tab=>{if(failed)throw Error('Unavailable');opened.push(tab)}});
 await assert.rejects(retry.send(),/Unavailable/);failed=false;assert.equal(await retry.send(),true);assert.equal(await retry.send(),false);
 console.log('PASS report confirmation sends at most once and cancellation prevents pending sharing');
})().catch(e=>{console.error(e);process.exitCode=1});
