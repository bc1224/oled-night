const assert=require('node:assert/strict');
(async()=>{
  const {validateReportGate:v,validateReviewArtifact:reviewGate}=await import('../tools/report-release-gate.mjs');
  const p={schema:'oled-auto-release-v1',repo:'bc1224/oled-night',sha:'a'.repeat(40),base:'b'.repeat(40),issue:123,fixture:'email-newsletter',files:['content.js','manifest.json','tests/lab/mixed-surface-scenario.mjs'],permissionsChanged:false,dependenciesChanged:false,reproduction:{baseExit:1,fixedExit:0},review:{verdict:'accept',sha:'a'.repeat(40),independent:true,profile:'review',model:'gpt-6-luna',receiptHash:'c'.repeat(64)},ci:{sha:'a'.repeat(40),conclusion:'success',runId:123}};
  assert.equal(v(p),true);
  const binding={sha:p.sha,base:p.base,tree:'e'.repeat(40),model:'gpt-6-luna',profile:'review',independent:true};
  const artifact={verdict:'accept',summary:'OLED-REVIEW '+JSON.stringify(binding)+'\nAccepted after independent inspection.',findings:[]};
  assert.equal(reviewGate(artifact,{...p,tree:binding.tree}),true);
  assert.throws(()=>reviewGate({verdict:'accept'},{...p,tree:binding.tree}),'bare accept artifact must be blocked');
  for(const patch of [{sha:'f'.repeat(40)},{model:'other'},{tree:'f'.repeat(40)},{independent:false}])
    assert.throws(()=>reviewGate({...artifact,summary:'OLED-REVIEW '+JSON.stringify({...binding,...patch})+'\nAccepted.'},{...p,tree:binding.tree}));
  for(const patch of [{reproduction:{baseExit:0,fixedExit:0}},{files:['.github/workflows/test.yml']},{files:['tests/lab/../../tools/submit-stores.mjs']},{files:['tests/lab/baselines/linux/chrome.png']},{permissionsChanged:true},{review:{...p.review,verdict:'reject'}},{review:{...p.review,sha:'d'.repeat(40)}},{review:{...p.review,model:'unauthorized-model'}},{ci:{...p.ci,conclusion:'failure'}},{repo:'other/project'}])assert.throws(()=>v({...p,...patch}));
  console.log('PASS automatic release refuses missing reproduction, review, exact CI or out-of-scope changes');
})().catch(e=>{console.error(e);process.exitCode=1});
