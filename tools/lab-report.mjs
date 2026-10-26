import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),directory=join(root,'dist/lab-results');
const names=['chrome','firefox','oled-components-chrome','oled-components-firefox','navigation-work-chrome','chatgpt-streaming-chrome','qa-interface','compact-switches-chrome','compact-switches-firefox','text-hover-chrome','text-hover-firefox'];
const reports=names.map(name=>JSON.parse(readFileSync(join(directory,name+'.json'))));
if(reports.some(r=>!r.completed||r.candidate||!r.checks.length||r.checks.some(c=>!c.ok)))throw Error('Incomplete, failed or candidate runs cannot become a public passing receipt');
if(reports.some(r=>r.sha!==reports[0].sha||r.version!==reports[0].version||r.runtimeHash!==reports[0].runtimeHash))throw Error('Browser reports must verify the same source, packaged runtime and version');
const checks=reports.flatMap(r=>r.checks),report={sha:reports[0].sha,version:reports[0].version,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length,engines:[...new Set(reports.map(r=>r.engine))].map(name=>({name,passed:reports.filter(r=>r.engine===name).reduce((sum,r)=>sum+r.checks.length,0)})),runUrl:process.env.GITHUB_RUN_ID?`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null,coverage:'Synthetic component states; existing site regressions are separate CI checks. Public live-site checks are separate and can be blocked by providers.'};
report.runtimeHash=reports[0].runtimeHash;
report.dimensions=Object.fromEntries(['text','media','selection','surface','performance'].map(dimension=>{
  const selected=checks.filter(c=>c.coverage===dimension);
  return [dimension,{passed:selected.filter(c=>c.ok).length,failed:selected.filter(c=>!c.ok).length,engines:[...new Set(reports.filter(r=>r.checks.some(c=>c.coverage===dimension)).map(r=>r.engine))]}];
}));
report.componentRuns=reports.slice(2).map(({engine,fixtures,modes,states,checkedAt})=>({engine,fixtures,modes,states,checkedAt}));
mkdirSync(join(root,'dist/site/lab'),{recursive:true});writeFileSync(join(root,'dist/site/lab/results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
