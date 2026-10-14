import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
export function summarizeLive(input,synthetic){
  const checks=(input.checks||[]).filter(c=>c.name?.startsWith('www.cvs.com '));
  const failed=checks.filter(c=>c.kind==='regression'&&c.ok===false).length;
  const tested=checks.some(c=>c.kind==='site'&&c.ok)&&checks.some(c=>c.kind==='regression')&&!checks.some(c=>c.kind==='unverified'&&c.ok===false);
  const sc=synthetic?.checks||[],sf=sc.filter(c=>c.ok===false).length;
  const stress={sha:synthetic?.sha,checkedAt:synthetic?.checkedAt,status:sf?'fail':sc.length?'pass':'unverified',failed:sf,passed:sc.filter(c=>c.ok===true).length};
  return {sha:input.sha,version:input.version,checkedAt:input.checkedAt,status:failed?'fail':tested?'pass':'unverified',failed,hoverChecks:checks.filter(c=>c.kind==='regression').length,synthetic:stress,knownIssue:'Late-root interaction fix ships in 0.6.37. Earlier failures remain recorded; each receipt describes only its tested version and run.',coverage:'Anonymous public CVS, repeated real pointer moves; completed-frame CSS samples, not every-frame pixel/video proof.',runUrl:process.env.GITHUB_RUN_ID?`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const root=resolve(import.meta.dirname,'..'),live=join(root,'dist/lab-results/live-smoke.json'),stress=join(root,'dist/lab-results/cvs-stress.json');
  const input=existsSync(live)?JSON.parse(readFileSync(live)): {checks:[]};
  const synthetic=existsSync(stress)?JSON.parse(readFileSync(stress)):undefined;
  if(synthetic&&input.sha&&input.sha!==synthetic.sha)throw Error('CVS reports must verify the same source');
  writeFileSync(join(root,'dist/site/lab/live-results.json'),JSON.stringify(summarizeLive(input,synthetic),null,2));
}
