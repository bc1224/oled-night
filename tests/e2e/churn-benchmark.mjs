// The public lab and both suites execute the unchanged seeded workload.
export {churnWorkload} from '../../docs/lab/performance.js';

export function judgeChurn(pairs) {
  const valid = pairs.length === 3 && pairs.every(p => p.pageOnly &&
    [p.active, p.native].every(s => Number.isFinite(s.frames) && s.frames > 0 && Number.isFinite(s.worst) && s.worst >= 0));
  if (!valid) return {ok: false, pairs, reason: 'invalid paired measurements'};
  const ratios = pairs.map(p => p.active.frames / p.native.frames);
  const medianRatio = [...ratios].sort((a, b) => a - b)[1];
  const worst = Math.max(...pairs.map(p => p.active.worst));
  return {ok: medianRatio >= 0.7 && worst < 150, medianRatio, worst, pairs};
}
