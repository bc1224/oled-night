const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const source = resolve(__dirname, '..');
const fixture = mkdtempSync(join(tmpdir(), 'oled-night-packaging-'));
try {
  for (const name of readdirSync(source)) {
    if (/\.(js|html|css)$/.test(name) || ['INSTALL.md', 'LICENSE', 'assets', 'theme'].includes(name)) {
      cpSync(join(source, name), join(fixture, name), { recursive: true });
    }
  }
  mkdirSync(join(fixture, 'tools'));
  cpSync(join(source, 'tools/package.mjs'), join(fixture, 'tools/package.mjs'));
  cpSync(join(source, 'manifest.json'), join(fixture, 'manifest.json'));
  for (const browser of ['chrome', 'firefox']) {
    mkdirSync(join(fixture, 'dist', browser, '_metadata'), { recursive: true });
    writeFileSync(join(fixture, 'dist', browser, '_metadata', 'leftover.txt'), 'stale install file');
    writeFileSync(join(fixture, 'dist', browser, 'obsolete.js'), 'obsolete runtime');
  }
  writeFileSync(join(fixture, 'dist', 'keep.txt'), 'unrelated output');
  execFileSync(process.execPath, [join(fixture, 'tools/package.mjs')], { stdio: 'pipe' });
  const manifest = JSON.parse(readFileSync(join(fixture, 'manifest.json')));
  for (const browser of ['chrome', 'firefox']) {
    const staging = join(fixture, 'dist', browser);
    assert.equal(existsSync(join(staging, '_metadata')), false, `${browser}: stale metadata removed`);
    assert.equal(existsSync(join(staging, 'obsolete.js')), false, `${browser}: obsolete runtime removed`);
    const built = JSON.parse(readFileSync(join(staging, 'manifest.json')));
    assert.equal(built.version, manifest.version);
    assert.ok(existsSync(join(staging, 'content.js')));
    if (browser === 'chrome') assert.deepEqual(built, manifest);
    else assert.deepEqual(built.background.scripts, ['settings.js', 'background.js']);
  }
  assert.equal(readFileSync(join(fixture, 'dist', 'keep.txt'), 'utf8'), 'unrelated output');
  for (const archive of [`oled-night-${manifest.version}.zip`, `oled-night-firefox-${manifest.version}.zip`]) {
    const zip = readFileSync(join(fixture, 'dist', archive));
    const end = zip.length - 22;
    assert.equal(zip.readUInt32LE(end), 0x06054b50);
    let pos = zip.readUInt32LE(end + 16);
    for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
      assert.equal(zip.readUInt32LE(pos), 0x02014b50);
      const length = zip.readUInt16LE(pos + 28);
      const name = zip.subarray(pos + 46, pos + 46 + length).toString();
      assert.ok(!/(^|\/)_metadata(\/|$)/.test(name), `archive includes reserved metadata: ${name}`);
      pos += 46 + length + zip.readUInt16LE(pos + 30) + zip.readUInt16LE(pos + 32);
    }
  }
  console.log('Packaging: clean Chrome/Firefox install folders; no reserved metadata in archives.');
} finally {
  // Only the fresh fixture returned by mkdtempSync is removed.
  rmSync(fixture, { recursive: true, force: true });
}
