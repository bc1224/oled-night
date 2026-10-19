import {existsSync,mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {runtimeDigest} from './runtime-proof.mjs';

const BASE=/^[a-f0-9]{40}$/;
const IMMUTABLE_BASE='1780c923e100abe78fc75931504a044ce47db892';
export function shouldRunReportBaseline({githubActions=process.env.GITHUB_ACTIONS,hasSpec,packageRoot=process.env.OLED_LAB_PACKAGE_ROOT}={}){
  return githubActions==='true'&&hasSpec===true&&!packageRoot;
}
export function validateBaselineSpec(spec,catalogIds){
  if(!spec||typeof spec!=='object'||Array.isArray(spec)||Object.keys(spec).sort().join(',')!=='base,check,fixture'||
    !BASE.test(spec.base)||spec.base!==IMMUTABLE_BASE||typeof spec.fixture!=='string'||!catalogIds.has(spec.fixture)||
    typeof spec.check!=='string'||!spec.check.trim()||spec.check.length>240)throw Error('Invalid report reproduction specification');
  return spec;
}
export function validateBaselineReport(report,spec,engine,expectedRuntimeHash){
  if(!report||report.engine!==engine||report.completed!==true||report.sha!==spec.base||report.runtimeHash!==expectedRuntimeHash||
    report.candidate===true||report.baseline===true||!Array.isArray(report.checks))throw Error('Baseline report did not complete against the immutable packaged runtime');
  const fixture=report.checks.filter(c=>c.fixture===spec.fixture);
  const activation=fixture.filter(c=>c.kind==='activation');
  const named=fixture.filter(c=>c.kind==='assertion'&&c.name===spec.check);
  const failures=report.checks.filter(c=>c.ok===false);
  if(!activation.length||activation.some(c=>c.ok!==true)||named.length!==1||named[0].ok!==false||failures.length!==1||failures[0]!==named[0]||
    report.checks.some(c=>typeof c.name!=='string'||typeof c.ok!=='boolean')||
    report.checks.some(c=>c.ok===false&&(c.kind!=='assertion'||!c.fixture)))throw Error('Baseline must contain only the named active-runtime rendering failure');
  return true;
}
export function validateBaselineChildResult(child){
  if(child?.error)throw Error(`Baseline child process failed: ${child.error}`);
  if(child?.status!==1)throw Error(`Expected the named baseline failure to exit 1; got ${child?.status}`);
  return true;
}
function run(command,args,{cwd,env,timeout}){
  return spawnSync(command,args,{cwd,env,encoding:'utf8',timeout,windowsHide:true,maxBuffer:8*1024*1024});
}
function git(root,args,timeout=120000){
  const r=run('git',args,{cwd:root,timeout});
    if(r.error||r.status!==0)throw Error(`git ${args[0]} failed: ${r.error||((r.stderr||r.stdout||'').slice(-2000))}`);
  return r.stdout.trim();
}
export async function runReportBaseline({engine,root,output,runnerFile,catalogIds,packageDirectory}){
  const specPath=join(root,'tests/lab/report-reproduction.json');
  if(!shouldRunReportBaseline({hasSpec:existsSync(specPath)}))return false;
  const spec=validateBaselineSpec(JSON.parse(readFileSync(specPath,'utf8')),catalogIds);
  mkdirSync(output,{recursive:true});
  const owned=mkdtempSync(join(tmpdir(),'oled-report-base-'));
  const worktree=join(owned,'checkout');
  const reportPath=join(output,`${engine.toLowerCase()}-base.json`);
  const usualPath=join(output,`${engine.toLowerCase()}.json`);
  try{
    try{git(root,['cat-file','-e',`${spec.base}^{commit}`],5000)}catch{git(root,['fetch','--no-tags','--depth=1','origin',spec.base],120000)}
    git(root,['worktree','add','--detach',worktree,spec.base],120000);
    const pkg=run(process.execPath,['tools/package.mjs'],{cwd:worktree,env:process.env,timeout:120000});
    if(pkg.error||pkg.status!==0)throw Error(`Immutable base packaging failed: ${pkg.error||((pkg.stderr||pkg.stdout||'').slice(-2000))}`);
    const basePackage=join(worktree,packageDirectory);
    const baseRuntimeHash=runtimeDigest(file=>readFileSync(join(basePackage,file)));
    const child=run(process.execPath,[runnerFile],{cwd:root,env:{...process.env,OLED_LAB_PACKAGE_ROOT:worktree},timeout:900000});
    if(existsSync(usualPath))writeFileSync(reportPath,readFileSync(usualPath));
    if(!existsSync(reportPath))throw Error(`Baseline child did not write ${reportPath}`);
    const report=JSON.parse(readFileSync(reportPath,'utf8'));
    validateBaselineReport(report,spec,engine,baseRuntimeHash);
    validateBaselineChildResult(child);
    return true;
  }finally{
    try{git(root,['worktree','remove','--force',worktree],30000)}catch{}
    const allowed=resolve(tmpdir())+sep+'oled-report-base-';
    if(!resolve(owned).startsWith(allowed))throw Error('Baseline cleanup escaped its owned temporary directory');
    rmSync(owned,{recursive:true,force:true,maxRetries:3,retryDelay:200});
  }
}
export function reportBaselineEntry(engine,root,output,runnerFile,catalogIds,packageDirectory){
  const specPath=join(root,'tests/lab/report-reproduction.json');
  if(!shouldRunReportBaseline({hasSpec:existsSync(specPath)}))return Promise.resolve(false);
  return runReportBaseline({engine,root,output,runnerFile,catalogIds,packageDirectory});
}
