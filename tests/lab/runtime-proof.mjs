import {createHash} from 'node:crypto';

// Automatic fixes may change only these runtime modules (plus manifest version).
// Normalize checkout line endings; preserve every other source byte.
export const runtimeFiles=['content.js','color-utils.js','youtube-theme.js','settings.js'];
export function runtimeDigest(read) {
  const hash=createHash('sha256');
  for(const file of runtimeFiles) {
    const source=String(read(file)).replace(/\r\n/g,'\n');
    hash.update(file+'\0'+Buffer.byteLength(source)+'\0').update(source);
  }
  return hash.digest('hex');
}

export function regressionChecks(fixture,active,checks) {
  return [{fixture,kind:'activation',name:'extension active',ok:active===true},
    ...checks.map(c=>({...c,fixture,kind:'assertion'}))];
}
