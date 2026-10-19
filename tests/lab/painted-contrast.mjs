import {PNG} from 'pngjs';

const luminance=([r,g,b])=>{
  const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};
  return .2126*linear(r)+.7152*linear(g)+.0722*linear(b);
};
const ratio=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05)};

export function paintedInkContrast(bytes,rect,background){
  const png=PNG.sync.read(Buffer.from(bytes));
  const x0=Math.max(0,Math.floor(rect.x)),y0=Math.max(0,Math.floor(rect.y));
  const x1=Math.min(png.width,Math.ceil(rect.x+rect.width)),y1=Math.min(png.height,Math.ceil(rect.y+rect.height));
  const counts=new Map();
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const i=(y*png.width+x)*4;if(png.data[i+3]<200)continue;
    const color=[png.data[i],png.data[i+1],png.data[i+2]];
    if(Math.abs(color[0]-background[0])+Math.abs(color[1]-background[1])+Math.abs(color[2]-background[2])<48)continue;
    const key=color.join(',');counts.set(key,(counts.get(key)||0)+1);
  }
  const foreground=[...counts].sort((a,b)=>b[1]-a[1])[0];
  if(!foreground) return {ok:false,ratio:0,pixels:0,foreground:null};
  const color=foreground[0].split(',').map(Number);
  return {ok:ratio(color,background)>=4.5,ratio:ratio(color,background),pixels:foreground[1],foreground:color};
}

export function paintedSample(bytes,x,y){
  const png=PNG.sync.read(Buffer.from(bytes));x=Math.floor(x);y=Math.floor(y);
  if(x<0||y<0||x>=png.width||y>=png.height)return null;
  const i=(y*png.width+x)*4;return [...png.data.subarray(i,i+3)];
}
