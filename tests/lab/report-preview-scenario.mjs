export async function reportPreviewScenario() {
 const out=[],opens=[],$=id=>document.getElementById(id);
 // A DOM event crosses Firefox isolated worlds; overriding window.open there
 // would not intercept the page's own global and could open a real draft.
 const intercept=event=>{event.preventDefault();opens.push(event.detail)};
 document.addEventListener('oled-lab-draft',intercept);
 try {
  out.push({name:'public report preview omits private text and identifiers',ok:$('privacy-result').textContent.startsWith('PASS')&&!/PRIVATE/.test($('preview').textContent)});
  $('draft').click();
  out.push({name:'report opens confirmation without sharing',ok:$('confirm').open&&opens.length===0});
  out.push({name:'confirmation explains payload, public retention and review',ok:/domain/.test($('disclosure').textContent)&&/retained by GitHub/.test($('disclosure').textContent)&&/independent review/.test($('disclosure').textContent)});
  $('cancel').click();await new Promise(r=>setTimeout(r,0));
  out.push({name:'cancelling sends nothing',ok:!$('confirm').open&&opens.length===0});
  $('draft').click();$('send').click();$('send').click();await new Promise(r=>setTimeout(r,0));
  out.push({name:'explicit Send opens one scrubbed draft',ok:opens.length===1&&!/PRIVATE/.test(opens[0])&&new URL(opens[0]).pathname==='/bc1224/oled-night/issues/new'&&!$('confirm').open});
 }finally{document.removeEventListener('oled-lab-draft',intercept)}
 return out;
}
