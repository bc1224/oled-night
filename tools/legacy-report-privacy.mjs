import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {prepareOutputDirectory,githubToken,boundedBytes,privateFetch,REPORTER_ORIGIN} from './private-report.mjs';

const uuid='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
export async function preserveLegacyReport({issueNumber,outputDirectory,apply=false,getToken=githubToken,fetch:perform=fetch}){
  if(!Number.isSafeInteger(issueNumber)||issueNumber<1)throw Error('Choose one explicit positive issue number.');
  const directory=await prepareOutputDirectory(outputDirectory),token=await getToken();
  const issueURL='https://api.github.com/repos/bc1224/oled-night/issues/'+issueNumber;
  async function github(url,method='GET',body){
    let response;
    try{response=await perform(url,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'OLED-Night-Private-Reports'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)})}catch{throw Error('GitHub request failed; private contents were not logged.')}
    if(response.status!==200)throw Error('GitHub request failed with HTTP '+response.status+'.');
    try{return JSON.parse((await boundedBytes(response,1048576)).toString('utf8'))}catch{throw Error('Invalid GitHub response; private contents were not logged.')}
  }
  const identity=await github('https://api.github.com/user');
  if(identity.login!=='bc1224'||identity.type!=='User')throw Error('Only maintainer bc1224 can preserve and redact these reports.');
  const original=await github(issueURL);
  if(original.number!==issueNumber||original.html_url!=='https://github.com/bc1224/oled-night/issues/'+issueNumber||typeof original.title!=='string'||typeof original.body!=='string'||!original.labels?.some(label=>label.name==='oled-report'))throw Error('Selected issue is not a recognized OLED report.');
  if(original.title==='Private OLED Night report')throw Error('This is already a private tracker. No legacy redaction is needed.');
  const saved={number:original.number,title:original.title,body:original.body,url:original.html_url,updatedAt:original.updated_at};
  const files=[];
  async function backup(name,bytes){
    const target=path.join(directory,name);await writeFile(target,bytes,{flag:'wx',mode:0o600});
    if(!(await readFile(target)).equals(Buffer.from(bytes)))throw Error('Private backup verification failed. No redaction was attempted.');
    files.push(name);
  }
  await backup('original-issue.json',Buffer.from(JSON.stringify(saved,null,2)));
  const imageURLs=[...original.body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)].map(match=>match[1]);
  let requiresManualAttachmentBackup=/(?:<img\b|github\.com\/user-attachments\/|user-images\.githubusercontent\.com)/i.test(original.body);
  for(const url of new Set(imageURLs)){
    const match=url.match(new RegExp('^'+REPORTER_ORIGIN.replaceAll('.','\\.')+'/v1/screenshots/('+uuid+')$','i'));
    if(!match){requiresManualAttachmentBackup=true;continue}
    const response=await privateFetch('/v1/screenshots/'+match[1],token,perform),type=response.headers.get('Content-Type');
    if(!['image/png','image/jpeg'].includes(type))throw Error('Unrecognized legacy image. No redaction was attempted.');
    await backup('screenshot-'+match[1]+(type==='image/png'?'.png':'.jpg'),await boundedBytes(response,409600));
  }
  if(apply){
    if(requiresManualAttachmentBackup)throw Error('Unrecognized attachments require manual preservation before redaction.');
    const fresh=await github(issueURL);
    if(fresh.title!==original.title||fresh.body!==original.body||fresh.updated_at!==original.updated_at)throw Error('Issue changed after backup. No redaction was attempted.');
    const redaction={title:'Legacy OLED Night report',body:'Report details were removed for privacy after the maintainer preserved a private local copy. Do not repost private details or screenshots in comments.\n\nLegacy report: #'+issueNumber};
    await github(issueURL,'PATCH',redaction);
    const after=await github(issueURL);
    if(after.title!==redaction.title||after.body!==redaction.body)throw Error('Redaction readback is unverified. Check the selected issue without posting private contents.');
  }
  return {issueNumber,directory,files,applied:apply,requiresManualAttachmentBackup,historyCleanupRequired:apply};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const {values}=parseArgs({options:{issue:{type:'string'},'output-dir':{type:'string'},apply:{type:'boolean',default:false}},strict:true});
    const result=await preserveLegacyReport({issueNumber:Number(values.issue),outputDirectory:values['output-dir'],apply:values.apply});
    console.log('Issue #'+result.issueNumber+': '+(result.applied?'current title/body redacted; history cleanup still required':'private backup only, no GitHub edits')+'. Saved '+result.files.length+' file(s) to '+result.directory+'.');
    if(result.requiresManualAttachmentBackup)console.log('Some attachments require manual preservation before any redaction.');
  }catch(error){console.error(error.message);process.exitCode=1}
}
