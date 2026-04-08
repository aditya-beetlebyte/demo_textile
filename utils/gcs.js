import { Storage } from '@google-cloud/storage';
import path from 'path';
import crypto from 'crypto';

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

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const suffix = getExtension(originalName, contentType);
  const dest = `textile-demo/${orderId}/${taskId}/${crypto.randomUUID()}${suffix}`;
  const file = bucket.file(dest);

  await file.save(buffer, {
    metadata: { contentType: contentType || 'application/octet-stream' },
    resumable: false,
  });

  if (process.env.GCP_PUBLIC_READ === '1') {
    return `https://storage.googleapis.com/${bucketName}/${dest}`;
  }

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return url;
}
