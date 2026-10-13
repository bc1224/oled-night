import {cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cases} from '../tests/lab/catalog.mjs';
const root = resolve(import.meta.dirname, '..');
export function buildLab({output = join(root, 'dist/site')} = {}) {
  mkdirSync(output, {recursive:true});
  cpSync(join(root,'docs'),output,{recursive:true,filter:p=>!/[\\/]lab[\\/](fixtures|catalog\.json|results\.json)/.test(p)});
  const lab=join(output,'lab'); mkdirSync(join(lab,'fixtures'),{recursive:true});
  // Only checked-in synthetic HTML/SVG fixtures; no captures, reports, profiles or credentials.
  for(const entry of readdirSync(join(root,'tests/e2e/site'),{withFileTypes:true})){
    if(!entry.isFile()||!/^[-a-z]+\.(html|svg)$/.test(entry.name))continue;
    cpSync(join(root,'tests/e2e/site',entry.name),join(lab,'fixtures',entry.name));
  }
  cpSync(join(root,'tests/lab/matrix.html'),join(lab,'fixtures/matrix.html'));
  cpSync(join(root,'docs/lab/audit.js'),join(lab,'fixtures/audit.js'));
  const version=JSON.parse(readFileSync(join(root,'manifest.json'))).version;
  writeFileSync(join(lab,'catalog.json'), JSON.stringify({version,cases},null,2));
  return {cases:cases.length, output};
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(buildLab()));
