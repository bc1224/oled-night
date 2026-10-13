import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),directory=join(root,'dist/lab-results');
const reports=['chrome','firefox'].map(name=>JSON.parse(readFileSync(join(directory,name+'.json'))));
if(reports.some(r=>r.candidate||r.checks.some(c=>!c.ok)))throw Error('Failed or candidate runs cannot become a public passing receipt');
if(reports[0].sha!==reports[1].sha||reports[0].version!==reports[1].version)throw Error('Browser reports must verify the same source and version');
const checks=reports.flatMap(r=>r.checks),report={sha:reports[0].sha,version:reports[0].version,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length,engines:reports.map(r=>({name:r.engine,passed:r.checks.length})),runUrl:process.env.GITHUB_RUN_ID?`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null,coverage:'Synthetic component states; existing site regressions are separate CI checks. Public live-site checks are separate and can be blocked by providers.'};
mkdirSync(join(root,'dist/site/lab'),{recursive:true});writeFileSync(join(root,'dist/site/lab/results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
