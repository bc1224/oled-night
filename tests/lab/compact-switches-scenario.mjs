import {PNG} from 'pngjs';
export function compactSwitchProbe(){
 const ids=['pseudo-switch','before-switch'],elements={};
 for(const id of ids){const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e),p=getComputedStyle(e,id==='before-switch'?'::before':'::after');
  elements[id]={x:r.x,y:r.y,state:e.getAttribute('aria-checked'),focused:document.activeElement===e,transform:p.transform,outline:s.outlineStyle,outlineWidth:s.outlineWidth,track:s.backgroundColor,thumb:p.backgroundColor}}
 return {elements,viewportWidth:innerWidth,active:document.documentElement.hasAttribute('data-oled-night-root'),version:document.documentElement.getAttribute('data-oled-night-version'),mode:document.documentElement.getAttribute('data-oled-night-mode'),fixture:location.pathname.split('/').at(-1),
 markers:['unchecked-marker','checked-marker'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {x:r.x,y:r.y,state:e.getAttribute('aria-checked')}}),
 colored:getComputedStyle(document.getElementById('colored-switch'),'::after').backgroundColor,
 decoration:getComputedStyle(document.getElementById('decorative-pill'),'::after').backgroundColor};
}
export function compactSwitchPaint(bytes,probe,state,version,mode){
 const png=PNG.sync.read(bytes),scale=png.width/probe.viewportWidth,checks=[],lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const sample=(r,dx,dy=13)=>{const x=Math.round((r.x+dx)*scale),y=Math.round((r.y+dy)*scale);if(x<0||y<0||x>=png.width||y>=png.height)return null;const i=(y*png.width+x)*4;return [...png.data.subarray(i,i+3)]};
 checks.push({coverage:'identity',name:'compact switch pixel receipt identifies fixture, mode and runtime',ok:probe.active&&probe.version===version&&probe.mode===(mode==='auto'?'crush':'oled')&&probe.fixture==='compact-switches.html',detail:JSON.stringify({active:probe.active,version:probe.version,mode:probe.mode,fixture:probe.fixture})});
 for(const [id,r] of Object.entries(probe.elements)){
  const thumb=sample(r,state?31:13),track=sample(r,state?8:36),ratio=thumb&&track?(Math.max(lum(thumb),lum(track))+.05)/(Math.min(lum(thumb),lum(track))+.05):0;
  checks.push({coverage:'selection',name:id+' '+state+' visible thumb pixels and position',ok:ratio>=3&&r.state===String(state)&&r.transform===(state?'matrix(1, 0, 0, 1, 18, 0)':'none'),detail:JSON.stringify({thumb,track,ratio,state:r.state,transform:r.transform})});
  if(r.focused){const ring=sample(r,22,-4),outside=sample(r,22,-8),contrast=ring&&outside?(Math.max(lum(ring),lum(outside))+.05)/(Math.min(lum(ring),lum(outside))+.05):0;checks.push({coverage:'selection',name:id+' keyboard focus has visible outline pixels',ok:r.outline!=='none'&&parseFloat(r.outlineWidth)>0&&contrast>=3,detail:JSON.stringify({ring,outside,contrast})})}
 }
 const markers=probe.markers.map(r=>sample(r,14,14)),markerRatio=markers.every(Boolean)?(Math.max(...markers.map(lum))+.05)/(Math.min(...markers.map(lum))+.05):0;
 checks.push({coverage:'selection',name:'non-switch checkbox markers retain distinct checked and unchecked pixels',ok:markerRatio>=3&&probe.markers[0].state==='false'&&probe.markers[1].state==='true',detail:JSON.stringify({markers,markerRatio})});
 const color=(probe.colored.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
 checks.push({coverage:'surface',name:'colored generated thumb keeps its pink hue instead of neutral state ink',ok:color[0]>color[2]&&color[2]>color[1]*3&&color[0]>color[1]*3,detail:probe.colored});
 const decoration=lum((probe.decoration.match(/[\d.]+/g)||[]).slice(0,3).map(Number));
 checks.push({coverage:'surface',name:'non-control decorative pill retains native or mapped surface treatment',ok:mode==='auto'?decoration>.9:decoration<.05,detail:probe.decoration});
 return checks;
}
export function compactSwitchRestored(){
 const after=document.getElementById('pseudo-switch'),before=document.getElementById('before-switch');
 return {coverage:'selection',name:'disable restores authored generated thumbs, tracks and current values',ok:getComputedStyle(after,'::after').backgroundColor==='rgb(255, 255, 255)'&&getComputedStyle(before,'::before').backgroundColor==='rgb(16, 20, 24)'&&getComputedStyle(after).backgroundColor==='rgb(23, 100, 129)'&&after.getAttribute('aria-checked')==='true'&&before.getAttribute('aria-checked')==='true'&&!document.documentElement.hasAttribute('data-oled-night-root')};
}
