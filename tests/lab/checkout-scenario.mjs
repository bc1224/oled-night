export async function checkoutScenario(){
 const out=[],check=(name,ok,detail='')=>out.push({name,ok:!!ok,detail}),a=window.OLEDLabAudit,css=e=>getComputedStyle(e),$=id=>document.getElementById(id);
 for(const id of ['checkout-back','checkout-card-icon','checkout-crypto-icon']){const filter=css($(id).querySelector('svg')||$(id)).filter;check(id+' dark glyph remains visible',id==='checkout-crypto-icon'?filter.includes('drop-shadow'):filter.includes('invert(1)'),filter)}
 check('payment brand keeps its green fill',css($('checkout-brand')).fill==='rgb(5, 199, 107)',css($('checkout-brand')).fill);
 check('colored payment SVG is not inverted',css($('checkout-brand').closest('svg')).filter==='none');
 check('checkout filled value is readable',a.contrast(css($('checkout-email')).webkitTextFillColor||css($('checkout-email')).color,a.background($('checkout-email')))>=4.5);
 check('checkout illustration is not inverted',css($('photo')).filter==='none');
 check('small account artwork is unchanged',css($('checkout-avatar')).filter==='none');
 check('small colored wallet artwork is unchanged',css($('checkout-small-brand')).filter==='none');
 $('checkout-card').click();let heights=[],pale=0;const end=performance.now()+260;while(performance.now()<end){await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));heights.push($('details').getBoundingClientRect().height);if(a.lum(css($('checkout-card')).backgroundColor)>.16)pale++}
 check('payment accordion retains animated motion',heights.some(h=>h>0&&h<139)&&heights.at(-1)>=139,JSON.stringify(heights));check('payment method has no pale opening frames',pale===0,String(pale));
 check('checkout has no horizontal overflow',document.documentElement.scrollWidth<=innerWidth);$('checkout-card').click();return out;
}
