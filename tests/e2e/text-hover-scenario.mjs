// Runs at the DOM/event boundary in either browser, without engine internals.
export async function textHoverEvents(){
  const wait=()=>new Promise(resolve=>setTimeout(resolve,180));
  const nodes=[...['first','second','third','fourth','last','control','symbol','cssSymbol','vectorLabel','slottedFirst','slottedSecond'].map(id=>document.getElementById(id)),
    ...document.getElementById('shadowHost').shadowRoot.querySelectorAll('p')];
  const colors=()=>nodes.map(node=>{const style=getComputedStyle(node);return node instanceof SVGElement?style.fill+';'+style.stroke:style.color});
  const before=colors(),steps=[];
  let previous=document.body;
  for(const target of [...nodes,...nodes.slice().reverse()]){
    previous.dispatchEvent(new PointerEvent('pointerout',{bubbles:true,composed:true,relatedTarget:target}));
    target.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,composed:true,relatedTarget:previous}));
    previous=target;
    await wait();
    steps.push(colors());
  }
  await new Promise(resolve=>setTimeout(resolve,450));steps.push(colors());
  const hoverStable=steps.every(step=>JSON.stringify(step)===JSON.stringify(before));
  const slotted=document.getElementById('slottedFirst');
  slotted.firstChild.data+=' updated';slotted.style.paddingLeft='1px';await wait();
  const slotMutationStable=JSON.stringify(colors())===JSON.stringify(before);
  for(const node of [nodes[0],nodes[1],nodes[5]]){
    node.tabIndex=0;node.focus();await wait();steps.push(colors());
  }
  const focusStable=steps.every(step=>JSON.stringify(step)===JSON.stringify(before));
  nodes[1].classList.add('unrelated');await wait();
  const mutationStable=JSON.stringify(colors())===JSON.stringify(before);
  const inserted=document.createElement('p');inserted.textContent='New synthetic inherited text';
  document.getElementById('last').after(inserted);await wait();
  const insertionStable=getComputedStyle(inserted).color===before[0];inserted.remove();
  let artworkUpdateStable=true;
  for(const id of ['symbol','cssSymbol']){
    const symbol=document.getElementById(id);symbol.style.color='rgb(0, 200, 5)';await wait();
    const coloredArtwork=getComputedStyle(symbol).fill==='rgb(0, 200, 5)'&&getComputedStyle(symbol.ownerSVGElement).filter==='none';
    symbol.style.removeProperty('color');await wait();
    artworkUpdateStable&&=coloredArtwork&&JSON.stringify(colors())===JSON.stringify(before);
  }
  const richButton=document.getElementById('richButton'),richShape=document.getElementById('richShape');
  richButton.focus();await wait();
  const restingShape=getComputedStyle(richShape).fill;
  richButton.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true,composed:true}));await wait();
  const keyboardGreen=getComputedStyle(richShape).fill==='rgb(0, 200, 5)'&&getComputedStyle(richShape.ownerSVGElement).filter==='none';
  richButton.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true,composed:true}));await wait();
  const keyboardControlStable=keyboardGreen&&getComputedStyle(richShape).fill===restingShape;
  return {hoverStable,slotMutationStable,focusStable,mutationStable,insertionStable,artworkUpdateStable,keyboardControlStable,before,steps,
    artworkPreserved:getComputedStyle(document.getElementById('artText')).color==='rgb(34, 34, 34)'};
}
