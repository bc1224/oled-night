import {PNG} from 'pngjs';
export function oledComponentsPaint(bytes,probe,state='in',version){
 let coverage='identity';const out=[],check=(name,ok,detail)=>out.push({name,coverage,ok:!!ok,detail:JSON.stringify(detail)}),e=probe.elements;
 const png=PNG.sync.read(bytes),scale=png.width/probe.viewportWidth;
 const sample=(id,dx,dy)=>{const r=e[id],x=Math.round((r.x+dx)*scale),y=Math.round((r.y+dy)*scale);if(x<0||y<0||x>=png.width||y>=png.height)return null;const i=(y*png.width+x)*4;return [...png.data.subarray(i,i+3)]},near=(a,b)=>a?.every((v,i)=>Math.abs(v-b[i])<=3);
 check('pixel receipt identifies the loaded runtime and fixture',probe.active&&probe.version===version&&probe.mode==='oled'&&probe.fixture==='oled-components.html',{version:probe.version,mode:probe.mode,fixture:probe.fixture});
 coverage='media';for(const [id,color] of [['dark-swatch',[27,51,56]],['black-swatch',[32,32,32]]]){const p=sample(id,25,30);check(id+' keeps original photographic cutout pixels',near(p,color),p)}
 coverage='selection';const selected=sample('unit-'+state,14,14),empty=sample('unit-'+(state==='in'?'cm':'in'),14,14);
 const lum=c=>c?.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0),a=lum(selected),b=lum(empty),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 check('selected '+state+' radio has a visible state-marker pixel',ratio>=3&&e['unit-'+state].checked&&!e['unit-'+(state==='in'?'cm':'in')].checked,{selected,empty,ratio});
 check('text selection inherits readable colors from the document into nested content',probe.selection.root.bg==='rgb(38, 79, 140)'&&probe.selection.root.fg==='rgb(255, 255, 255)'&&probe.selection.nested.bg===probe.selection.root.bg&&probe.selection.nested.fg===probe.selection.root.fg,probe.selection);
 coverage='surface';const left=sample('header-band',4,4),middle=sample('header-nav',4,4),right=sample('header-band',e['header-band'].w-4,4);
 check('continuous header band has matching left, center and right pixels',near(left,middle)&&near(right,middle),{left,middle,right});
 for(const id of ['product-card','size-dialog','selected-tile','shadow-nav-card']){const parent=id==='selected-tile'?'product-card':'content',p=sample(id,10,10),bg=id==='selected-tile'?sample('product-card',5,5):[0,0,0];check(id+' stays distinct from neighboring '+parent,!near(p,bg),{p,bg})}
 coverage='media';check('true logo and control icon remain visible',e['real-logo'].filter.includes('invert')&&/drop-shadow|invert/.test(e['real-icon'].filter),{logo:e['real-logo'].filter,icon:e['real-icon'].filter});
 check('true monochrome logo has visible painted pixels',lum(sample('real-logo',10,15))>.6,sample('real-logo',10,15));
 const iconPixels=[];for(let y=0;y<24;y++)for(let x=0;x<24;x++)iconPixels.push(sample('real-icon',x,y));
 const iconBackdrop=lum(iconPixels[0]),visible=iconPixels.filter(p=>(lum(p)+.05)/(iconBackdrop+.05)>=3).length;
 check('true control icon has painted edge pixels with at least 3:1 contrast',visible>=4,{visiblePixels:visible});
 return out;
}
