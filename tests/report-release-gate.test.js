const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
(async()=>{
  const {validateReportGate:v,validateReproductionArtifacts:proofGate,validateReviewArtifact:reviewGate}=await import('../tools/report-release-gate.mjs');
  const {runtimeDigest,regressionChecks}=await import('../tests/lab/runtime-proof.mjs');
  const p={schema:'oled-auto-release-v2',repo:'bc1224/oled-night',sha:'a'.repeat(40),base:'b'.repeat(40),issue:123,fixture:'email-newsletter',files:['content.js','manifest.json','tests/lab/mixed-surface-scenario.mjs'],permissionsChanged:false,dependenciesChanged:false,reproduction:{browsers:[]},review:{verdict:'accept',sha:'a'.repeat(40),independent:true,profile:'review',model:'gpt-6-luna',receiptHash:'c'.repeat(64)},ci:{sha:'a'.repeat(40),conclusion:'success',runId:123}};
  // Synthetic validator unit inputs, not claimed browser reproduction evidence.
  const bytes=new Map(), hash=data=>createHash('sha256').update(data).digest('hex');
  const sourceDigest=sha=>hash('unit-source-'+sha);
  for(const engine of ['Chrome','Firefox']) {
    const browser={engine,check:'newsletter title contrast'};
    for(const stage of ['base','fixed']) {
      const sha=stage==='base'?p.base:p.sha;
      const report={engine,sha,runtimeHash:sourceDigest(sha),completed:true,checks:regressionChecks(p.fixture,true,[{name:browser.check,ok:stage==='fixed'}])};
      const data=Buffer.from(JSON.stringify(report)),path=join(tmpdir(),'oled-unit-'+engine+'-'+stage+'.json');
      bytes.set(path,data);browser[stage]={path,hash:hash(data)};
    }
    p.reproduction.browsers.push(browser);
  }
  const dependencies={read:path=>{if(!bytes.has(path))throw Error('missing file');return bytes.get(path)},sourceDigest};
  assert.equal(v(p),true);
  assert.throws(()=>v({...p,reproduction:{baseExit:1,fixedExit:0}}),'per-browser retained proof is mandatory');
  assert.equal(proofGate(p,dependencies),true);
  for(const engine of ['Chrome','Firefox']) for(const stage of ['base','fixed']) {
    const original=p.reproduction.browsers.find(b=>b.engine===engine)[stage];
    const valid=bytes.get(original.path);
    const failReport=change=>{
      const candidate=JSON.parse(JSON.stringify(p));
      const proof=candidate.reproduction.browsers.find(b=>b.engine===engine)[stage];
      const report=JSON.parse(valid);change(report);
      const data=Buffer.from(JSON.stringify(report));bytes.set(proof.path,data);proof.hash=hash(data);
      assert.throws(()=>proofGate(candidate,dependencies));bytes.set(original.path,valid);
    };
    for(const change of [r=>r.completed=false,r=>r.engine='other',r=>r.sha='f'.repeat(40),r=>r.runtimeHash='f'.repeat(64),r=>r.candidate=true,r=>r.checks=[],r=>r.checks[0].ok=false,r=>r.checks[1].fixture='wrong-fixture',r=>r.checks[1].name='wrong assertion',r=>r.checks[1].ok=stage==='base',r=>r.checks.push({...r.checks[1]}),r=>r.checks.push({name:'browser launch failed',ok:false}),r=>r.checks[1].ok='false']) failReport(change);
    for (const fixture of [p.fixture, 'other-fixture'])
      failReport(r=>r.checks.push({name:'another broken assertion',ok:false,kind:'assertion',fixture}));
    const corrupt=JSON.parse(JSON.stringify(p));corrupt.reproduction.browsers.find(b=>b.engine===engine)[stage].hash='f'.repeat(64);
    assert.throws(()=>proofGate(corrupt,dependencies));
    bytes.delete(original.path);assert.throws(()=>proofGate(p,dependencies));bytes.set(original.path,valid);
  }
  assert.throws(()=>v({...p,reproduction:{browsers:[p.reproduction.browsers[0],p.reproduction.browsers[0]]}}));
  assert.throws(()=>v({...p,schema:'oled-auto-release-v1'}));
  assert.equal(runtimeDigest(()=>"const x=1;\r\n"),runtimeDigest(()=>"const x=1;\n"));
  assert.notEqual(runtimeDigest(()=>"const x=1;\n"),runtimeDigest(()=>"const x=2;\n"));
  const binding={sha:p.sha,base:p.base,tree:'e'.repeat(40),model:'gpt-6-luna',profile:'review',independent:true};
  const artifact={verdict:'accept',summary:'OLED-REVIEW '+JSON.stringify(binding)+'\nAccepted after independent inspection.',findings:[]};
  assert.equal(reviewGate(artifact,{...p,tree:binding.tree}),true);
  assert.throws(()=>reviewGate({verdict:'accept'},{...p,tree:binding.tree}),'bare accept artifact must be blocked');
  for(const patch of [{sha:'f'.repeat(40)},{model:'other'},{tree:'f'.repeat(40)},{independent:false}])
    assert.throws(()=>reviewGate({...artifact,summary:'OLED-REVIEW '+JSON.stringify({...binding,...patch})+'\nAccepted.'},{...p,tree:binding.tree}));
  for(const patch of [{reproduction:{baseExit:0,fixedExit:0}},{files:['.github/workflows/test.yml']},{files:['tests/lab/../../tools/submit-stores.mjs']},{files:['tests/lab/baselines/linux/chrome.png']},{permissionsChanged:true},{review:{...p.review,verdict:'reject'}},{review:{...p.review,sha:'d'.repeat(40)}},{review:{...p.review,model:'unauthorized-model'}},{ci:{...p.ci,conclusion:'failure'}},{repo:'other/project'}])assert.throws(()=>v({...p,...patch}));
  console.log('PASS automatic release refuses missing reproduction, review, exact CI or out-of-scope changes');
})().catch(e=>{console.error(e);process.exitCode=1});
