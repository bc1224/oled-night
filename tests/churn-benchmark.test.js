const assert = require('node:assert/strict');
(async () => {
  const {judgeChurn} = await import('./e2e/churn-benchmark.mjs');
  const pair = (frames, worst = 35) => ({active: {frames, worst}, native: {frames: 120, worst: 20}, pageOnly: true});
  assert(judgeChurn([pair(95), pair(65), pair(96)]).ok, 'one noisy pair must not decide sustained throughput');
  assert(!judgeChurn([pair(65), pair(66), pair(95)]).ok, 'persistent slowdown must fail the unchanged 70% budget');
  assert(!judgeChurn([pair(95), pair(95, 151), pair(95)]).ok, 'a long active stall must never be hidden by a median');
  assert(!judgeChurn([pair(95), {...pair(95), pageOnly: false}, pair(95)]).ok, 'native reference must really have the extension off');
  assert(!judgeChurn([pair(95), pair(NaN), pair(95)]).ok, 'invalid measurements fail closed');
  assert(!judgeChurn([]).ok, 'missing pairs fail closed');
  console.log('PASS paired churn gate preserves throughput and absolute stall budgets');
})().catch(e => {console.error(e); process.exitCode = 1;});
