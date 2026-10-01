// Submit an already packaged release without a browser file picker.
// Credentials come only from the process environment; never put them in this repo.
//   node tools/submit-stores.mjs --status
//   node tools/submit-stores.mjs --amo | --chrome | --both
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
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

async function json(response, label) {
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (!response.ok) {
    // API error messages can contain user data. Keep stdout free of secrets.
    const oauthError = label === "Google OAuth refresh" && typeof result?.error === "string"
      ? ` (${result.error.replace(/[^a-z_]/g, "").slice(0, 40)})` : "";
    throw new Error(`${label}: HTTP ${response.status}${oauthError}${result?.error?.code ? ` (${result.error.code})` : ""}`);
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
}

async function cwsRequest(path, token, options = {}) {
  const response = await fetch(`${CWS_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers }
  });
  return json(response, `Chrome Web Store ${path}`);
}

async function submitChrome() {
  requireEnv("CWS_CLIENT_ID", "CWS_CLIENT_SECRET", "CWS_REFRESH_TOKEN", "CWS_PUBLISHER_ID");
  requireFiles("chrome");
  const params = new URLSearchParams({
    client_id: process.env.CWS_CLIENT_ID,
    client_secret: process.env.CWS_CLIENT_SECRET,
    refresh_token: process.env.CWS_REFRESH_TOKEN,
    grant_type: "refresh_token"
  });
  const token = (await json(await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: params }), "Google OAuth refresh")).access_token;
  if (!token) throw new Error("Google OAuth did not return an access token.");
  const item = `publishers/${encodeURIComponent(process.env.CWS_PUBLISHER_ID)}/items/${CWS_ITEM_ID}`;
  const uploaded = await cwsRequest(`/upload/v2/${item}:upload`, token, {
    method: "POST", headers: { "Content-Type": "application/zip" }, body: readFileSync(files.chrome)
  });
  let state = uploaded.uploadState;
  if (uploaded.crxVersion && uploaded.crxVersion !== version) throw new Error("Chrome Web Store received a different version.");
  for (let i = 0; ["IN_PROGRESS", "UPLOAD_IN_PROGRESS"].includes(state) && i < 30; i++) {
    await delay(2000);
    state = (await cwsRequest(`/v2/${item}:fetchStatus`, token)).lastAsyncUploadState;
  }
  if (state !== "SUCCEEDED") throw new Error(`Chrome Web Store upload not confirmed (${state || "unknown"}).`);
  const published = await cwsRequest(`/v2/${item}:publish`, token, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blockOnWarnings: true })
  });
  if (!published.state) throw new Error("Chrome Web Store did not confirm review submission.");
  console.log(`Chrome Web Store ${version}: ${published.state}.`);
}

const command = process.argv[2];
try {
  if (command === "--status") {
    console.log(`OLED Night ${version}`);
    for (const [name, path] of Object.entries(files)) console.log(`${name}: ${statSync(path, { throwIfNoEntry: false })?.size ?? "missing"} bytes`);
    for (const name of ["AMO_API_KEY", "AMO_API_SECRET", "CWS_CLIENT_ID", "CWS_CLIENT_SECRET", "CWS_REFRESH_TOKEN", "CWS_PUBLISHER_ID"])
      console.log(`${name}: ${process.env[name] ? "configured" : "missing"}`);
  } else if (command === "--amo") await submitAmo();
  else if (command === "--chrome") await submitChrome();
  else if (command === "--both") { await submitAmo(); await submitChrome(); }
  else throw new Error("Use --status, --amo, --chrome, or --both.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
