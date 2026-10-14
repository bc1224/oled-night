// Shared by the public synthetic page and both real-browser release tests.
export async function frameWorkload() {
  const rows = [...document.querySelectorAll('.row')], list = document.getElementById('list');
  if (!rows.length || !list) throw Error('Missing frame workload fixture');
  let seed = 0x12345678, previous, first, gaps = [], token;
  await new Promise(done => requestAnimationFrame(function tick(now) {
    if (first === undefined) first = now;
    if (previous !== undefined) gaps.push(now - previous);
    previous = now;
    for (let k = 0; k < 20; k++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      rows[seed % rows.length].classList.toggle('hl');
    }
    token?.remove(); token = document.createElement('p'); token.textContent = 'Fake update'; list.prepend(token);
    if (now - first < 1200) requestAnimationFrame(tick); else done();
  }));
  token?.remove();
  const sorted = [...gaps].sort((a, b) => a - b);
  return {frames:gaps.length, p95:sorted[Math.floor((sorted.length - 1) * .95)], worst:Math.max(...gaps), duration:previous-first};
}

export function frameChecks(pairs) {
  const valid = pairs.length === 3 && pairs.every(p => p.pageOnly && ['active','native'].every(mode => {
    const s = p[mode]; return s && Number.isFinite(s.frames) && s.frames > 10 &&
      [s.p95,s.worst,s.duration].every(Number.isFinite) && s.p95 > 0 && s.worst >= s.p95 && s.duration >= 1200;
  }));
  if (!valid) return [{name:'frame pacing has three valid native/active pairs',ok:false,detail:JSON.stringify(pairs)}];
  const median = values => [...values].sort((a,b)=>a-b)[1];
  const ratio = median(pairs.map(p=>p.active.frames/p.native.frames));
  const native95=median(pairs.map(p=>p.native.p95)), active95=median(pairs.map(p=>p.active.p95));
  const worst=Math.max(...pairs.map(p=>p.active.worst));
  return [
    {name:'animated updates retain at least 70% of native frames',ok:ratio>=.7,detail:JSON.stringify({ratio,pairs})},
    {name:'animated updates p95 frame gap stays within budget',ok:active95<=Math.max(34,native95*1.5),detail:JSON.stringify({active95,native95})},
    {name:'animated updates have no 150ms frame stall',ok:worst<150,detail:String(worst)}
  ];
}

export function mountComponents() {
  window.__memoryHost=document.createElement('section');
  for(let i=0;i<160;i++) {
    const host=document.createElement('mail-cell');
    host.attachShadow({mode:'open'}).innerHTML='<button>Fake mail action</button>';
    window.__memoryHost.append(host);
  }
  document.body.append(window.__memoryHost);
}
export function removeComponents() { window.__memoryHost.remove(); window.__memoryHost=null; }
