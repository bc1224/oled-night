import {createServer} from 'node:http';

// Exercise asset handling through a real extension, HTTP requests and page
// rendering. Counters retain only fixture paths/destinations, never cookies.
export async function spriteAssetsScenario({openTab,closeTab,setSettings,check}){
  const requests=new Map(),aborted=new Map(),timers=new Set(),sleep=ms=>new Promise(r=>setTimeout(r,ms));let page;
  const svg='<svg xmlns="http://www.w3.org/2000/svg"><symbol id="ink" viewBox="0 0 24 24"><path fill="#000" d="M10 3h4v18h-4z"/></symbol></svg>';
  const button=(id,src)=>`<button id="${id}"><svg viewBox="0 0 24 24"><use href="${src}#ink"/></svg></button>`;
  const server=createServer((req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(req.headers['sec-fetch-dest']==='empty'){
      requests.set(path,(requests.get(path)||0)+1);
      res.on('close',()=>{if(!res.writableEnded)aborted.set(path,(aborted.get(path)||0)+1)});
    }
    res.setHeader('cache-control','no-store');
    if(path==='/index.html'||path==='/pending.html'){
      res.setHeader('content-type','text/html');
      const controls=path==='/pending.html'?button('pending','/pending.svg'):
        Array.from({length:32},(_,i)=>button('shared-'+i,'/shared.svg')).join('')+
        ['bad-mime','redirect','huge','style','broken','slow'].map(id=>button(id,'/'+id+'.svg')).join('')+
        button('cross-origin',`http://localhost:${server.address().port}/cross.svg`);
      res.end(`<!doctype html><style>body{background:#202124;color:#eee}button{background:white;color:black;border:0;margin:2px;width:36px;height:36px}svg{width:24px;height:24px;fill:currentColor}</style>${controls}`);return;
    }
    if(path==='/redirect.svg'){res.writeHead(302,{location:'/redirect-final.svg'});res.end();return}
    res.setHeader('content-type',path==='/bad-mime.svg'?'text/plain':'image/svg+xml');
    if(path==='/slow.svg'||path==='/pending.svg'){
      res.write(' ');
      const timer=setTimeout(()=>{timers.delete(timer);res.end(svg)},4500);timers.add(timer);return;
    }
    if(path==='/huge.svg'){res.end(svg.replace('<symbol','<!--'+'x'.repeat(524288)+'--><symbol'));return}
    if(path==='/style.svg'){res.end(svg.replace('<symbol','<style>path{fill:#1463c7}</style><symbol'));return}
    res.end(path==='/broken.svg'?'<svg invalid':svg);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    await setSettings({extensionEnabled:true,globalEnabled:true,siteRules:{}});
    page=await openTab(origin+'/index.html');await sleep(3600);
    check('sprites: repeated controls coalesce one same-origin inspection',requests.get('/shared.svg')===1,JSON.stringify(Object.fromEntries(requests)));
    check('sprites: compact explicit-black symbols become visible',await page.eval("getComputedStyle(document.querySelector('#shared-0 svg')).filter==='invert(1)'"));
    check('sprites: cross-origin symbols are never fetched for inspection',!requests.has('/cross.svg'));
    check('sprites: redirects are never followed for inspection',requests.get('/redirect.svg')===1&&!requests.has('/redirect-final.svg'));
    check('sprites: slow inspection is aborted within its deadline',aborted.get('/slow.svg')===1);
    const preserved=await page.eval("['bad-mime','redirect','huge','style','broken','slow','cross-origin'].map(id=>({id,filter:getComputedStyle(document.querySelector('#'+id+' svg')).filter}))");
    check('sprites: invalid, large, styled and unavailable artwork is not inverted',preserved.every(c=>c.filter==='none'),JSON.stringify(preserved));
    await page.eval("document.body.classList.add('changed');document.querySelectorAll('button').forEach(b=>b.classList.add('updated'))");await sleep(250);
    check('sprites: failures are not retried on repaint',[...requests.values()].every(n=>n===1));
    await page.eval("for(let i=0;i<12;i++){const b=document.createElement('button');b.innerHTML='<svg viewBox=\"0 0 24 24\"><use href=\"/extra-'+i+'.svg#ink\"/></svg>';document.body.append(b)}");await sleep(500);
    check('sprites: distinct inspection requests stay bounded at eight',Array.from(requests.values()).reduce((s,n)=>s+n,0)===8,JSON.stringify(Object.fromEntries(requests)));
    await setSettings({extensionEnabled:false});await sleep(120);
    check('sprites: disable restores authored filters',await page.eval("[...document.querySelectorAll('button svg')].every(svg=>getComputedStyle(svg).filter==='none')"));
    await page.go('about:blank');await setSettings({extensionEnabled:true});await page.go(origin+'/pending.html');
    check('sprites: pending inspection actually started',requests.get('/pending.svg')===1);
    await setSettings({extensionEnabled:false});await sleep(3300);
    check('sprites: disable aborts pending work without late writes',aborted.get('/pending.svg')===1&&await page.eval("!document.documentElement.hasAttribute('data-oled-night-root')&&!document.querySelector('svg').hasAttribute('data-oled-night')&&getComputedStyle(document.querySelector('svg')).filter==='none'"));
  }finally{
    await closeTab(page);for(const timer of timers)clearTimeout(timer);server.closeAllConnections();await new Promise(r=>server.close(r));await setSettings({extensionEnabled:true,siteRules:{}});
  }
}
