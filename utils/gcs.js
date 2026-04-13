import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let storageSingleton;

/**
 * Credentials for hosts without a key file (Render, Railway, etc.):
 * - GCP_SERVICE_ACCOUNT_JSON_BASE64: base64 of the full service account JSON (best for Render secrets UI)
 * - GCP_SERVICE_ACCOUNT_JSON (or GOOGLE_APPLICATION_CREDENTIALS_JSON): one-line JSON string
 * Local / Docker with a file:
 * - GOOGLE_APPLICATION_CREDENTIALS: path to gcp-key.json (after resolveGcpCredentials.js)
 * GCP-managed runtime (Cloud Run / GCE): omit the above; use default credentials.
 */

const JSON_ENV_KEYS = [
  'GCP_SERVICE_ACCOUNT_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'GCP_CREDENTIALS_JSON',
];

function parseServiceAccountJson(raw) {
  let s = String(raw).trim().replace(/^\uFEFF/, '');
  if (!s) return null;
  // Terminal / Render textarea wraps long lines and inserts real CR/LF inside strings — invalid JSON.
  // Escaped "\n" in the file is two chars (backslash + n), not a newline; stripping only real \r and \n is safe.
  s = s.replace(/\r\n/g, '').replace(/\r/g, '').replace(/\n/g, '');
  try {
    return JSON.parse(s);
  } catch {
    // Some dashboards wrap the whole JSON in an extra pair of quotes
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      const inner = JSON.parse(s);
      return typeof inner === 'string' ? JSON.parse(inner) : inner;
    }
    throw new Error('invalid JSON');
  }
}

function storageOptionsFromCredentials(credentials) {
  if (!credentials || credentials.type !== 'service_account') {
    return null;
  }
  const projectId = credentials.project_id;
  return projectId
    ? { credentials, projectId }
    : { credentials };
}

function tryBase64Env() {
  const b64 = process.env.GCP_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (!b64) return null;
  try {
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const credentials = parseServiceAccountJson(json);
    const opts = storageOptionsFromCredentials(credentials);
    if (!opts) {
      const err = new Error('GCP_SERVICE_ACCOUNT_JSON_BASE64 must decode to a service account JSON object');
      err.statusCode = 500;
      throw err;
    }
    return opts;
  } catch (e) {
    if (e.statusCode) throw e;
    const err = new Error('GCP_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64 or JSON');
    err.statusCode = 500;
    throw err;
  }
}

function tryInlineJsonEnvs() {
  for (const key of JSON_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    try {
      const credentials = parseServiceAccountJson(raw);
      const opts = storageOptionsFromCredentials(credentials);
      if (opts) return opts;
    } catch {
      continue;
    }
  }
  return null;
}

function tryCredentialsFile() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!raw) return null;
  const resolved = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  try {
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
    const credentials = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    return storageOptionsFromCredentials(credentials);
  } catch {
    return null;
  }
}

function buildStorageOptions() {
  const fromB64 = tryBase64Env();
  if (fromB64) return fromB64;

  const fromEnv = tryInlineJsonEnvs();
  if (fromEnv) return fromEnv;

  const fromFile = tryCredentialsFile();
  if (fromFile) return fromFile;

  return null;
}

function getStorage() {
  if (!storageSingleton) {
    const explicit = buildStorageOptions();
    storageSingleton = explicit ? new Storage(explicit) : new Storage();
  }
  return storageSingleton;
}

function getExtension(originalName, mimeType) {
  const ext = path.extname(originalName || '');
  if (ext && ext.length <= 8) return ext;
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '';
}

/**
 * @param {{ buffer: Buffer, contentType: string, orderId: string, taskId: string, originalName?: string }} opts
 * @returns {Promise<string>} Public URL or signed read URL
 */
export async function uploadTaskPhoto({ buffer, contentType, orderId, taskId, originalName }) {
  const bucketName = process.env.GCP_BUCKET_NAME;
  if (!bucketName) {
    const err = new Error('GCP_BUCKET_NAME is not configured');
    err.statusCode = 500;
    throw err;
  }

  const bucket = getStorage().bucket(bucketName);
  const suffix = getExtension(originalName, contentType);
  const dest = `textile-demo/${orderId}/${taskId}/${crypto.randomUUID()}${suffix}`;
  const file = bucket.file(dest);
  const ct = contentType || 'application/octet-stream';

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000,
    contentType: ct,
  });
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: buffer,
    headers: { 'Content-Type': ct },
  });
  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => '');
    const err = new Error(
      `GCS upload failed: ${putRes.status} ${putRes.statusText}${detail ? ` — ${detail.slice(0, 500)}` : ''}`
    );
    err.statusCode = 502;
    throw err;
  }

  if (process.env.GCP_PUBLIC_READ === '1') {
    return `https://storage.googleapis.com/${bucketName}/${dest}`;
  }

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return url;
}
