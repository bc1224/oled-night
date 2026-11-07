const assert=require('node:assert/strict');
(async()=>{
  const {receiveReport}=await import('../services/reporter/core.mjs');
  const map=new Map(),storage={get:async k=>structuredClone(map.get(k)),put:async(k,v)=>map.set(k,structuredClone(v)),delete:async k=>map.delete(k),getAlarm:async()=>null,setAlarm:async()=>{}};
  const sent=[],env={GITHUB_TOKEN:'TEST_ONLY',fetch:async(url,options)=>{sent.push(JSON.parse(options.body));return Response.json({html_url:'https://github.com/bc1224/oled-night/issues/'+(100+sent.length)},{status:201})}};
  const base={description:'PRIVATE NOTE with name@example.com',report:{host:'music.youtube.com',version:'0.6.77',mode:'oled',text:'PRIVATE PAGE TEXT'}};
  const send=(extra,client)=>receiveReport(new Request('https://reporter.test/v1/issues',{method:'POST',headers:{'content-type':'application/json','x-client-id':client},body:JSON.stringify({requestId:crypto.randomUUID(),...base,...extra})}),env,storage);

  // A chosen problem type publishes the domain and fixed label, never notes.
  assert.equal((await send({problem:'background'},'a')).status,201);
  const issue=sent.at(-1);
  assert.equal(issue.title,'music.youtube.com: Background not black');
  assert.match(issue.body,/Site: music\.youtube\.com/);
  assert.match(issue.body,/Problem: Background not black/);
  assert.match(issue.body,/Extension version: 0\.6\.77/);
  assert.match(issue.body,/Mode: oled/);
  assert(!JSON.stringify(issue).includes('PRIVATE'),'notes and page text stay private');
  assert(!JSON.stringify(issue).includes('example.com'),'note contents never reach the public issue');
  const stored=[...map].find(([k])=>k.startsWith('private:'))[1];
  assert.equal(stored.problem,'background');
  assert.equal(stored.description.startsWith('PRIVATE NOTE'),true,'notes remain in the private record');

  // Clients that do not choose (or predate) a problem type keep the generic tracker.
  assert.equal((await send({},'b')).status,201);
  assert.equal(sent.at(-1).title,'Private OLED Night report');
  assert(!sent.at(-1).body.includes('music.youtube.com'));

  // Only the fixed labels are accepted. Arbitrary text cannot become a title.
  assert.equal((await send({problem:'Background <script>'},'c')).status,400);
  assert.equal((await send({problem:'__proto__'},'c')).status,400);
  assert.equal((await send({problem:7},'c')).status,400);
  assert.equal(sent.length,2);
  console.log('reporter public summary: fixed labels only, notes stay private');
})().catch(error=>{console.error(error);process.exit(1)});
