const assert=require('node:assert/strict');
const test=require('node:test');
const {mkdtemp,readFile,rm}=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
test('legacy preservation defaults to backup and redaction requires explicit apply after verified backups',async()=>{
 const {preserveLegacyReport}=await import('../tools/legacy-report-privacy.mjs');
 const directory=await mkdtemp(path.join(os.tmpdir(),'oled-legacy-privacy-'));
 try{
  const calls=[],id=crypto.randomUUID(),original={number:123,title:'SYNTHETIC_PRIVATE_TITLE',body:'SYNTHETIC_PRIVATE_BODY ![image](https://oled-night-reporter.bcf1224.workers.dev/v1/screenshots/'+id+')',html_url:'https://github.com/bc1224/oled-night/issues/123',updated_at:'2026-10-25T00:00:00Z',labels:[{name:'oled-report'}]};
  let current=original;
  const perform=async(url,options)=>{
   calls.push({url,...options});
   if(url.endsWith('/user'))return Response.json({login:'bc1224',type:'User'});
   if(url.includes('/v1/screenshots/'))return new Response(Buffer.from('89504e470d0a1a0a','hex'),{headers:{'Content-Type':'image/png'}});
   if(options.method==='PATCH'){
    const backup=JSON.parse(await readFile(path.join(directory,'apply','original-issue.json'),'utf8'));
    assert.equal(backup.body,original.body);assert.equal((await readFile(path.join(directory,'apply','screenshot-'+id+'.png'))).toString('hex'),'89504e470d0a1a0a');
    const patch=JSON.parse(options.body);assert(!JSON.stringify(patch).includes('SYNTHETIC_PRIVATE'));assert(!JSON.stringify(patch).includes('/screenshots/'));current={...original,...patch};return Response.json(current);
   }
   return Response.json(current);
  };
  const options={issueNumber:123,getToken:async()=> 'synthetic_owner_credential',fetch:perform};
  const preview=await preserveLegacyReport({...options,outputDirectory:path.join(directory,'preview')});
  assert.equal(preview.applied,false);assert.equal(calls.filter(call=>call.method==='PATCH').length,0);
  const applied=await preserveLegacyReport({...options,outputDirectory:path.join(directory,'apply'),apply:true});
  assert.equal(applied.applied,true);assert.equal(calls.filter(call=>call.method==='PATCH').length,1);
  assert(!JSON.stringify([preview,applied]).includes('SYNTHETIC_PRIVATE'));
  assert(calls.every(call=>call.redirect==='error'));
 }finally{await rm(directory,{recursive:true,force:true})}
});
