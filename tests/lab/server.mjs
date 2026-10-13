import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,sep,join} from 'node:path';
export async function serveLab(directory){
  const root=resolve(directory);const server=createServer((req,res)=>{
    let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return}
    if(pathname==='/slow.js'){setTimeout(()=>{res.setHeader('content-type','text/javascript');res.end('1')},3000);return}
    let path=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return}
    // Historical fixtures include root-relative frame paths.
    if(!existsSync(path)&&/^\/[a-z-]+\.(html|svg)$/.test(pathname))path=join(root,'lab/fixtures',pathname.slice(1));
    try{const data=readFileSync(path);res.setHeader('content-type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.png')?'image/png':'text/html');res.end(data)}catch{res.writeHead(404);res.end()}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
