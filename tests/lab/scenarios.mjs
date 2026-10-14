// A self-contained page function reused by Chrome and Firefox test adapters.
export async function matrixStates(){
  const out=[],check=(name,ok,detail='')=>out.push({name,ok:!!ok,detail}),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const $=id=>document.getElementById(id),css=e=>getComputedStyle(e),audit=()=>window.OLEDLabAudit.audit(document);
  const record=prefix=>{for(const r of audit())out.push({...r,name:prefix+' / '+r.name})};
  record('rest');
  $('pressed').click();await sleep(150);check('pressed toggle remains functional',$('pressed').getAttribute('aria-pressed')==='true');record('pressed');
  const start=performance.now();$('menu-trigger').click();await new Promise(requestAnimationFrame);check('dropdown paints within 250 ms',!$('menu').hidden&&performance.now()-start<250,(performance.now()-start).toFixed(1)+' ms');await sleep(150);record('dropdown open');
  $('email').focus();await sleep(120);check('input focus is visible',document.activeElement===$('email')&&css($('email')).outlineStyle!=='none');
  $('dialog-trigger').click();await sleep(150);check('dialog opens modally',$('dialog').open);record('dialog open');$('dialog-close').click();check('dialog closes',$('dialog').open===false);
  $('update').click();await sleep(250);check('new content appears',$('live-list').children.length===2);record('content update');
  const roots=$('shadow-nav').shadowRoot.getElementById('links').shadowRoot;
  for(const id of ['shadow-first','shadow-second','shadow-third']){const e=roots.getElementById(id);e.focus();await sleep(120);const s=css(e);check(id+' focus remains dark and readable',e.matches(':focus')&&window.OLEDLabAudit.lum(s.backgroundColor)<.16&&window.OLEDLabAudit.contrast(s.color,s.backgroundColor)>=4.5,s.backgroundColor)}
  const frames=[];$('nav-trigger').click();const until=performance.now()+400;while(performance.now()<until){await new Promise(requestAnimationFrame);frames.push(css($('flyout')).backgroundColor)}check('animated navigation has no pale painted frames',frames.length>=4&&frames.every(c=>window.OLEDLabAudit.lum(c)<.16),[...new Set(frames)].join(', '));
  // Keep screenshots deterministic at a documented resting state.
  $('nav-trigger').click();$('menu-trigger').click();$('pressed').click();$('live-list').lastElementChild.remove();document.activeElement?.blur();await sleep(300);
  return out;
}

// The same workload with OLED Night off and on, measured inside the page.
export async function responsiveness(){
  const menu=[],stalls=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  // Keep the bounded late-root discovery workload in the native/on comparison.
  const pending=document.createElement('div');
  for(let i=0;i<400;i++)pending.append(document.createElement('unhydrated-component'));
  document.body.append(pending);await sleep(80);
  for(let i=0;i<5;i++){const start=performance.now();document.getElementById('menu-trigger').click();await new Promise(requestAnimationFrame);menu.push(performance.now()-start);document.getElementById('menu-trigger').click();await sleep(70)}
  const host=document.getElementById('live-list'),fragment=document.createDocumentFragment();
  for(let i=0;i<200;i++){const e=document.createElement('div');e.textContent='Synthetic update '+i;e.style.background=i%2?'#fff':'#eee';fragment.append(e)}
  host.append(fragment);
  for(let i=0;i<12;i++){const start=performance.now();await sleep(16);stalls.push(Math.max(0,performance.now()-start-16))}
  while(host.children.length>1)host.lastElementChild.remove();await sleep(400);
  pending.remove();
  return {menu,maximumStall:Math.max(...stalls)};
}

export function performanceChecks(native,active){
  const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
  return [{name:'dropdown latency budget',ok:Math.max(...active.menu)<250,detail:JSON.stringify({nativeMs:native.menu,activeMs:active.menu})},
    {name:'dropdown overhead compared with native',ok:median(active.menu)-median(native.menu)<80,detail:`native ${median(native.menu).toFixed(1)} ms; extension ${median(active.menu).toFixed(1)} ms; budget +80 ms`},
    {name:'content-update event-loop stall budget',ok:active.maximumStall<120&&active.maximumStall-native.maximumStall<80,detail:`native ${native.maximumStall.toFixed(1)} ms; extension ${active.maximumStall.toFixed(1)} ms; budgets 120 ms absolute / +80 ms`}];
}
