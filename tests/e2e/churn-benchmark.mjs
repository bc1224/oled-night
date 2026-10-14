// Same row mutations in every trial; runner scheduling must not change the workload.
export async function churnWorkload() {
  const rows = [...document.querySelectorAll('.row')], list = document.getElementById('list');
  let seed = 0x12345678, worst = 0, last = performance.now(), frames = 0;
  const stop = last + 2000;
  await new Promise(done => {
    (function tick() {
      const now = performance.now(); worst = Math.max(worst, now - last); last = now; frames++;
      for (let k = 0; k < 20; k++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        rows[seed % rows.length].classList.toggle('hl');
      }
      const p = document.createElement('p'); p.textContent = 'token ' + frames; list.prepend(p);
      if (now < stop) setTimeout(tick, 16); else done();
    })();
  });
  return {frames, worst: Math.round(worst)};
}

export function judgeChurn(pairs) {
  const valid = pairs.length === 3 && pairs.every(p => p.pageOnly &&
    [p.active, p.native].every(s => Number.isFinite(s.frames) && s.frames > 0 && Number.isFinite(s.worst) && s.worst >= 0));
  if (!valid) return {ok: false, pairs, reason: 'invalid paired measurements'};
  const ratios = pairs.map(p => p.active.frames / p.native.frames);
  const medianRatio = [...ratios].sort((a, b) => a - b)[1];
  const worst = Math.max(...pairs.map(p => p.active.worst));
  return {ok: medianRatio >= 0.7 && worst < 150, medianRatio, worst, pairs};
}
