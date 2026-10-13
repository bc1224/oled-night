const assert = require('node:assert/strict');
(async()=>{
  const {assertPassingTests,assertLabEvidence}=await import('../../tools/verify-release-gate.mjs');
  const sha='a'.repeat(40);
  const run={name:'Tests',head_sha:sha,event:'push',head_branch:'main',status:'completed',conclusion:'success',html_url:'https://github.com/bc1224/oled-night/actions/runs/123'};
  assert.equal(assertPassingTests([run],sha).html_url,run.html_url);
  assert.throws(()=>assertPassingTests([{...run,head_sha:'b'.repeat(40)}],sha),/No passing/);
  assert.throws(()=>assertPassingTests([{...run,conclusion:'failure'}],sha),/No passing/);
  assert.throws(()=>assertPassingTests([{...run,event:'pull_request'}],sha),/No passing/);
  assert.throws(()=>assertPassingTests([{...run,name:'Submit browser stores'}],sha),/No passing/);
  assertLabEvidence([{name:'oled-night-lab-evidence',expired:false}]);
  assert.throws(()=>assertLabEvidence([]),/lab evidence/);
  assert.throws(()=>assertLabEvidence([{name:'oled-night-lab-evidence',expired:true}]),/lab evidence/);
  console.log('PASS release gate rejects missing, failed, untrusted or different-source test receipts');
})().catch(e=>{console.error(e);process.exitCode=1});
