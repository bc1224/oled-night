import {PNG} from 'pngjs';
export function visibleIconPixels(bytes,rect) {
 const png=PNG.sync.read(bytes);let visible=0;
 const channel=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};
 for(let y=Math.max(0,Math.floor(rect.y)-2);y<Math.min(png.height,Math.ceil(rect.y+rect.height)+2);y++)
  for(let x=Math.max(0,Math.floor(rect.x)-2);x<Math.min(png.width,Math.ceil(rect.x+rect.width)+2);x++) {
   const i=(y*png.width+x)*4;
   if(.2126*channel(png.data[i])+.7152*channel(png.data[i+1])+.0722*channel(png.data[i+2])>.08)visible++;
  }
 return visible;
}
