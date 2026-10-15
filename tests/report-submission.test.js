const assert=require('node:assert/strict');require('../report-utils.js');
(async()=>{
 const calls=[];let consent;const raw={host:'example.com',version:'0.6.41',text:'PRIVATE'};
 const session=OledNightReport.createSubmissionSession(raw,{requestConsent:()=>new Promise(r=>consent=r),submit:async payload=>{calls.push(payload);return {url:'https://github.com/bc1224/oled-night/issues/123'}}});
 const first=session.send('A control is unreadable');assert.equal(await session.send('duplicate'),false);session.cancel();consent(true);assert.equal(await first,false);assert.equal(calls.length,0);
 const next=OledNightReport.createSubmissionSession(raw,{submit:async payload=>{calls.push(payload);return {url:'https://github.com/bc1224/oled-night/issues/123'}}});
 assert.deepEqual(await next.send('A control is unreadable'),{url:'https://github.com/bc1224/oled-night/issues/123'});assert.equal(await next.send(),false);assert.equal(calls.length,1);assert(!JSON.stringify(calls).includes('PRIVATE'));assert.equal(calls[0].description,'A control is unreadable');assert.match(calls[0].requestId,/^[a-f0-9-]{36}$/i);
 let fail=true;const ids=[];const retry=OledNightReport.createSubmissionSession(raw,{submit:async p=>{ids.push(p.requestId);if(fail)throw Error('offline');return {url:'https://github.com/bc1224/oled-night/issues/124'}}});
 await assert.rejects(retry.send('test'),/offline/);fail=false;await retry.send('changed text');assert.equal(ids[0],ids[1],'retry uses the same idempotency key');
 console.log('PASS direct reporting submits scrubbed diagnostics once, honors cancellation and retries with a stable ID');
})().catch(e=>{console.error(e);process.exitCode=1});
