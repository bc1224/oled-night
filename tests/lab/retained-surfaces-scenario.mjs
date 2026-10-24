export async function retainedSurfacesScenario(){
  const checks=[],wait=()=>new Promise(resolve=>setTimeout(resolve,700));
  const color=id=>getComputedStyle(document.getElementById(id)).backgroundColor;
  const continuous=state=>{
    const card=color('refresh-card'),heading=color('refresh-heading'),more=color('refresh-more');
    checks.push({name:'LinkedIn matching paints remain continuous '+state,ok:[card,heading,more].every(c=>c==='rgb(27, 31, 35)'),detail:JSON.stringify({card,heading,more})});
  };
  continuous('on first scan');
  const layout=document.getElementById('layout');
  for(let i=0;i<3;i++){
    layout.classList.toggle('scrolled');await wait();
    continuous('after chunked layout refresh '+(i+1));
  }
  checks.push({name:'LinkedIn genuinely different inset remains distinct after refresh',ok:color('refresh-distinct')==='rgb(0, 0, 0)',detail:color('refresh-distinct')});
  layout.classList.add('changed');await wait();
  checks.push({name:'LinkedIn fresh parent color invalidates the old matching-paint proof',ok:color('refresh-card')==='rgb(32, 32, 32)'&&color('refresh-heading')==='rgb(0, 0, 0)'&&color('refresh-more')==='rgb(0, 0, 0)',detail:JSON.stringify({card:color('refresh-card'),heading:color('refresh-heading'),more:color('refresh-more')})});
  layout.classList.remove('changed');await wait();continuous('after the native card color returns');
  const more=document.getElementById('refresh-more');more.focus();await wait();
  checks.push({name:'LinkedIn refreshed truncation button keeps distinct keyboard focus',ok:more.matches(':focus-visible')&&color('refresh-more')!==color('refresh-card')&&getComputedStyle(more).outlineStyle!=='none',detail:color('refresh-more')});
  more.blur();await wait();continuous('after keyboard focus leaves');
  return checks;
}
