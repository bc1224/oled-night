import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
export function summarizeLive(input){
  const checks=(input.checks||[]).filter(c=>c.name?.startsWith('www.cvs.com '));
  const failed=checks.filter(c=>c.kind==='regression'&&c.ok===false).length;
  const tested=checks.some(c=>c.kind==='site'&&c.ok)&&checks.some(c=>c.kind==='regression')&&!checks.some(c=>c.kind==='unverified'&&c.ok===false);
  return {sha:input.sha,version:input.version,checkedAt:input.checkedAt,status:failed?'fail':tested?'pass':'unverified',failed,hoverChecks:checks.filter(c=>c.kind==='regression').length,knownIssue:'Intermittent CVS pale navigation hover remains unresolved. A passing run does not close the prior failure.',coverage:'Anonymous public CVS, repeated real pointer moves; completed-frame CSS samples, not every-frame pixel/video proof.',runUrl:process.env.GITHUB_RUN_ID?`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const root=resolve(import.meta.dirname,'..');writeFileSync(join(root,'dist/site/lab/live-results.json'),JSON.stringify(summarizeLive(JSON.parse(readFileSync(join(root,'dist/lab-results/live-smoke.json')))),null,2))}
