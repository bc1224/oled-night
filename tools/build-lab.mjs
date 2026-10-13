import {cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {cases} from '../tests/lab/catalog.mjs';
const root = resolve(import.meta.dirname, '..');
export function buildLab({output = join(root, 'dist/site')} = {}) {
  const tracked=execFileSync('git',['ls-files','-z','--','docs','tests/e2e/site'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  const docs=tracked.filter(p=>p.startsWith('docs/')&&!/^docs\/lab\/(fixtures|catalog\.json|results\.json)/.test(p));
  const fixtures=tracked.filter(p=>/^tests\/e2e\/site\/[-a-z]+\.(html|svg)$/.test(p));
  const expected=new Set([...docs.map(p=>p.slice(5)),...fixtures.map(p=>'lab/fixtures/'+p.split('/').at(-1)),'lab/fixtures/matrix.html','lab/fixtures/audit.js','lab/catalog.json','lab/results.json']);
  function inspect(directory,prefix=''){
    for(const entry of readdirSync(directory,{withFileTypes:true})){
      const name=prefix+entry.name;
      if(entry.isDirectory())inspect(join(directory,entry.name),name+'/');
      else if(!entry.isFile()||!expected.has(name))throw Error('Unexpected public output: '+name+'. Use a fresh build directory; never publish stale captures.');
    }
  }
  mkdirSync(output, {recursive:true});
  inspect(output);
  for(const path of docs){const target=join(output,path.slice(5));mkdirSync(resolve(target,'..'),{recursive:true});cpSync(join(root,path),target);}
  const lab=join(output,'lab'); mkdirSync(join(lab,'fixtures'),{recursive:true});
  // Only checked-in synthetic HTML/SVG fixtures; no captures, reports, profiles or credentials.
  for(const path of fixtures){
    const name=path.split('/').at(-1),target=join(lab,'fixtures',name);
    // The original regression deliberately uses a second loopback origin.
    // Static Pages has no test server: keep its gallery artwork same-origin.
    if(name==='gmail.html')writeFileSync(target,readFileSync(join(root,path),'utf8').replace('`http://localhost:${location.port}/mixed-logo.svg`',"new URL('mixed-logo.svg',location.href).href"));
    else cpSync(join(root,path),target);
  }
  cpSync(join(root,'tests/lab/matrix.html'),join(lab,'fixtures/matrix.html'));
  cpSync(join(root,'docs/lab/audit.js'),join(lab,'fixtures/audit.js'));
  const version=JSON.parse(readFileSync(join(root,'manifest.json'))).version;
  writeFileSync(join(lab,'catalog.json'), JSON.stringify({version,cases},null,2));
  return {cases:cases.length, output};
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(buildLab()));
