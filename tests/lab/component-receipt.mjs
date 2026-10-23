import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {runtimeDigest} from './runtime-proof.mjs';

// Receipts describe the packaged runtime actually loaded by these runners.
export function componentReceipt(engine, result) {
  const root=resolve(import.meta.dirname,'../..'),directory=join(root,'dist',engine.toLowerCase());
  return {
    engine, version:JSON.parse(readFileSync(join(directory,'manifest.json'))).version,
    sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),
    runtimeHash:runtimeDigest(file=>readFileSync(join(directory,file))),
    checkedAt:new Date().toISOString(), candidate:false, ...result
  };
}
