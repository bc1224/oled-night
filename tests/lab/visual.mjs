import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
export function compareScreenshot(actual,expected,{maxRatio=.005}={}){
  const a=PNG.sync.read(actual),b=PNG.sync.read(expected);
  if(a.width!==b.width||a.height!==b.height)return {ok:false,detail:'Screenshot dimensions changed'};
  const diff=new PNG({width:a.width,height:a.height}),changed=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:.15});
  return {ok:changed/(a.width*a.height)<=maxRatio,detail:`${(100*changed/(a.width*a.height)).toFixed(3)}% changed (budget ${maxRatio*100}%)`,diff:PNG.sync.write(diff)};
}
export function checkScreenshot({name,actual,directory,artifacts,candidate=false}){
  mkdirSync(artifacts,{recursive:true});writeFileSync(join(artifacts,name+'.png'),actual);
  const path=join(directory,name+'.png');
  if(candidate)return {name:'visual '+name,ok:true,detail:'Candidate captured; this run cannot authorize a release'};
  if(!existsSync(path))return {name:'visual '+name,ok:false,detail:'Reviewed baseline missing. Review the candidate artifact before adding it.'};
  const r=compareScreenshot(actual,readFileSync(path));if(!r.ok&&r.diff)writeFileSync(join(artifacts,name+'-diff.png'),r.diff);return {name:'visual '+name,ok:r.ok,detail:r.detail};
}
