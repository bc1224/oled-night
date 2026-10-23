export async function chatStreamingScenario(){
 const checks=[],sleep=ms=>new Promise(r=>setTimeout(r,ms)),root=document.documentElement;
 const check=(coverage,name,ok,detail)=>checks.push({coverage,name,ok,detail});
 const bg=e=>getComputedStyle(e).backgroundColor;
 check('performance','streaming regression loads the full 180-message conversation',document.querySelectorAll('#messages > article').length===180);
 check('performance','native chat uses CSS only without per-element paint markers',root.hasAttribute('data-oled-night-chatgpt')&&root.getAttribute('data-oled-night-mode')==='native'&&!document.querySelector('[data-oled-night]'));
 check('surface','native chat primary surface is OLED black',bg(document.querySelector('main'))==='rgb(0, 0, 0)',bg(document.querySelector('main')));
 check('surface','native chat composer, code and dialog keep authored raised surfaces',['form','pre','dialog'].every(s=>bg(document.querySelector(s))==='rgb(33, 33, 33)'));
 const frames=[];let running=true,last=performance.now();requestAnimationFrame(function tick(t){frames.push(t-last);last=t;if(running)requestAnimationFrame(tick)});
 const stream=document.createElement('article');stream.innerHTML='<p id="streamed">Streaming</p>';document.getElementById('messages').append(stream);
 for(let i=0;i<30;i++){
  root.classList.toggle('streaming',i%2===0);document.getElementById('draft').focus();
  document.getElementById('streamed').append(document.createTextNode(' token '+i));
  const span=document.createElement('span');span.textContent=' new text';stream.append(span);
  document.querySelector('main').dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:document.body}));
  scrollTo(0,i%2?document.body.scrollHeight:0);await sleep(20);
 }
 await sleep(60);running=false;
 check('performance','long conversation streaming, focus and scrolling retain the 150 ms frame budget',frames.length>=20&&Math.max(...frames)<150,JSON.stringify({nodes:document.querySelectorAll('*').length,frames:frames.length,max:Math.max(...frames)}));
 check('performance','streaming never adds per-element paint overrides or SVG copies',!document.querySelector('[data-oled-night], [data-oled-night-measure], [data-oled-night-asset-icon]'));
 check('text','new streaming text retains native readable ink',getComputedStyle(stream).color==='rgb(237, 237, 237)',getComputedStyle(stream).color);
 check('media','product media retains authored colors and filters',getComputedStyle(document.getElementById('product')).filter==='none');
 check('selection','native selection, draft and send control survive streaming',document.getElementById('choice').checked&&document.getElementById('draft').textContent==='Unsent draft'&&getComputedStyle(document.getElementById('send')).color==='rgb(23, 23, 23)');
 root.dataset.theme='light';await sleep(80);
 check('surface','native light theme stays coherent after a theme switch',bg(document.querySelector('main'))==='rgb(255, 255, 255)'&&bg(document.body)==='rgb(255, 255, 255)'&&getComputedStyle(stream).color==='rgb(23, 23, 23)');
 root.dataset.theme='dark';await sleep(80);
 check('surface','returning to native dark restores OLED primary surfaces',bg(document.querySelector('main'))==='rgb(0, 0, 0)');
 return checks;
}
