const assert=require('node:assert/strict');
(async()=>{
  const {chromeTestArgs}=await import('./chrome-launch.mjs');
  assert.deepEqual(chromeTestArgs(['--headless=new'],{platform:'win32',sandbox:'mxc'}),['--headless=new','--no-sandbox']);
  assert.deepEqual(chromeTestArgs(['--headless=new'],{platform:'win32',sandbox:''}),['--headless=new']);
  assert.deepEqual(chromeTestArgs(['--headless=new'],{platform:'linux',sandbox:'mxc'}),['--headless=new']);
  const {shouldRunReportBaseline,validateBaselineSpec,validateBaselineReport}=await import('./report-baseline.mjs');
  assert.equal(shouldRunReportBaseline({githubActions:'true',hasSpec:true,packageRoot:''}),true);
  assert.equal(shouldRunReportBaseline({githubActions:'true',hasSpec:false,packageRoot:''}),false);
  assert.equal(shouldRunReportBaseline({githubActions:'true',hasSpec:true,packageRoot:'/base'}),false);
  assert.equal(shouldRunReportBaseline({githubActions:'false',hasSpec:true,packageRoot:''}),false);
  const spec={base:'1602da939ec3f44e2ee2992fa6a64f04b4f1e9fa',fixture:'chatgpt-controls',check:'ChatGPT controls keep text and Stop icon readable'};
  assert.deepEqual(validateBaselineSpec(spec,new Set(['chatgpt-controls'])),spec);
  const report={engine:'Chrome',completed:true,sha:spec.base,runtimeHash:'a'.repeat(64),checks:[
    {fixture:spec.fixture,kind:'activation',name:'extension active',ok:true},
    {fixture:spec.fixture,kind:'assertion',name:spec.check,ok:false}
  ]};
  assert.equal(validateBaselineReport(report,spec,'Chrome','a'.repeat(64)),true);
  for(const mutation of [
    r=>r.checks.push({fixture:spec.fixture,kind:'assertion',name:'extra',ok:false}),
    r=>r.checks.push({name:'execution',kind:'infrastructure',ok:false}),
    r=>{r.checks[1].ok=true},r=>{r.sha='f'.repeat(40)},r=>{r.runtimeHash='b'.repeat(64)},r=>{r.checks[0].ok=false}
  ]){const bad=structuredClone(report);mutation(bad);assert.throws(()=>validateBaselineReport(bad,spec,'Chrome','a'.repeat(64)))}
  assert.throws(()=>validateBaselineSpec({...spec,check:' '},new Set(['chatgpt-controls'])));
  assert.throws(()=>validateBaselineSpec({...spec,base:'f'.repeat(40)},new Set(['chatgpt-controls'])));
  console.log('PASS Chrome sandbox opt-in and immutable report-baseline acceptance contract');
})().catch(e=>{console.error(e);process.exitCode=1});
