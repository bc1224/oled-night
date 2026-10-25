import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,realpath,lstat,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

export const REPORTER_ORIGIN='https://oled-night-reporter.bcf1224.workers.dev';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function githubToken(){
  try{
    const {stdout}=await promisify(execFile)('gh',['auth','token','--hostname','github.com'],{windowsHide:true,timeout:10000,maxBuffer:16384});
    const token=stdout.trim();
    if(!/^[A-Za-z0-9_]{8,255}$/.test(token))throw Error();
    return token;
  }catch{throw Error('GitHub authentication unavailable. Sign in with gh as bc1224.')}
}
async function outsideGit(directory){
  for(let parent=directory;;parent=path.dirname(parent)){
    try{await lstat(path.join(parent,'.git'));throw Error('Choose an output directory outside Git.')}catch(error){if(error.code!=='ENOENT')throw error}
    // Also reject bare Git repositories without a .git directory.
    try{await lstat(path.join(parent,'HEAD'));await lstat(path.join(parent,'objects'));await lstat(path.join(parent,'refs'));throw Error('Choose an output directory outside Git.')}catch(error){if(error.code!=='ENOENT')throw error}
    if(path.dirname(parent)===parent)break;
  }
}
export async function prepareOutputDirectory(requested){
  if(typeof requested!=='string'||!path.isAbsolute(requested))throw Error('An explicit absolute output directory outside Git is required.');
  const destination=path.resolve(requested);
  await outsideGit(destination);
  // Resolve the nearest existing ancestor before mkdir, including junctions.
  let ancestor=destination;
  while(true){try{ancestor=await realpath(ancestor);break}catch(error){if(error.code!=='ENOENT')throw error;ancestor=path.dirname(ancestor)}}
  await outsideGit(ancestor);
  await mkdir(destination,{recursive:true,mode:0o700});
  const directory=await realpath(destination);await outsideGit(directory);
  if((await readdir(directory)).length)throw Error('Output directory must be empty. Choose a new directory.');
  return directory;
}
export async function boundedBytes(response,limit){
  if(!response.body)throw Error('Empty private response.');
  const reader=response.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Private response exceeded its size limit.')}chunks.push(value)}
  return Buffer.concat(chunks,size);
}
export async function privateFetch(pathname,token,perform=fetch){
  if(!/^\/v1\/(?:reports|screenshots)\/[a-f0-9-]{36}$/i.test(pathname))throw Error('Invalid private report path.');
  let response;
  try{response=await perform(REPORTER_ORIGIN+pathname,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)})}catch{throw Error('Private report request failed. No credentials or response contents were logged.')}
  if(response.status!==200)throw Error('Private report request failed with HTTP '+response.status+'.');
  return response;
}
export async function downloadReport({reportId,screenshotId,outputDirectory,getToken=githubToken,fetch:perform=fetch}){
  if((!!reportId===!!screenshotId)||!uuid.test(reportId||screenshotId||''))throw Error('Choose one valid report ID or legacy screenshot ID.');
  const directory=await prepareOutputDirectory(outputDirectory),token=await getToken(),files=[];
  let imageId=screenshotId;
  if(reportId){
    const response=await privateFetch('/v1/reports/'+reportId,token,perform);
    const bytes=await boundedBytes(response,32768);
    let report;try{report=JSON.parse(bytes.toString('utf8'))}catch{throw Error('Invalid private report response.')}
    if(report.schema!=='oled-private-report-v1'||report.id!==reportId||(report.screenshotId!==null&&!uuid.test(report.screenshotId||'')))throw Error('Invalid private report response.');
    // Check the entire receipt before writing anything. Never follow URLs in it.
    imageId=report.screenshotId;
    await writeFile(path.join(directory,'report.json'),bytes,{flag:'wx',mode:0o600});files.push('report.json');
  }
  if(imageId){
    const response=await privateFetch('/v1/screenshots/'+imageId,token,perform),type=response.headers.get('Content-Type');
    if(!['image/png','image/jpeg'].includes(type))throw Error('Invalid private screenshot response.');
    const bytes=await boundedBytes(response,409600),file=type==='image/png'?'screenshot.png':'screenshot.jpg';
    await writeFile(path.join(directory,file),bytes,{flag:'wx',mode:0o600});files.push(file);
  }
  return {directory,files};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const {values}=parseArgs({options:{'report-id':{type:'string'},'screenshot-id':{type:'string'},'output-dir':{type:'string'}},strict:true});
    const result=await downloadReport({reportId:values['report-id'],screenshotId:values['screenshot-id'],outputDirectory:values['output-dir']});
    console.log('Saved '+result.files.length+' private file(s) to '+result.directory+'.');
  }catch(error){console.error(error.message);process.exitCode=1}
}
