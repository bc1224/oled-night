// Submit an already packaged release without a browser file picker.
// Credentials come only from the process environment; never put them in this repo.
//   node tools/submit-stores.mjs --status
//   node tools/submit-stores.mjs --amo | --chrome | --both
import { createHmac, randomUUID, randomBytes, createCipheriv, publicEncrypt } from "node:crypto";
import { readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")).version;
const files = {
  chrome: join(root, "dist", `oled-night-${version}.zip`),
  firefox: join(root, "dist", `oled-night-firefox-${version}.zip`),
  source: join(root, "dist", `oled-night-source-${version}.zip`)
};
const AMO_BASE = "https://addons.mozilla.org/api/v5";
const CWS_BASE = "https://chromewebstore.googleapis.com";
const CWS_ITEM_ID = "afffgalhockmjmknnaljghdneaeichbl";
const CWS_THEME_ID = "pkdklfocgpcnijiggfddneadmhacbpmf";
const AMO_ADDON = "oled-night";

function requireFiles(...names) {
  for (const name of names) {
    if (!statSync(files[name], { throwIfNoEntry: false })?.isFile())
      throw new Error(`Missing ${files[name]}; run node tools/package.mjs and git archive first.`);
  }
}

function requireEnv(...names) {
  const missing = names.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Missing credentials: ${missing.join(", ")}. See STORE_SUBMISSION.md.`);
}

function saveEncryptedDiagnostic(result, label) {
  if (!label.startsWith("Chrome Web Store") || !process.env.CWS_DIAGNOSTIC_PUBLIC_KEY) return;
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(result), "utf8"), cipher.final()]);
  const encryptedKey = publicEncrypt({
    key: Buffer.from(process.env.CWS_DIAGNOSTIC_PUBLIC_KEY, "base64"), oaepHash: "sha256"
  }, key);
  const path = join(root, "dist", "cws-error.encrypted.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({
    algorithm: "RSA-OAEP-SHA256/AES-256-GCM", key: encryptedKey.toString("base64"),
    iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: ciphertext.toString("base64")
  }));
  console.log("Chrome Web Store diagnostic saved encrypted for the supplied public key.");
}

async function json(response, label) {
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (!response.ok) {
    saveEncryptedDiagnostic(result, label);
    // API error messages can contain user data. Keep stdout free of secrets.
    const oauthError = label === "Google OAuth refresh" && typeof result?.error === "string"
      ? ` (${result.error.replace(/[^a-z_]/g, "").slice(0, 40)})` : "";
    const apiStatus = typeof result?.error?.status === "string"
      ? result.error.status.replace(/[^A-Z_]/g, "").slice(0, 40) : "";
    const reasons = Array.isArray(result?.error?.details)
      ? result.error.details.map(detail => typeof detail?.reason === "string"
        ? detail.reason.replace(/[^A-Z_]/g, "").slice(0, 60) : "").filter(Boolean).slice(0, 3) : [];
    throw new Error(`${label}: HTTP ${response.status}${oauthError}${apiStatus ? ` (${apiStatus})` : ""}${reasons.length ? ` [${reasons.join(", ")}]` : ""}`);
  }
  return result;
}

function amoToken() {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const first = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ iss: process.env.AMO_API_KEY, jti: randomUUID(), iat: now, exp: now + 120 })}`;
  return `${first}.${createHmac("sha256", process.env.AMO_API_SECRET).update(first).digest("base64url")}`;
}

async function amoRequest(path, options = {}) {
  const response = await fetch(`${AMO_BASE}${path}`, {
    ...options,
    headers: { Authorization: `JWT ${amoToken()}`, ...options.headers }
  });
  return json(response, `AMO ${path}`);
}

// AMO renders plain links as HTML in readback. Compare visible text only.
export function storeText(text) {
  return String(text).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(?:39|x27);/g, "'")
    .replace(/\s+/g, ' ').trim();
}

export async function updateAmoListing(request, description, privacy) {
  if (!description.trim() || !privacy.trim()) throw new Error('Empty AMO listing or privacy policy.');
  const path = `/addons/addon/${AMO_ADDON}/`;
  for (const [endpoint, field, value] of [[path, 'description', description], [`${path}eula_policy/`, 'privacy_policy', privacy]]) {
    await request(endpoint, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({[field]:{'en-US':value}})});
    const saved = await request(endpoint);
    if (typeof saved[field]?.['en-US'] !== 'string' || storeText(saved[field]['en-US']) !== storeText(value))
      throw new Error(`AMO ${field} readback did not match the requested copy.`);
  }
}

