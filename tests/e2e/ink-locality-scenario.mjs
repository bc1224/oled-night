export async function inkLocalityScenario(){
  const wait=()=>new Promise(resolve=>setTimeout(resolve,180));
  const leaves=[...document.querySelectorAll('.c')].filter((_,i)=>[0,999,1999].includes(i));
  const colors=()=>[...leaves,leaves[0].querySelector('b')].map(node=>getComputedStyle(node).color),before=colors();
  let ancestorSwitches=0;
  const observer=new MutationObserver(records=>{ancestorSwitches+=records.filter(record=>record.oldValue===null).length});
  for(const node of [document.documentElement,document.body,document.getElementById('inkRows')])
    observer.observe(node,{attributes:true,attributeOldValue:true,attributeFilter:['data-oled-night-measure','data-oled-night-measure-self']});
  for(const node of leaves){node.style.paddingLeft='3px';await wait()}
  const paddingStable=JSON.stringify(colors())===JSON.stringify(before)&&leaves.every(node=>getComputedStyle(node).paddingLeft==='3px');
  const first=leaves[0];first.style.color='#222';await wait();
  const ownedColorChanges=getComputedStyle(first).color!==before[0]&&getComputedStyle(first).color===getComputedStyle(first.parentElement).color;
  first.style.removeProperty('color');await wait();
  const localMeasurements=ancestorSwitches===0&&JSON.stringify(colors())===JSON.stringify(before);
  observer.disconnect();
  first.classList.add('inherited');await wait();
  const inheritWins=getComputedStyle(first).color===getComputedStyle(first.parentElement).color;
  first.classList.remove('inherited');await wait();
  const inherited=document.getElementById('inheritedInk'),inheritedBefore=getComputedStyle(inherited).color;
  inherited.style.paddingLeft='3px';await wait();
  const inheritedStable=inheritWins&&JSON.stringify(colors())===JSON.stringify(before)&&getComputedStyle(inherited).color===inheritedBefore;
  return {paddingStable,ownedColorChanges,localMeasurements,inheritedStable,ancestorSwitches,before,after:colors(),inheritedBefore,inheritedAfter:getComputedStyle(inherited).color};
}
