export function dmvHeroPaintProbe() {
  const caption=document.getElementById('hero-caption'),image=document.querySelector('.content-slide__picture img');
  const rect=caption.getBoundingClientRect(),picture=document.querySelector('.content-slide__picture').getBoundingClientRect();
  const style=getComputedStyle(caption),imageStyle=getComputedStyle(image);
  return {active:document.documentElement.hasAttribute('data-oled-night-root'),pixelRatio:devicePixelRatio,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},picture:{width:picture.width,height:picture.height},image:{loaded:image.complete&&image.naturalWidth>0,filter:imageStyle.filter},ink:style.webkitTextFillColor==='rgb(0, 0, 0)'?style.color:style.webkitTextFillColor,background:'#f6e66b'};
}
