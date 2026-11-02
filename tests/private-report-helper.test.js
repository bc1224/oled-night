const assert=require('node:assert/strict');
const test=require('node:test');
const {mkdtemp,readFile,mkdir,rm,symlink}=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
test('maintainer download keeps credentials in memory and writes only to an explicit directory outside Git',async()=>{
 const {downloadReport}=await import('../tools/private-report.mjs');
 const directory=await mkdtemp(path.join(os.tmpdir(),'oled-private-helper-'));
 try{
  const calls=[],id=crypto.randomUUID(),screenshotId=crypto.randomUUID();
  const result=await downloadReport({reportId:id,outputDirectory:path.join(directory,'private'),getToken:async()=> 'synthetic_owner_credential',fetch:async(url,options)=>{
   calls.push({url,...options});
   if(url.endsWith('/v1/reports/'+id))return Response.json({schema:'oled-private-report-v1',id,description:'SYNTHETIC_PRIVATE_CONTENT',screenshotId});
   return new Response(Buffer.from('89504e470d0a1a0a','hex'),{headers:{'Content-Type':'image/png'}});
  }});
  assert.equal(JSON.parse(await readFile(path.join(result.directory,'report.json'),'utf8')).description,'SYNTHETIC_PRIVATE_CONTENT');
  assert.equal((await readFile(path.join(result.directory,'screenshot.png'))).toString('hex'),'89504e470d0a1a0a');
  assert(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_CONTENT'),'normal output contains only file paths');
  assert(!JSON.stringify(result).includes('synthetic_owner_credential'));
  for(const call of calls){assert.equal(new URL(call.url).origin,'https://oled-night-reporter.bcf1224.workers.dev');assert.equal(call.redirect,'error');assert.equal(call.headers.Authorization,'Bearer synthetic_owner_credential')}
  await assert.rejects(downloadReport({reportId:id,outputDirectory:path.join(directory,'private'),getToken:async()=>{throw Error('must not fetch before checking output')}}),/empty|exist/i);
  const repository=path.join(directory,'repo');await mkdir(path.join(repository,'.git'),{recursive:true});
  await assert.rejects(downloadReport({reportId:id,outputDirectory:path.join(repository,'reports')}),/outside Git/);
  const linked=path.join(directory,'repo-link');await symlink(repository,linked,process.platform==='win32'?'junction':'dir');
  await assert.rejects(downloadReport({reportId:id,outputDirectory:path.join(linked,'reports')}),/outside Git/);
  await assert.rejects(downloadReport({reportId:id,outputDirectory:'relative-output'}),/absolute/);
 }finally{await rm(directory,{recursive:true,force:true})}
});
