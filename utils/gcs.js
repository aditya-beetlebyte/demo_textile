import { Storage } from '@google-cloud/storage';
import path from 'path';
import crypto from 'crypto';

let storageSingleton;

/**
 * Non-GCP servers (VPS, Render, etc.) have no metadata-based ADC. Options:
 * - GCP_SERVICE_ACCOUNT_JSON: full JSON key as one line (set in host secrets, not git)
 * - GCP_SERVICE_ACCOUNT_JSON_BASE64: same JSON base64-encoded (easier in some UIs)
 * - GOOGLE_APPLICATION_CREDENTIALS: path to key file (local/docker with mounted keys/)
 * - Running on Cloud Run / GCE: omit all of the above and use the runtime service account
 */
function buildStorageOptions() {
  const b64 = process.env.GCP_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (b64) {
    try {
      const json = Buffer.from(b64, 'base64').toString('utf8');
      return { credentials: JSON.parse(json) };
    } catch {
      const err = new Error('GCP_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64 JSON');
      err.statusCode = 500;
      throw err;
    }
  }
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    try {
      return { credentials: JSON.parse(raw) };
    } catch {
      const err = new Error('GCP_SERVICE_ACCOUNT_JSON is not valid JSON');
      err.statusCode = 500;
      throw err;
    }
  }
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

  // Avoid file.save() / createWriteStream — those use a stream pipeline that can throw
  // "Cannot call write after a stream was destroyed" in some Node/container setups.
  // Upload via V4 signed PUT + fetch instead (same pattern as Google Cloud docs).
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
