import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function assertPassingTests(runs, sha) {
  const run=runs.find(r=>r.name==='Tests'&&r.head_sha===sha&&r.event==='push'&&r.head_branch==='main'&&r.status==='completed'&&r.conclusion==='success');
  if(!run)throw Error(`No passing main-branch Tests receipt for exact source ${sha}. Store submission is blocked.`);
  return run;
}
export function assertLabEvidence(artifacts){
  if(!artifacts.some(a=>a.name==='oled-night-lab-evidence'&&!a.expired))throw Error('No retained lab evidence. Legacy tests alone cannot authorize a release; run the current test policy.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const repo=process.env.GITHUB_REPOSITORY||'bc1224/oled-night';
  const data=JSON.parse(execFileSync('gh',['api',`repos/${repo}/actions/workflows/test.yml/runs?head_sha=${sha}&per_page=100`],{encoding:'utf8'}));
  const run=assertPassingTests(data.workflow_runs,sha);
  const artifacts=JSON.parse(execFileSync('gh',['api',`repos/${repo}/actions/runs/${run.id}/artifacts`],{encoding:'utf8'}));assertLabEvidence(artifacts.artifacts);
  console.log(`Release gate passed: ${run.html_url}`);
}
