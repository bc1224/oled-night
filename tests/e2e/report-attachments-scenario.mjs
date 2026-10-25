export async function reportAttachmentsScenario(){
  const $=id=>document.getElementById(id),checks=[],add=(name,ok)=>checks.push({name,ok:!!ok});
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=24;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,32,24);ctx.fillStyle='#fff';ctx.fillRect(8,8,16,8);
  const image=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  // Browser APIs/transport are the boundaries: all preview and event handlers are real.
  const file=new File([image],'private-filename.png',{type:'image/png'});
  const transfer=()=>{const dt=new DataTransfer();dt.items.add(file);return dt};
  const ready=async()=>{for(let i=0;i<40;i++){if(!$('reportSubmit').disabled)return;await new Promise(r=>setTimeout(r,25))}throw Error('Screenshot preparation did not finish')};
  add('screenshot confirmation starts empty and optional',$('reportPreview').open&&$('reportScreenshotImage').hidden&&!$('reportSubmit').disabled);
  add('visible confirmation explains private contents and generic public tracking',/private to the maintainer/.test($('reportDisclosure').textContent)&&/30 days/.test($('reportDisclosure').textContent)&&/generic tracking issue/.test($('reportDisclosure').textContent));
  add('report opens with an editable native paste target',document.activeElement===$('reportDescription'));
  $('reportScreenshotCapture').focus();
  $('reportScreenshotCapture').dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true}));
  add('Control V from a screenshot button routes native paste to notes',document.activeElement===$('reportDescription'));
  $('reportScreenshotDrop').dispatchEvent(new DragEvent('drop',{dataTransfer:transfer(),bubbles:true,cancelable:true}));await ready();
  add('dragged screenshot previews locally',$('reportScreenshotImage').src.startsWith('data:image/')&&!$('reportScreenshotImage').hidden);
  $('reportScreenshotRemove').click();
  add('remove screenshot clears preview',$('reportScreenshotImage').hidden&&!$('reportScreenshotImage').hasAttribute('src'));
  // Firefox discards constructor-supplied clipboardData on synthetic events.
  // Supply the OS clipboard boundary explicitly; exercise the real DOM handler.
  const paste=new ClipboardEvent('paste',{bubbles:true,cancelable:true});
  Object.defineProperty(paste,'clipboardData',{value:transfer()});
  $('reportDescription').dispatchEvent(paste);await ready();
  add('Control V paste previews screenshot without sending',!$('reportScreenshotImage').hidden&&window.__submissions.length===0);
  if(checks.at(-1).ok===false)checks.at(-1).detail=JSON.stringify({items:paste.clipboardData?.items.length,files:paste.clipboardData?.files.length,prevented:paste.defaultPrevented,status:$('reportScreenshotStatus').textContent});
  $('reportCancel').click();$('report').click();await new Promise(r=>setTimeout(r,100));
  add('cancel discards screenshot and sends nothing',$('reportScreenshotImage').hidden&&window.__submissions.length===0);
  const original=Object.getOwnPropertyDescriptor(navigator,'clipboard'),api=globalThis.browser||globalThis.chrome,request=api.permissions.request;let reads=0;
  api.permissions.request=async options=>options.permissions?.includes('clipboardRead');
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{read:async()=>{reads++;return [{types:['image/png'],getType:async()=>file}]}}});
  try{
    add('clipboard is not read while opening report',reads===0);
    $('reportScreenshotPaste').click();await new Promise(r=>setTimeout(r,30));await ready();
    add('Paste screenshot button reads only after click',reads===1&&!$('reportScreenshotImage').hidden&&window.__submissions.length===0);
  }finally{api.permissions.request=request;if(original)Object.defineProperty(navigator,'clipboard',original);else delete navigator.clipboard}
  $('reportScreenshotReview').click();
  add('clicking screenshot opens larger local review',$('reportImagePreview').open&&$('reportReviewImage').src===$('reportScreenshotImage').src&&window.__submissions.length===0);
  $('reportImageClose').click();
  add('closing image review keeps the report and attachment',$('reportPreview').open&&!$('reportImagePreview').open&&!$('reportScreenshotImage').hidden);
  return checks;
}
