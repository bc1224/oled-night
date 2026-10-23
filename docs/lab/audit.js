(function(global){
  function lum(rgb){const c=(rgb.match(/[\d.]+/g)||[]).slice(0,3).map(v=>{v=+v/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2]}
  function contrast(a,b){const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
  function elements(root){return [...root.querySelectorAll('*')].flatMap(e=>e.shadowRoot?[e,...elements(e.shadowRoot)]:[e])}
  function background(e){const layers=[];let node=e;while(node){const c=node.ownerDocument.defaultView.getComputedStyle(node).backgroundColor;const nums=(c.match(/[\d.]+/g)||[]).map(Number);const alpha=c==='transparent'?0:nums.length>3?nums[3]:1;layers.push({rgb:nums.slice(0,3),alpha});if(alpha===1)break;node=node.parentElement||node.getRootNode().host}let rgb=[255,255,255];for(const layer of layers.reverse())rgb=rgb.map((v,i)=>v*(1-layer.alpha)+(layer.rgb[i]||0)*layer.alpha);return 'rgb('+rgb.map(Math.round).join(', ')+')'}
  function audit(doc,{requireExtension=true}={}){
    const out=[],active=doc.documentElement.hasAttribute('data-oled-night-root');
    if(requireExtension&&!active)return[{name:'OLED Night is not active on this frame',ok:false,detail:'Enable the extension; native rendering is not a passing extension test.'}];
    const targets=elements(doc).filter(e=>e.hasAttribute('data-lab-check'));
    for(const e of targets){
      const s=doc.defaultView.getComputedStyle(e);if(!e.getClientRects().length||s.visibility==='hidden')continue;
      const id=e.id||e.getAttribute('aria-label')||e.tagName,rules=e.dataset.labCheck.split(' '),ink=s.webkitTextFillColor||s.color;
      if(rules.includes('text')){const ratio=contrast(ink,background(e));out.push({name:id+' text',ok:ratio>=(e.disabled?3:4.5),detail:ratio.toFixed(2)+':1'})}
      if(rules.includes('value')&&active){const ratio=contrast(ink,background(e));out.push({name:id+' primary value',ok:lum(ink)>.6&&ratio>=4.5,detail:ink+' / '+ratio.toFixed(2)+':1'})}
      if(rules.includes('placeholder')){const hint=doc.defaultView.getComputedStyle(e,'::placeholder'),paint=hint.webkitTextFillColor||hint.color,ratio=contrast(paint,background(e));out.push({name:id+' placeholder',ok:ratio>=4.5,detail:ratio.toFixed(2)+':1'})}
      if(rules.includes('surface')&&active){const l=lum(s.backgroundColor);out.push({name:id+' dark surface',ok:l<.16,detail:s.backgroundColor})}
      if(rules.includes('boundary')){const ratio=contrast(s.borderTopColor,background(e));out.push({name:id+' boundary',ok:s.borderTopStyle!=='none'&&parseFloat(s.borderTopWidth)>0&&ratio>=1.25,detail:ratio.toFixed(2)+':1'})}
      if(rules.includes('fill')){const ratio=contrast(s.backgroundColor,background(e.parentElement));out.push({name:id+' data fill',ok:ratio>=3,detail:ratio.toFixed(2)+':1'})}
      if(rules.includes('icon')){const ratio=contrast(s.backgroundColor,background(e.parentElement));out.push({name:id+' icon paint',ok:ratio>=3,detail:ratio.toFixed(2)+':1'})}
      if(rules.includes('logo-edge')&&active)out.push({name:id+' colored logo edge',ok:s.filter.includes('drop-shadow')&&!s.filter.includes('invert'),detail:s.filter});
      if(rules.includes('media')){
        const filters=[];for(let node=e;node;node=node.parentElement||node.getRootNode().host){const f=doc.defaultView.getComputedStyle(node).filter;if(f!=='none')filters.push(f)}
        const inverted=doc.documentElement.hasAttribute('data-oled-night-invert'),counter='invert(1) hue-rotate(180deg)';
        const preserved=filters.length===0||(inverted&&filters.length===2&&filters.every(f=>f===counter));
        out.push({name:id+' media filter chain',ok:preserved,coverage:'media',detail:(filters.join(' → ')||'none')+'; original pixel preservation is checked separately in engine regressions'});
      }
      if(rules.includes('selection')){
        const selected=e.checked===true||e.getAttribute('aria-checked')==='true',marker=doc.defaultView.getComputedStyle(e,'::after');
        const ratio=contrast(marker.backgroundColor,background(e));
        out.push({name:id+' selection marker ('+(selected?'selected':'unselected')+')',coverage:'selection',ok:selected&&marker.content!=='none'?ratio>=3:null,detail:selected?ratio.toFixed(2)+':1; native keyboard and screenshot pixels are separate engine checks':'Unselected state; compare with the selected control'});
      }
      if(rules.includes('band')||rules.includes('separate')){const peer=doc.getElementById(e.dataset.labPair);if(peer){const a=background(e),b=background(peer);out.push({name:id+(rules.includes('band')?' continuous band':' neighboring surface'),coverage:'surface',ok:rules.includes('band')?a===b:a!==b,detail:a+' / '+b+'; paired paint samples are checked in CI'})}}
    }
    for(const result of out)if(!result.coverage)result.coverage=/media|logo/.test(result.name)?'media':/surface|boundary|fill|icon/.test(result.name)?'surface':'text';
    if(!targets.length)out.push({name:'Historical fixture',ok:null,detail:'Use its targeted browser regressions; this case has no matrix audit annotations.'});return out;
  }
  global.OLEDLabAudit={audit,elements,lum,contrast,background};
})(window);