export function amoPrivacyText(markdown) {
  return markdown.replace(/^#.*\r?\n/, '').replace(/\*\*/g, '').replace(/^_(.*)_$/m, '$1')
    .replace(/`([^`\r\n]+)`/g, '$1').trim();
}

async function submitAmoListing() {
  requireEnv('AMO_API_KEY', 'AMO_API_SECRET');
  const description = readFileSync(join(root, 'store', 'FIREFOX-LISTING.txt'), 'utf8').trim();
  const privacy = amoPrivacyText(readFileSync(join(root, 'store', 'PRIVACY.md'), 'utf8'));
  await updateAmoListing(amoRequest, description, privacy);
  console.log('AMO English listing and privacy policy: saved and read back successfully. No browsing-history log; optional current-domain reports only.');
}

async function submitAmo() {
  requireEnv("AMO_API_KEY", "AMO_API_SECRET");
  requireFiles("firefox", "source");
  const upload = new FormData();
  upload.set("channel", "listed");
  upload.set("upload", new Blob([readFileSync(files.firefox)], { type: "application/zip" }), `oled-night-firefox-${version}.zip`);
  const uploaded = await amoRequest("/addons/upload/", { method: "POST", body: upload });
  if (!uploaded.uuid) throw new Error("AMO upload did not return a UUID.");
  let detail = uploaded;
  for (let i = 0; !detail.processed && i < 30; i++) {
    await delay(2000);
    detail = await amoRequest(`/addons/upload/${encodeURIComponent(uploaded.uuid)}/`);
  }
  if (!detail.processed) throw new Error("AMO validation did not finish within 60 seconds; inspect the upload in Developer Hub.");
  if (!detail.valid || detail.version !== version) throw new Error("AMO rejected the package or found the wrong version; inspect validation in Developer Hub.");
  const submission = new FormData();
  submission.set("upload", uploaded.uuid);
  submission.set("source", new Blob([readFileSync(files.source)], { type: "application/zip" }), `oled-night-source-${version}.zip`);
  const created = await amoRequest(`/addons/addon/${AMO_ADDON}/versions/`, { method: "POST", body: submission });
  if (created.version !== version) throw new Error("AMO did not confirm the submitted version.");
  console.log(`AMO ${version}: submitted for review.`);
  await submitAmoListing();
}

async function cwsRequest(path, token, options = {}) {
  const response = await fetch(`${CWS_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers }
  });
  return json(response, `Chrome Web Store ${path}`);
}

async function submitChrome(theme = false) {
  requireEnv("CWS_CLIENT_ID", "CWS_CLIENT_SECRET", "CWS_REFRESH_TOKEN", "CWS_PUBLISHER_ID");
  const uploadVersion = theme ? JSON.parse(readFileSync(join(root, "theme", "manifest.json"), "utf8")).version : version;
  const uploadFile = theme ? join(root, "dist", `oled-night-theme-${uploadVersion}.zip`) : files.chrome;
  if (!statSync(uploadFile, { throwIfNoEntry: false })?.isFile()) throw new Error("Missing Chrome upload package; run node tools/package.mjs first.");
  const params = new URLSearchParams({
    client_id: process.env.CWS_CLIENT_ID,
    client_secret: process.env.CWS_CLIENT_SECRET,
    refresh_token: process.env.CWS_REFRESH_TOKEN,
    grant_type: "refresh_token"
  });
  const token = (await json(await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: params }), "Google OAuth refresh")).access_token;
  if (!token) throw new Error("Google OAuth did not return an access token.");
  const item = `publishers/${encodeURIComponent(process.env.CWS_PUBLISHER_ID)}/items/${theme ? CWS_THEME_ID : CWS_ITEM_ID}`;
  const before = await cwsRequest(`/v2/${item}:fetchStatus`, token);
  const revision = status => `${status?.state || "NONE"}${status?.distributionChannels?.[0]?.crxVersion ? ` ${status.distributionChannels[0].crxVersion}` : ""}`;
  console.log(`Chrome Web Store before upload: published ${revision(before.publishedItemRevisionStatus)}, submitted ${revision(before.submittedItemRevisionStatus)}.`);
  const uploaded = await cwsRequest(`/upload/v2/${item}:upload`, token, {
    method: "POST", headers: { "Content-Type": "application/zip" }, body: readFileSync(uploadFile)
  });
  let state = uploaded.uploadState;
  if (uploaded.crxVersion && uploaded.crxVersion !== uploadVersion) throw new Error("Chrome Web Store received a different version.");
  for (let i = 0; ["IN_PROGRESS", "UPLOAD_IN_PROGRESS"].includes(state) && i < 30; i++) {
    await delay(2000);
    state = (await cwsRequest(`/v2/${item}:fetchStatus`, token)).lastAsyncUploadState;
  }
  if (state !== "SUCCEEDED") throw new Error(`Chrome Web Store upload not confirmed (${state || "unknown"}).`);
  const published = await cwsRequest(`/v2/${item}:publish`, token, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blockOnWarnings: true })
  });
  if (!published.state) throw new Error("Chrome Web Store did not confirm review submission.");
  console.log(`Chrome Web Store ${theme ? "theme " : ""}${uploadVersion}: ${published.state}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const command = process.argv[2];
try {
  if (command === "--status") {
    console.log(`OLED Night ${version}`);
    for (const [name, path] of Object.entries(files)) console.log(`${name}: ${statSync(path, { throwIfNoEntry: false })?.size ?? "missing"} bytes`);
    for (const name of ["AMO_API_KEY", "AMO_API_SECRET", "CWS_CLIENT_ID", "CWS_CLIENT_SECRET", "CWS_REFRESH_TOKEN", "CWS_PUBLISHER_ID"])
      console.log(`${name}: ${process.env[name] ? "configured" : "missing"}`);
  } else if (command === "--amo") await submitAmo();
  else if (command === "--amo-listing") await submitAmoListing();
  else if (command === "--chrome") await submitChrome();
  else if (command === "--chrome-theme") await submitChrome(true);
  else if (command === "--both") { await submitAmo(); await submitChrome(); }
  else throw new Error("Use --status, --amo, --amo-listing, --chrome, --chrome-theme, or --both.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
}
