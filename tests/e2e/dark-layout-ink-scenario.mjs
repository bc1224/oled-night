export async function darkLayoutInkScenario(){
  const wait=()=>new Promise(resolve=>setTimeout(resolve,700));
  const bright=color=>Number(color.match(/[\d.]+/)[0])>128;
  const history=document.getElementById('history');
  const leaf=document.createElement('span');leaf.textContent='New dark authored ink';leaf.style.color='#222';history.append(leaf);
  await wait();const insertedText=bright(getComputedStyle(leaf).color);
  const own=document.createTextNode('Direct structural text');document.body.append(own);
  await wait();const ownColor=getComputedStyle(document.body).color,ownText=bright(ownColor);own.remove();
  const changed=document.createTextNode(' ');document.body.append(changed);await wait();
  changed.data='Updated structural text';await wait();
  const updatedText=bright(getComputedStyle(document.body).color);changed.remove();
  const sheet=document.createElement('style');sheet.textContent='body.generated::before{content:"Generated label"}body.generated.empty::before{content:"";display:block;width:20px;height:20px;border:2px solid currentColor}';document.head.append(sheet);
  document.body.classList.add('generated');await wait();
  const generatedText=bright(getComputedStyle(document.body,'::before').color);
  document.body.classList.add('empty');await wait();
  const generatedPaint=bright(getComputedStyle(document.body,'::before').borderTopColor);
  document.body.classList.remove('generated','empty');
  const artwork=document.createElement('div');artwork.textContent='Artwork ink';artwork.style.cssText='color:#222;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'yellow\'/%3E%3C/svg%3E");background-size:cover;background-repeat:no-repeat;width:120px;height:30px';history.append(artwork);
  const control=document.createElement('button');control.textContent='Native control';control.style.cssText='color:#222;background:#202124';history.append(control);
  await wait();
  const artworkPreserved=getComputedStyle(artwork).color==='rgb(34, 34, 34)'&&getComputedStyle(artwork).backgroundImage.includes('data:image/svg+xml');
  const controlText=bright(getComputedStyle(control).color);
  return{insertedText,ownText,updatedText,generatedText,generatedPaint,artworkPreserved,controlText,details:{ownColor,artworkColor:getComputedStyle(artwork).color,artworkImage:getComputedStyle(artwork).backgroundImage,controlColor:getComputedStyle(control).color}};
}
