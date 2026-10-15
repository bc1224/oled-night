export async function reportPreviewScenario() {
 const out=[],opens=[],$=id=>document.getElementById(id);
 // The fixture simulates the service. DOM events expose the submitted
 // payload across Firefox isolated worlds without contacting GitHub.
 const intercept=event=>{event.preventDefault();opens.push(event.detail)};
 document.addEventListener('oled-lab-submit',intercept);
 try {
  out.push({name:'public report preview omits private text and identifiers',ok:$('privacy-result').textContent.startsWith('PASS')&&!/PRIVATE/.test($('preview').textContent)});
  $('report').click();
  out.push({name:'report opens confirmation without sharing',ok:$('confirm').open&&opens.length===0});
  out.push({name:'confirmation explains payload, public retention and review',ok:/domain/.test($('disclosure').textContent)&&/retained by GitHub/.test($('disclosure').textContent)&&/independent review/.test($('disclosure').textContent)});
  $('cancel').click();await new Promise(r=>setTimeout(r,0));
  out.push({name:'cancelling sends nothing',ok:!$('confirm').open&&opens.length===0});
  $('report').click();$('send').click();$('send').click();await new Promise(r=>setTimeout(r,0));
  out.push({name:'explicit Send submits one scrubbed issue',ok:opens.length===1&&!/PRIVATE/.test(opens[0])&&JSON.parse(opens[0]).report.host==='example.com'&&!$('confirm').open});
 }finally{document.removeEventListener('oled-lab-submit',intercept)}
 return out;
}
