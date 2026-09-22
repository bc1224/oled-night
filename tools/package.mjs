// Builds dist/oled-night-<version>.zip containing only what the extension needs
// at runtime. That zip is what gets uploaded to the Chrome Web Store, or shared
// with people who install it with "Load unpacked".
//   node tools/package.mjs
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

// Runtime files only: manifest, scripts, pages, styles and the toolbar icons.
const RUNTIME = ["manifest.json", "settings.js", "color-utils.js", "content.js", "background.js", "shadow-open.js",
  "popup.html", "popup.css", "popup.js", "options.html", "options.css", "options.js",
  "assets/icon-16.png", "assets/icon-32.png", "assets/icon-48.png", "assets/icon-128.png", "INSTALL.md", "LICENSE"];

// Every file the manifest and pages reference must be in the list above.
const referenced = new Set([
  manifest.background.service_worker, ...manifest.content_scripts.flatMap((c) => c.js), manifest.action.default_popup, manifest.options_page,
  ...Object.values(manifest.icons), "shadow-open.js"
]);
for (const page of ["popup.html", "options.html"]) {
  for (const [, ref] of readFileSync(join(root, page), "utf8").matchAll(/(?:src|href)="([^":]+)"/g)) referenced.add(ref);
}
const missing = [...referenced].filter((file) => !RUNTIME.includes(file));
if (missing.length) { console.error(`Referenced but not packaged: ${missing.join(", ")}`); process.exit(1); }
const unused = readdirSync(root).filter((f) => f.endsWith(".js") && statSync(join(root, f)).isFile() && !RUNTIME.includes(f));
if (unused.length) console.warn(`Not packaged (not referenced): ${unused.join(", ")}`);

// Minimal zip writer (deflate), so packaging needs nothing beyond Node.
function writeZip(baseDir, files, out) {
  const entries = [];
  const chunks = [];
  let offset = 0;
  const dosTime = 0, dosDate = (2026 - 1980) << 9 | 1 << 5 | 1; // fixed timestamp: identical input -> identical zip
  for (const file of files) {
    const data = readFileSync(join(baseDir, file));
    const packed = deflateRawSync(data, { level: 9 });
    const name = Buffer.from(file.replace(/\\/g, "/"));
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0, 6); header.writeUInt16LE(8, 8);
    header.writeUInt16LE(dosTime, 10); header.writeUInt16LE(dosDate, 12); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(packed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26); header.writeUInt16LE(0, 28);
    chunks.push(header, name, packed);
    entries.push({ name, crc, packed: packed.length, size: data.length, offset });
    offset += header.length + name.length + packed.length;
  }
  const centralStart = offset;
  for (const e of entries) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0, 8); header.writeUInt16LE(8, 10);
    header.writeUInt16LE(dosTime, 12); header.writeUInt16LE(dosDate, 14); header.writeUInt32LE(e.crc, 16); header.writeUInt32LE(e.packed, 20);
    header.writeUInt32LE(e.size, 24); header.writeUInt16LE(e.name.length, 28); header.writeUInt32LE(e.offset, 42);
    chunks.push(header, e.name);
    offset += header.length + e.name.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(offset - centralStart, 12); end.writeUInt32LE(centralStart, 16);
  chunks.push(end);
  mkdirSync(dirname(out), { recursive: true });
  const zip = Buffer.concat(chunks);
  writeFileSync(out, zip);
  console.log(`${relative(root, out)}  ${entries.length} files, ${(zip.length / 1024).toFixed(1)} KB`);
}

writeZip(root, RUNTIME, join(root, "dist", `oled-night-${manifest.version}.zip`));

// The companion Chrome theme (browser window colors) ships as its own zip.
const themeDir = join(root, "theme");
const theme = JSON.parse(readFileSync(join(themeDir, "manifest.json"), "utf8"));
writeZip(themeDir, ["manifest.json", "README.md", ...Object.values(theme.icons)], join(root, "dist", `oled-night-theme-${theme.version}.zip`));

// Stable asset names keep the website and README latest-release links working.
copyFileSync(join(root, "dist", `oled-night-${manifest.version}.zip`), join(root, "dist", "oled-night.zip"));
copyFileSync(join(root, "dist", `oled-night-theme-${theme.version}.zip`), join(root, "dist", "oled-night-theme.zip"));

// Firefox shares runtime files; only its manifest/background entry differs.
const firefoxDir = join(root, "dist", "firefox");
mkdirSync(firefoxDir, { recursive: true });
for (const file of RUNTIME) {
  mkdirSync(dirname(join(firefoxDir, file)), { recursive: true });
  copyFileSync(join(root, file), join(firefoxDir, file));
}
const firefoxManifest = {
  ...manifest,
  background: { scripts: ["settings.js", "background.js"] },
  browser_specific_settings: { gecko: {
    id: "oled-night@bc1224.github.io",
    strict_min_version: "142.0",
    data_collection_permissions: { required: ["none"] }
  } }
};
writeFileSync(join(firefoxDir, "manifest.json"), JSON.stringify(firefoxManifest, null, 2) + "\n");
writeZip(firefoxDir, RUNTIME, join(root, "dist", `oled-night-firefox-${manifest.version}.zip`));
copyFileSync(join(root, "dist", `oled-night-firefox-${manifest.version}.zip`), join(root, "dist", "oled-night-firefox.zip"));
