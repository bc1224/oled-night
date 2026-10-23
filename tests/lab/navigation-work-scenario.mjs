// Public DOM state changes model sticky navigation, redundant root-class writes,
// dynamic article insertion and a real theme change; timings include paint.
export async function navigationWorkScenario(){
 const checks=[],sleep=ms=>new Promise(r=>setTimeout(r,ms)),frames=[];
 let animationEnumerations=0;const nativeAnimations=Document.prototype.getAnimations;
 Document.prototype.getAnimations=function(...args){animationEnumerations++;return nativeAnimations.apply(this,args)};
 let running=true,last=performance.now();const frame=t=>{frames.push(t-last);last=t;if(running)requestAnimationFrame(frame)};requestAnimationFrame(frame);
 document.documentElement.classList.add('client-js');
 const grown=document.createElement('section');grown.innerHTML='<div><p>Initially small layout</p></div>';document.body.prepend(grown);await sleep(80);
 const inheritedBefore=grown.getAttribute('data-oled-night')?.split(' ').includes('fg');
 const inserted=grown.firstElementChild;inserted.insertAdjacentHTML('beforeend',Array.from({length:600},()=>'<p>Late article content</p>').join(''));await sleep(180);
 const inheritedAfter=!!grown.getAttribute('data-oled-night')?.split(' ').includes('fg'),grownInk=getComputedStyle(inserted.lastElementChild).color;
 checks.push({coverage:'performance',name:'late large sections retire unnecessary inherited layout ink while retaining readable content',ok:inheritedBefore===true&&inheritedAfter===false&&Number(grownInk.match(/[\d.]+/g)[0])>=180,detail:JSON.stringify({inheritedBefore,inheritedAfter,grownInk})});grown.remove();await sleep(80);
 const scrollSheet=document.createElement('style');scrollSheet.textContent='html.nav-stuck{scroll-padding-top:80px}';document.head.append(scrollSheet);await sleep(100);
 const nativeComputed=globalThis.getComputedStyle;let articleReads=0;
 globalThis.getComputedStyle=function(node,...args){if(node.parentElement?.id==='article'||node.parentElement?.parentElement?.id==='article')articleReads++;return nativeComputed.call(this,node,...args)};
 document.documentElement.classList.add('nav-stuck');await sleep(150);globalThis.getComputedStyle=nativeComputed;
 checks.push({coverage:'performance',name:'sticky navigation scroll offsets do not reread unrelated article paint',ok:articleReads===0&&getComputedStyle(document.documentElement).scrollPaddingTop==='80px',detail:JSON.stringify({articleReads,padding:getComputedStyle(document.documentElement).scrollPaddingTop})});document.documentElement.classList.remove('nav-stuck');scrollSheet.remove();await sleep(100);
 const unrelatedSheet=document.createElement('style');unrelatedSheet.textContent=Array.from({length:200},(_,i)=>`.unrelated-qa-${i}{background:#eee;color:#111}`).join('')+'html.nav-offset{scroll-padding-top:80px}';document.head.append(unrelatedSheet);await sleep(100);
 const styleDescriptor=Object.getOwnPropertyDescriptor(CSSStyleRule.prototype,'style');let unrelatedStyleReads=0;
 Object.defineProperty(CSSStyleRule.prototype,'style',{...styleDescriptor,get(){if(this.selectorText?.startsWith('.unrelated-qa-'))unrelatedStyleReads++;return styleDescriptor.get.call(this)}});
 try{document.documentElement.classList.add('nav-offset');await sleep(120)}finally{Object.defineProperty(CSSStyleRule.prototype,'style',styleDescriptor)}
 checks.push({coverage:'performance',name:'navigation class proof does not enumerate declarations of unrelated rules',ok:unrelatedStyleReads===0,detail:String(unrelatedStyleReads)});document.documentElement.classList.remove('nav-offset');unrelatedSheet.remove();await sleep(100);
 const late=document.createElement('style'),module=document.createElement('style');
 late.textContent='.client-js body:not(.overlay-open).scrolled .sticky-label{background:#ddd}';document.head.append(late);await sleep(80);
 for(let i=0;i<12;i++){
  document.body.classList.toggle('scrolled',i%2===0);
  for(const button of document.querySelectorAll('#mega-nav button'))button.setAttribute('aria-expanded','false');
  document.querySelector('header a').focus();document.body.className=document.body.className;
  document.getElementById('article').dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:document.body}));
  if(i===5)late.textContent='.client-js body:not(.overlay-open).scrolled .sticky-label{background:#eee}';
  if(i===7){module.textContent='@keyframes quiet-pulse{from{opacity:.99}to{opacity:1}}.sticky-label{animation:quiet-pulse 4s infinite}.row:nth-child(-n+120) a{color:rgb(210,100,40)}.row *{pointer-events:none}';document.head.append(module)}
  await sleep(35);
 }
 await sleep(60);running=false;
 const layoutSheet=document.createElement('style');layoutSheet.textContent='#article{transition:padding-left .4s linear}#article a{transition:color .2s linear}';document.head.append(layoutSheet);await sleep(150);
 const article=document.getElementById('article');let motionWrites=0;
 const layoutObserver=new MutationObserver(records=>{motionWrites+=records.filter(r=>r.oldValue?.includes('--oln-motion')).length});layoutObserver.observe(article,{attributes:true,attributeFilter:['style'],attributeOldValue:true});
 article.querySelector('a').dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:document.body}));await sleep(120);layoutObserver.disconnect();
 checks.push({coverage:'performance',name:'layout-only ancestors retain native transitions without inherited motion rewrites',ok:motionWrites===0&&getComputedStyle(article).transitionProperty==='padding-left',detail:JSON.stringify({motionWrites,transition:getComputedStyle(article).transitionProperty})});layoutSheet.remove();
 const max=Math.max(...frames),p95=[...frames].sort((a,b)=>a-b)[Math.floor(frames.length*.95)];
 checks.push({coverage:'performance',name:'navigation, focus and repeated class writes keep every frame below 150 ms',ok:frames.length>=10&&max<150,detail:JSON.stringify({max,p95,frames:frames.length})});
 const expanded=document.createElement('style');expanded.textContent='#mega-nav [aria-expanded="true"]{color:rgb(244,126,56)}';document.head.append(expanded);
 const trigger=document.querySelector('#mega-nav button');trigger.parentElement.hidden=false;trigger.hidden=false;trigger.setAttribute('aria-expanded','true');await sleep(80);
 const expandedInk=getComputedStyle(trigger).color;
 trigger.setAttribute('aria-expanded','false');await sleep(80);const collapsedInk=getComputedStyle(trigger).color;
 checks.push({coverage:'text',name:'real expanded state changes still repaint control ink',ok:expandedInk===getComputedStyle(document.getElementById('theme-reference')).color&&collapsedInk!==expandedInk,detail:JSON.stringify({expandedInk,collapsedInk})});trigger.hidden=true;trigger.parentElement.hidden=true;expanded.remove();
 document.getElementById('update').click();await sleep(80);
 const ink=getComputedStyle(document.querySelector('#article p')).color;
 checks.push({coverage:'text',name:'new dynamic article text remains readable',ok:Number(ink.match(/[\d.]+/g)[0])>=180,detail:ink});
 const state=document.createElement('style');state.textContent='.night-theme .row span{color:rgb(244,126,56)}[class="order-a order-b"] .sticky-label{color:rgb(234,96,48)}';document.head.append(state);await sleep(100);
 document.body.classList.add('night-theme');await sleep(100);
 const themed=getComputedStyle(document.querySelector('#article .row span')).color;
 checks.push({coverage:'text',name:'page-wide theme change still repaints descendant values',ok:themed===getComputedStyle(document.getElementById('theme-reference')).color,detail:themed});
 document.body.className='order-a order-b';await sleep(100);
 const ordered=getComputedStyle(document.querySelector('.sticky-label')).color;
 document.body.className='order-b order-a';await sleep(100);
 const reordered=getComputedStyle(document.querySelector('.sticky-label')).color;
 checks.push({coverage:'text',name:'class attribute selectors still respond to class order changes',ok:ordered===getComputedStyle(document.getElementById('order-reference')).color&&reordered!==ordered&&Number(reordered.match(/[\d.]+/g)[0])>=180,detail:JSON.stringify({ordered,reordered})});
 state.textContent+='body[class] .sticky-label{color:rgb(244,126,56)}';await sleep(80);
 document.body.removeAttribute('class');await sleep(80);const absent=getComputedStyle(document.querySelector('.sticky-label')).color;
 document.body.className='';await sleep(80);const present=getComputedStyle(document.querySelector('.sticky-label')).color;
 checks.push({coverage:'text',name:'class presence selectors distinguish an absent and empty class attribute',ok:absent!==present&&present===getComputedStyle(document.getElementById('theme-reference')).color,detail:JSON.stringify({absent,present})});
 const beforeRemoval=getComputedStyle(document.querySelector('#article .row a')).color;
 module.remove();await sleep(100);
 const removed=getComputedStyle(document.querySelector('#article .row a')).color;
 checks.push({coverage:'text',name:'removing a late stylesheet restores the affected link paint',ok:beforeRemoval===getComputedStyle(document.getElementById('link-reference')).color&&removed!==beforeRemoval&&Number(removed.match(/[\d.]+/g)[0])>=180,detail:JSON.stringify({beforeRemoval,removed})});
 late.remove();state.remove();document.body.removeAttribute('class');await sleep(80);
 const escaped=document.createElement('style');escaped.textContent='.\\73 crolled .sticky-label{color:rgb(244,126,56)}';document.head.append(escaped);await sleep(80);
 document.body.className='scrolled';await sleep(100);const escapedInk=getComputedStyle(document.querySelector('.sticky-label')).color;
 checks.push({coverage:'text',name:'a changed escaped class selector retains conservative repainting',ok:escapedInk===getComputedStyle(document.getElementById('theme-reference')).color,detail:escapedInk});escaped.remove();document.body.removeAttribute('class');await sleep(80);
 const foreign=document.createElement('link'),foreignURL=new URL('navigation-opaque.css',location.href);foreignURL.hostname='localhost';foreign.rel='stylesheet';foreign.href=foreignURL.href;
 await new Promise((resolve,reject)=>{foreign.onload=resolve;foreign.onerror=()=>reject(Error('Cross-origin regression stylesheet failed to load'));document.head.append(foreign)});await sleep(150);
 let opaque=false;try{void foreign.sheet.cssRules}catch{opaque=true}
 const bulkSheet=document.createElement('style');bulkSheet.textContent='.bulk-nav-theme span{color:#f60}';document.head.append(bulkSheet);
 const bulk=document.createElement('section');bulk.innerHTML=Array.from({length:700},()=>'<span>Existing navigation copy</span>').join('')+'<input value="Retained value">';document.body.prepend(bulk);await sleep(150);
 const firstTaskNodes=new Set();const bulkObserver=new MutationObserver(records=>{for(const r of records)if(r.target.localName==='span'&&r.attributeName?.startsWith('data-oled-night-measure'))firstTaskNodes.add(r.target)});bulkObserver.observe(bulk,{attributes:true,subtree:true});
 bulk.classList.add('bulk-nav-theme');for(let i=0;i<6;i++)await Promise.resolve();bulkObserver.disconnect();
 checks.push({coverage:'performance',name:'a retained large navigation refresh measures at most 32 ordinary nodes before yielding while preserving native fields',ok:firstTaskNodes.size<=32&&bulk.querySelector('input').value==='Retained value'&&Number(getComputedStyle(bulk.querySelector('input')).color.match(/[\d.]+/g)[0])>=180,detail:JSON.stringify({firstTaskNodes:firstTaskNodes.size})});bulk.remove();bulkSheet.remove();await sleep(100);
 const popup=document.createElement('div');popup.className='popup-module';popup.textContent='Dynamic popup';document.body.prepend(popup);await sleep(80);
 let polarityReads=0;const polarityObserver=new MutationObserver(records=>{polarityReads+=records.length});polarityObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-oled-night-measure-root']});
 const popupSheet=document.createElement('style');popupSheet.textContent='@keyframes popup-enter{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}.popup-module{color:#111;background:#fff;animation:popup-enter .2s linear}';document.head.append(popupSheet);await sleep(200);polarityObserver.disconnect();
 checks.push({coverage:'performance',name:'compositor-only popup keyframes do not remeasure page polarity with an unreadable neighboring stylesheet',ok:opaque&&polarityReads===0&&Number(getComputedStyle(popup).color.match(/[\d.]+/g)[0])>=180&&getComputedStyle(popup).animationName==='popup-enter',detail:JSON.stringify({polarityReads,ink:getComputedStyle(popup).color,animation:getComputedStyle(popup).animationName})});
 polarityReads=0;polarityObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-oled-night-measure-root']});popupSheet.textContent+='@keyframes popup-paint{from{color:#111}to{color:#f60}}';await sleep(120);polarityObserver.disconnect();
 checks.push({coverage:'performance',name:'paint keyframes retain conservative invalidation when their consumers are unreadable',ok:polarityReads>0,detail:String(polarityReads)});popup.remove();popupSheet.remove();await sleep(100);
 const hiddenFrames=[];let hiddenRunning=true,hiddenLast=performance.now();requestAnimationFrame(function tick(t){hiddenFrames.push(t-hiddenLast);hiddenLast=t;if(hiddenRunning)requestAnimationFrame(tick)});
 for(let i=0;i<8;i++){document.getElementById('mega-nav').classList.toggle('minified',i%2===0);await sleep(35)}await sleep(60);hiddenRunning=false;
 checks.push({coverage:'performance',name:'already styled hidden menus remain responsive with an unreadable third-party sheet',ok:opaque&&hiddenFrames.length>=8&&Math.max(...hiddenFrames)<150,detail:JSON.stringify({opaque,max:Math.max(...hiddenFrames),frames:hiddenFrames.length})});
 const rootFrames=[];let rootRunning=true,rootLast=performance.now();requestAnimationFrame(function tick(t){rootFrames.push(t-rootLast);rootLast=t;if(rootRunning)requestAnimationFrame(tick)});
 for(let i=0;i<4;i++){document.body.classList.toggle('popup-scroll-lock',i%2===0);await sleep(35)}await sleep(60);rootRunning=false;
 checks.push({coverage:'performance',name:'root class refresh with retained hidden menus keeps every frame below 150 ms',ok:rootFrames.length>=4&&Math.max(...rootFrames)<150,detail:JSON.stringify({max:Math.max(...rootFrames),frames:rootFrames.length})});document.body.classList.remove('popup-scroll-lock');await sleep(80);
 document.body.classList.add('opaque-theme');
 const convergenceStart=performance.now();
 for(let i=0;i<200;i++){
  document.body.classList.toggle('popup-scroll-lock',i%2===0);await sleep(70);
  if(i>=59&&getComputedStyle(document.querySelector('#last span')).color===getComputedStyle(document.getElementById('theme-reference')).color)break;
 }
 const tailInk=getComputedStyle(document.querySelector('#last span')).color;
 checks.push({coverage:'text',name:'continued root mutations cannot starve the last article section of its current authored ink',ok:tailInk===getComputedStyle(document.getElementById('theme-reference')).color,detail:JSON.stringify({tailInk,convergenceMs:performance.now()-convergenceStart})});
 document.body.classList.remove('opaque-theme','popup-scroll-lock');
 const menu=document.getElementById('menu-0');menu.className='menu-item';document.getElementById('mega-nav').className='minified';trigger.parentElement.hidden=false;menu.hidden=false;await sleep(120);
 const menuInk=getComputedStyle(menu).color,menuBg=getComputedStyle(menu).backgroundColor;
 checks.push({coverage:'text',name:'revealed menu is recolored after retaining its hidden paint',ok:Number(menuInk.match(/[\d.]+/g)[0])>=180&&Number(menuBg.match(/[\d.]+/g)[0])<40,detail:JSON.stringify({menuInk,menuBg})});
 const revealedIcon=getComputedStyle(menu.querySelector('path')).fill;
 checks.push({coverage:'media',name:'revealed menu icon is readable while the product swatch stays unfiltered',ok:Number(revealedIcon.match(/[\d.]+/g)[0])>=180&&getComputedStyle(menu.querySelector('img')).filter==='none',detail:revealedIcon});
 menu.hidden=true;trigger.parentElement.hidden=true;foreign.remove();await sleep(100);
 const host=document.querySelector('late-navigation-widget'),shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML='<style>:host{display:block;background:#fff;color:#111}:host(.active) span{color:rgb(244,126,56)}</style><span>Late shadow text</span>';await sleep(120);
 const initialShadowInk=getComputedStyle(shadow.querySelector('span')).color;host.className='active';await sleep(100);
 const activeShadowInk=getComputedStyle(shadow.querySelector('span')).color;
 checks.push({coverage:'text',name:'late shadow discovery and host class changes still repaint component text',ok:Number(initialShadowInk.match(/[\d.]+/g)[0])>=180&&activeShadowInk===getComputedStyle(document.getElementById('theme-reference')).color,detail:JSON.stringify({initialShadowInk,activeShadowInk})});
 const ordinary=document.createElement('div');document.body.prepend(ordinary);await sleep(80);
 ordinary.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block;background:#fff;color:#111}span{color:#111}</style><span>Late ordinary shadow</span>';
 document.body.classList.add('late-ordinary-shadow');await sleep(120);
 const ordinaryInk=getComputedStyle(ordinary.shadowRoot.querySelector('span')).color;
 checks.push({coverage:'text',name:'a root refresh discovers a newly attached ordinary open shadow',ok:Number(ordinaryInk.match(/[\d.]+/g)[0])>=180,detail:ordinaryInk});ordinary.remove();document.body.classList.remove('late-ordinary-shadow');
 Document.prototype.getAnimations=nativeAnimations;
 checks.push({coverage:'performance',name:'navigation repaint never enumerates unrelated document animations',ok:animationEnumerations===0,detail:String(animationEnumerations)});
 return checks;
}

