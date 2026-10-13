import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {launchChrome,wait} from '../tests/lab/browser.mjs';
// Runs in an anonymous page. Never serializes source text, attributes, assets or URLs.
export function sanitizedComponent(selector){
  if(!selector||/^(html|body|\*)$/i.test(selector.trim()))throw Error('Choose a specific component, not a whole page');
  const root=document.querySelector(selector);if(!root)throw Error('Component selector not found');let count=0;
  const properties=['display','background-color','color','border-top-color','border-top-width','border-top-style','border-radius','outline-color','outline-width','outline-style','box-shadow','padding','margin','gap','grid-template-columns','flex-direction','align-items','justify-content','font-size','font-weight','line-height','opacity'];
  const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function copy(e){if(++count>300)throw Error('Component is too large; choose a smaller selector');if(['SCRIPT','STYLE','NOSCRIPT','IFRAME','OBJECT','EMBED'].includes(e.tagName))return '';
    const tag=['BUTTON','A','P','H1','H2','H3','LABEL','TABLE','TBODY','THEAD','TR','TD','TH','UL','LI','SECTION','DIV','SPAN'].includes(e.tagName)?e.tagName.toLowerCase():'div';
    const s=window.getComputedStyle(e),styles=properties.map(p=>[p,s.getPropertyValue(p)]).filter(([,v])=>v&&!/url\(|[<>]/i.test(v)).map(([p,v])=>p+':'+v).join(';');
    const children=[...e.children,...(e.shadowRoot?.children||[])].map(copy).join('');
    const label=e.tagName==='INPUT'||e.tagName==='TEXTAREA'||e.tagName==='SELECT'?'Synthetic field':['IMG','SVG','CANVAS','VIDEO'].includes(e.tagName)?'Synthetic media':e.tagName==='BUTTON'?'Example action':e.tagName==='A'?'Example link':'Example text';
    return `<${tag} style="${escape(styles)}"${tag==='a'?' href="#example"':''} data-lab-check="text">${children||label}</${tag}>`;
  }
  return {html:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sanitized component</title><body style="padding:24px">'+copy(root)+'</body>',elements:count};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];if(!args.includes('--url')||!args.includes('--selector'))throw Error('Usage: node tools/capture-component.mjs --url https://public-site/ --selector .component');
  const url=new URL(value('--url'));if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(url.hostname))throw Error('Use an anonymous public HTTPS page without credentials, query or fragment');
  const output=resolve('dist/captures',Date.now().toString());mkdirSync(output,{recursive:true});const browser=await launchChrome();
  try{const page=await browser.open(url.href);await wait(1500);const selector=value('--selector');for(const state of ['rest','hover','focus']){
    if(state==='hover'){const r=await page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await page.hover(r.x,r.y)}
    if(state==='focus')await page.eval(`document.querySelector(${JSON.stringify(selector)}).focus()`);await wait(200);
    const result=await page.eval(`(${sanitizedComponent.toString()})(${JSON.stringify(selector)})`);writeFileSync(join(output,state+'.html'),result.html);
  }console.log(`Sanitized local candidates saved to ${output}. Review and rebuild interaction CSS before adding a case; captures are never published automatically.`)}finally{await browser.close()}
}
