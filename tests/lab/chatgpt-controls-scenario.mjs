export function chatgptControlsScenario(){
  const channel=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  const luminance=value=>{const [r,g,b]=channel(value).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const plan=document.querySelector('#plan'),planStyle=getComputedStyle(plan),planBackground=planStyle.backgroundColor;
  const planText=planStyle.webkitTextFillColor&&planStyle.webkitTextFillColor!=='currentcolor'?planStyle.webkitTextFillColor:planStyle.color;
  const enabled=!plan.matches(':disabled'),textRatio=contrast(planText,planBackground);
  const icons=['stop-light','stop-dark'].map(id=>{
    const button=document.getElementById(id),svg=button.querySelector('svg'),rect=svg.querySelector('rect');
    const buttonColor=getComputedStyle(button).backgroundColor,fill=getComputedStyle(rect).fill,filter=getComputedStyle(svg).filter;
    const rgb=channel(fill);const painted=filter.includes('invert(1)')?rgb.map(v=>255-v):rgb;
    return {id,buttonColor,fill,filter,painted:painted.map(v=>`rgb(${v}, ${v}, ${v})`)[0],styleRatio:contrast(`rgb(${painted.join(', ')})`,buttonColor)};
  });
  const logo=document.querySelector('#brand-logo svg');
  const logoPaths=logo?[...logo.querySelectorAll('path')]:[];
  const logoPaints=logoPaths.map(path=>getComputedStyle(path).fill);
  const logoPreserved=!!logo&&getComputedStyle(logo).filter==='none'&&logoPaints.join('|')==='rgb(20, 99, 199)|rgb(196, 44, 84)'&&logoPaths.every(path=>!path.hasAttribute('data-oled-night'));
  // These fake sprite symbols explicitly draw their strokes with currentColor.
  // A fill override on <use> alone cannot repair their actual stroke paint.
  const voices=['voice-local','voice-external','voice-dark','voice-readable','voice-yellow'].map(id=>{
    const button=document.getElementById(id),svg=button.querySelector('svg');
    const ink=getComputedStyle(svg).color,background=getComputedStyle(button).backgroundColor;
    return {id,ink,background,ratio:contrast(ink,background),filter:getComputedStyle(svg).filter};
  });
  return {enabled,textRatio,icons,voices,logoPreserved,ok:(!enabled||textRatio>=4.5)&&icons.every(i=>i.styleRatio>=3)&&voices.every(i=>i.ratio>=3&&i.filter==='none')&&logoPreserved};
}
