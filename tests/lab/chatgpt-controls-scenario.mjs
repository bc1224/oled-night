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
  return {enabled,textRatio,icons,ok:(!enabled||textRatio>=4.5)&&icons.every(i=>i.styleRatio>=3)};
}
