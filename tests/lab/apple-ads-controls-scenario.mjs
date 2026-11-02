export async function appleAdsControlsScenario(){
  const checks=[],check=(name,ok,detail)=>checks.push({name:'Apple Ads '+name,ok,detail:JSON.stringify(detail)}),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const input=document.getElementById('keyword'),cover=document.getElementById('cover'),popularity=document.getElementById('popularity'),dots=[...popularity.shadowRoot.querySelectorAll('.popularity-dots__dot')];
  input.click();await sleep(200);
  check('native checkbox selection keeps its authored blue face',input.checked&&getComputedStyle(cover).backgroundColor==='rgb(0, 122, 255)',{checked:input.checked,bg:getComputedStyle(cover).backgroundColor});
  input.click();input.focus();await sleep(200);
  check('unchecked native input remains focusable with visible label focus',document.activeElement===input&&getComputedStyle(cover).outlineStyle!=='none'&&!input.checked,{outline:getComputedStyle(cover).outline});input.blur();
  dots[2].classList.add('popularity-dots__dot--on');popularity.setAttribute('value','3');popularity.setAttribute('aria-valuenow','3');await sleep(200);
  check('updated popularity retains three filled and two empty values',dots.filter(d=>d.classList.contains('popularity-dots__dot--on')).length===3&&popularity.getAttribute('aria-valuenow')==='3'&&getComputedStyle(dots[2]).backgroundColor===getComputedStyle(dots[0]).backgroundColor,{value:popularity.getAttribute('aria-valuenow'),updated:getComputedStyle(dots[2]).backgroundColor});
  check('control and dot geometry remain unchanged',parseFloat(getComputedStyle(cover).width)===16&&dots.every(d=>parseFloat(getComputedStyle(d).width)===6),{});
  check('unrelated decorative inset is not promoted to a control boundary',!getComputedStyle(document.getElementById('unrelated')).boxShadow.includes('160, 160, 168'),{});
  check('unrelated radio cover retains generic paint handling',!getComputedStyle(document.getElementById('radio-cover')).boxShadow.includes('160, 160, 168'),{});
  return checks;
}
export function appleAdsControlsProbe(){
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
  const shadow=document.getElementById('shadow-check').shadowRoot;
  const popularity=document.getElementById('popularity');
  return {dpr:devicePixelRatio,panel:rect(document.getElementById('panel')),covers:['cover','selected-cover'].map(id=>({id,rect:rect(document.getElementById(id))})).concat({id:'shadow-cover',rect:rect(shadow.getElementById('shadow-cover'))}),dots:[...popularity.shadowRoot.querySelectorAll('.popularity-dots__dot')].map(e=>({on:e.classList.contains('popularity-dots__dot--on'),rect:rect(e)}))};
}
export function appleAdsControlsRestored(){
  const cover=getComputedStyle(document.getElementById('cover'));
  const dots=[...document.getElementById('popularity').shadowRoot.querySelectorAll('.popularity-dots__dot')],on=dots.find(d=>d.classList.contains('popularity-dots__dot--on')),off=dots.find(d=>!d.classList.contains('popularity-dots__dot--on'));
  return {name:'Apple Ads disable restores authored checkbox and popularity paint and selection',ok:cover.backgroundColor==='rgb(255, 255, 255)'&&cover.boxShadow.includes('rgb(204, 204, 204)')&&document.getElementById('selected').checked&&!document.getElementById('keyword').checked&&getComputedStyle(on).backgroundColor==='rgb(0, 122, 255)'&&getComputedStyle(off).boxShadow.includes('rgb(221, 221, 221)'),detail:JSON.stringify({bg:cover.backgroundColor,shadow:cover.boxShadow,on:getComputedStyle(on).backgroundColor,off:getComputedStyle(off).boxShadow})};
}
