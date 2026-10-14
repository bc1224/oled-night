// Hydrate an already-scanned custom host without a light-DOM mutation or input.
export async function coldShadowScenario(){
 const out=[],frame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
 const host=document.createElement('cold-navigation');document.body.append(host);
 await frame();await frame();
 const root=host.attachShadow({mode:'open'}),nested=document.createElement('cold-links');root.append(nested);
 const inner=nested.attachShadow({mode:'open'}),sheet=new CSSStyleSheet();
 sheet.replaceSync('a{display:inline-block;padding:12px;background:#fff;color:#013f7c}');
 inner.adoptedStyleSheets=[sheet];inner.innerHTML='<a href="#one">One</a><a href="#two">Two</a><a href="#three">Three</a>';
 await frame();await frame();
 for(const [index,e] of [...inner.querySelectorAll('a')].entries()){
  const s=getComputedStyle(e),a=window.OLEDLabAudit;
  out.push({name:'cold nested hydration before input / '+(index+1),ok:e.hasAttribute('data-oled-night')&&a.lum(s.backgroundColor)<.16&&a.contrast(s.webkitTextFillColor||s.color,a.background(e))>=4.5,detail:JSON.stringify({mark:e.getAttribute('data-oled-night'),bg:s.backgroundColor,ink:s.webkitTextFillColor||s.color})});
 }
 host.remove();return out;
}
