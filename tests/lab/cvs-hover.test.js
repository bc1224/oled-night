const assert=require('node:assert/strict');
(async()=>{
  const {cases}=await import('./catalog.mjs');
  const entry=cases.find(c=>c.id==='cvs-hover');
  assert(entry,'the reported CVS flash must have its own browsable lab case');
  assert(entry.limit.includes('does not guarantee every live page state'),'synthetic coverage must retain its live coverage limit');
  const {summarizeLive}=await import('../../tools/live-report.mjs');
  const report=summarizeLive({sha:'a'.repeat(40),version:'0.6.36',checkedAt:'2026-10-13T00:00:00Z',checks:[
    {name:'www.cvs.com site',kind:'site',ok:true},
    {name:'www.cvs.com navigation hover 1',kind:'regression',ok:false,detail:'PRIVATE PAGE TEXT'}
  ]});
  assert.equal(report.status,'fail');assert.equal(report.failed,1);
  const stress=summarizeLive({checks:[]},{sha:'a'.repeat(40),checks:[{ok:true},{ok:false,detail:'PRIVATE SYNTHETIC DETAIL'}]});
  assert.equal(stress.synthetic.status,'fail');
  assert.equal(stress.synthetic.failed,1);
  assert.equal(stress.synthetic.passed,1);
  assert(!JSON.stringify(stress).includes('PRIVATE SYNTHETIC DETAIL'));
  assert(!JSON.stringify(report).includes('PRIVATE PAGE TEXT'),'public receipts only contain allowlisted summaries');
  assert.equal(summarizeLive({checks:[{name:'www.cvs.com availability',kind:'unverified',ok:false}]}).status,'unverified');
  assert.equal(summarizeLive({checks:[{name:'www.cvs.com site',kind:'site',ok:true},{name:'www.cvs.com navigation hover 1',kind:'regression',ok:true},{name:'www.cvs.com live smoke',kind:'unverified',ok:false}]}).status,'unverified','an interrupted run cannot report a live pass');
  console.log('PASS CVS case keeps live failures visible, coverage limited and receipts private');
})().catch(e=>{console.error(e);process.exitCode=1});
