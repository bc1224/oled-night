const assert = require('node:assert/strict');
const {mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync, unlinkSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');

(async () => {
  const {buildLab} = await import('../tools/build-lab.mjs');
  const out = mkdtempSync(join(tmpdir(), 'oled-lab-build-test-'));
  const privateFixture=join(__dirname,'e2e/site/private-lab-sentinel.html');
  assert(!existsSync(privateFixture),'never overwrite an existing source file');
  writeFileSync(privateFixture,'<p>Synthetic private capture sentinel</p>');
  try {
    const result = buildLab({output: out});
    const catalog = JSON.parse(readFileSync(join(out, 'lab/catalog.json')));
    assert(catalog.cases.length >= 35, 'historical reproductions plus the component matrix are browsable');
    assert.equal(new Set(catalog.cases.map(c => c.id)).size, catalog.cases.length);
    for (const c of catalog.cases) {
      assert(c.title && c.category && c.covers.length && c.limit, 'each case describes coverage and limits');
      assert(!c.file.includes('..') && existsSync(join(out, 'lab/fixtures', c.file)), c.file);
    }
    assert.equal(result.cases, catalog.cases.length);
    assert(existsSync(join(out, 'lab/index.html')));
    assert(!existsSync(join(out, 'lab/fixtures/report.json')), 'private downloads never enter the public lab');
    assert(!existsSync(join(out,'lab/fixtures/private-lab-sentinel.html')),'untracked HTML captures must never become public fixtures');
    writeFileSync(join(out,'private-sentinel.html'),'Synthetic stale output');
    assert.throws(()=>buildLab({output:out}),/Unexpected public output/,'stale files must block publication');
    console.log('PASS lab build publishes all documented synthetic cases without private reports');
  } finally { unlinkSync(privateFixture);rmSync(out, {recursive:true, force:true}); }
})().catch(e => {console.error(e); process.exitCode = 1;});
