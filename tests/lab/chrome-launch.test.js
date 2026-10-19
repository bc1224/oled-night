const assert=require('node:assert/strict');
(async()=>{
  const {chromeTestArgs}=await import('./chrome-launch.mjs');
  assert.deepEqual(chromeTestArgs(['--headless=new'],{platform:'win32',sandbox:'mxc'}),['--headless=new','--no-sandbox']);
  assert.deepEqual(chromeTestArgs(['--headless=new'],{platform:'win32',sandbox:''}),['--headless=new']);
  assert.deepEqual(chromeTestArgs(['--headless=new'],{platform:'linux',sandbox:'mxc'}),['--headless=new']);
  const {shouldRunReportBaseline,validateBaselineSpec,validateBaselineReport,validateBaselineChildResult}=await import('./report-baseline.mjs');
  assert.equal(shouldRunReportBaseline({githubActions:'true',hasSpec:true,packageRoot:''}),true);
  assert.equal(shouldRunReportBaseline({githubActions:'true',hasSpec:false,packageRoot:''}),false);
  assert.equal(shouldRunReportBaseline({githubActions:'false',hasSpec:true,packageRoot:''}),false);
  assert.equal(shouldRunReportBaseline({githubActions:'true',hasSpec:true,packageRoot:'/base'}),false);
  const spec={base:'4f1deb9a7640dc69e07fc16caf7117614e7b7469',fixture:'wide-wordmarks',check:'Compact navigation graphics stay readable through state and animation updates'};
  assert.deepEqual(validateBaselineSpec(spec,new Set(['wide-wordmarks'])),spec);
  const report={engine:'Chrome',completed:true,sha:spec.base,runtimeHash:'a'.repeat(64),checks:[
    {fixture:spec.fixture,kind:'activation',name:'extension active',ok:true},
    {fixture:spec.fixture,kind:'assertion',name:spec.check,ok:false}
  ]};
  assert.equal(validateBaselineReport(report,spec,'Chrome','a'.repeat(64)),true);
  assert.equal(validateBaselineChildResult({status:1}),true);
  for(const result of [{status:0},{status:null,error:Error('timeout')},{status:2}])assert.throws(()=>validateBaselineChildResult(result));
  for(const mutation of [
    r=>r.checks.push({fixture:spec.fixture,kind:'assertion',name:'extra',ok:false}),
    r=>r.checks.push({name:'execution',kind:'infrastructure',ok:false}),
    r=>{r.checks[1].ok=true},r=>{r.sha='f'.repeat(40)},r=>{r.runtimeHash='b'.repeat(64)},r=>{r.checks[0].ok=false},
    r=>{r.candidate=true},r=>{r.checks[1].kind='infrastructure'},r=>{r.checks[1].name='wrong assertion'}
  ]){const bad=structuredClone(report);mutation(bad);assert.throws(()=>validateBaselineReport(bad,spec,'Chrome','a'.repeat(64)))}
  assert.throws(()=>validateBaselineSpec({...spec,check:' '},new Set(['wide-wordmarks'])));
  assert.throws(()=>validateBaselineSpec({...spec,base:'f'.repeat(40)},new Set(['wide-wordmarks'])));
  console.log('PASS Chrome sandbox opt-in and immutable report-baseline acceptance contract');
})().catch(e=>{console.error(e);process.exitCode=1});
