// The page's focus handler edits CSSOM in a later microtask, not the DOM.
export async function deferredCssomScenario() {
  const link=document.getElementById('deferred-hover'),samples=[];
  if(!link)return[{name:'deferred CSSOM focus fixture ready',ok:false}];
  link.focus();
  for(let i=0;i<24;i++) {
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    const color=getComputedStyle(link).backgroundColor;
    samples.push({color,pale:(color.match(/[\d.]+/g)||[]).slice(0,3).every(value=>Number(value)>220)});
  }
  return [{name:'deferred CSSOM focus actually focused',ok:document.activeElement===link&&link.matches(':focus-visible')},
    {name:'deferred CSSOM focus has no pale frame',ok:samples.length===24&&samples.every(s=>!s.pale),detail:JSON.stringify(samples)}];
}
