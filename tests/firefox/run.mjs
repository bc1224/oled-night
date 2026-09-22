import { createServer } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import webExt from 'web-ext';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(join(tmpdir(), 'oled-night-firefox-test-'));
let runner, timer;
let resolveResult;
const result = new Promise(r => { resolveResult = r; });
const server = createServer((req, res) => {
  if (req.url === '/result' && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { resolveResult(JSON.parse(body)); res.end('ok'); }); return;
  }
  try {
    const file = req.url.split('?')[0].slice(1);
    if (!/^[a-z-]+\.html$/.test(file)) throw Error('invalid path');
    res.setHeader('content-type', 'text/html');
    res.end(readFileSync(join(root, 'tests/e2e/site', file)));
  } catch { res.statusCode = 404; res.end(); }
});
try {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  cpSync(join(root, 'dist/firefox'), temp, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(temp, 'manifest.json')));
  manifest.background.scripts.push('test-driver.js');
  writeFileSync(join(temp, 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(temp, 'test-driver.js'), `const TEST_ORIGIN = ${JSON.stringify(origin)};\n` + readFileSync(join(root, 'tests/firefox/driver.js'), 'utf8'));
  for (const page of ['options.html', 'popup.html']) {
    const path = join(temp, page);
    writeFileSync(path, readFileSync(path, 'utf8').replace('</body>', '<script src="test-ui.js"></script></body>'));
  }
  cpSync(join(root, 'tests/firefox/ui.js'), join(temp, 'test-ui.js'));
  runner = await webExt.cmd.run({ sourceDir: temp, artifactsDir: temp, firefox: process.env.FIREFOX_PATH || (process.platform === 'win32' ? 'C:/Program Files/Mozilla Firefox/firefox.exe' : 'firefox'), args: ['-headless'], noReload: true, noInput: true }, { shouldExitProgram: false });
  const checks = await Promise.race([result, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Firefox tests timed out')), 90000); })]);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ': ' + c.detail : ''}`);
  if (checks.some(c => !c.ok)) process.exitCode = 1;
  console.log(`${checks.filter(c => c.ok).length}/${checks.length} Firefox checks passed`);
} finally {
  clearTimeout(timer);
  if (runner) await runner.exit();
  await new Promise(r => server.close(r));
  // Only remove the exact mkdtemp directory owned by this test.
  rmSync(temp, { recursive: true, force: true });
}
